import aiosqlite
import httpx
from time import time
from typing import List
from datetime import datetime, timedelta, UTC
import jwt

from fastapi import (
    APIRouter,
    Depends,
    Response,
    Query,
    WebSocket,
    File,
    UploadFile,
    HTTPException,
)
from fastapi.websockets import WebSocketDisconnect

from tools import (
    db_connection,
    s3_upload,
    check_booking_owner,
    scene_socket_manager,
    notify_finish_booking,
    check_booking_overlap,
    booking_socket_manager,
    validate_auth_chain,
    check_closest_booking,
    check_token,
    delete_s3_object,
    CheckRole,
)
from models import Booking, BookingPatch, FullBooking, BookingsClosestResponse
from settings import (
    SYSTEM_TOKEN,
    MEILISEARCH_HOST,
    JWT_SECRET,
    MIN_BOOKING_TIME,
    MAX_BOOKING_TIME,
)

router = APIRouter()


@router.post('/bookings', response_model=FullBooking)
async def post_bookings(
    booking: Booking, db=Depends(db_connection), user_data=Depends(CheckRole((None,)))
):

    if (
        booking.duration > MAX_BOOKING_TIME * 1000
        or booking.duration < MIN_BOOKING_TIME * 1000
    ):
        raise HTTPException(status_code=400, detail="Incorrect duration of booking")

    user_address = user_data['user_address']

    db.row_factory = aiosqlite.Row

    await check_booking_overlap(
        booking.location, booking.start_date, booking.duration, db
    )
    await db.execute(
        '''
        INSERT INTO Booking (
            owner,
            title,
            creation_date,
            start_date,
            duration,
            event_date,
            description,
            location
            )
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
        ''',
        (
            user_address,
            booking.title,
            int(time() * 1000),
            booking.start_date,
            booking.duration,
            booking.event_date,
            booking.description,
            booking.location,
        ),
    )
    await db.commit()
    cursor = await db.execute('SELECT last_insert_rowid()')
    booking_id = await cursor.fetchone()
    booking_id = booking_id[0]

    await db.commit()

    cursor = await db.execute(
        '''
        SELECT * 
        FROM Booking
        WHERE id = ?1
        ''',
        (booking_id,),
    )
    inserted_booking = await cursor.fetchone()
    inserted_booking = dict(inserted_booking)
    inserted_booking['is_live'] = bool(inserted_booking['is_live'])

    meilisearch_headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {SYSTEM_TOKEN}',
    }

    async with httpx.AsyncClient() as client:
        response = await client.post(
            f'{MEILISEARCH_HOST}/indexes/booking/documents',
            headers=meilisearch_headers,
            json=[inserted_booking],
        )
        response.raise_for_status()

    await check_closest_booking(
        booking_id, booking.location, inserted_booking, 'added', db
    )

    return inserted_booking


@router.patch('/bookings/{booking_id}/poster', response_model=FullBooking)
async def post_booking_poster(
    booking_id: int,
    preview: UploadFile = File(...),
    db=Depends(db_connection),
    user_data=Depends(CheckRole((None,))),
):

    user_address = user_data['user_address']
    user_role = user_data['user_role']
    if user_role == (None,):
        await check_booking_owner(booking_id, user_address, db)

    db.row_factory = aiosqlite.Row

    save_path = f'{hash(user_address)}/{int(time())}_{preview.filename}-booking-preview'

    preview_content = await preview.read()
    s3_urn = await s3_upload(save_path, preview_content)

    cursor = await db.execute(
        '''
        SELECT preview
        FROM Booking
        WHERE id = ?1
        ''',
        (booking_id,),
    )

    previous_preview = await cursor.fetchone()

    try:
        previous_preview = previous_preview['preview']
        await delete_s3_object(previous_preview)
    except Exception:
        pass

    await db.execute(
        '''
        UPDATE Booking
        SET preview = ?2
        WHERE id = ?1
        ''',
        (booking_id, s3_urn),
    )

    await db.commit()

    cursor = await db.execute(
        '''
        SELECT * 
        FROM Booking
        WHERE id = ?1
        ''',
        (booking_id,),
    )
    updated_booking = await cursor.fetchone()
    updated_booking = dict(updated_booking)
    updated_booking['is_live'] = bool(updated_booking['is_live'])

    meilisearch_headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {SYSTEM_TOKEN}',
    }
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f'{MEILISEARCH_HOST}/indexes/booking/documents',
            headers=meilisearch_headers,
            json=[updated_booking],
        )
        response.raise_for_status()

    await check_closest_booking(
        booking_id, updated_booking['location'], updated_booking, 'updated', db
    )

    return updated_booking


@router.get('/locations/{location_id}/bookings', response_model=List[FullBooking])
async def get_bookings(
    location_id: str, from_date: int, to_date: int, db=Depends(db_connection)
):

    db.row_factory = aiosqlite.Row

    cursor = await db.execute(
        '''
        SELECT *
        FROM Booking
        WHERE (start_date + duration) >= ?1 AND start_date <= ?2 AND location = ?3
        ''',
        (from_date, to_date, location_id),
    )
    all_bookings = await cursor.fetchall()
    all_bookings = [dict(booking) for booking in all_bookings]

    return all_bookings


@router.get('/bookings/{booking_id}', response_model=FullBooking)
async def get_booking(booking_id: int, db=Depends(db_connection)):

    db.row_factory = aiosqlite.Row

    cursor = await db.execute(
        '''
        SELECT *
        FROM Booking
        WHERE id = ?1
        ''',
        (booking_id,),
    )
    booking = await cursor.fetchone()
    if not booking:
        return Response(status_code=404, content='Booking not found')

    booking = dict(booking)

    return booking


@router.put('/bookings/{booking_id}', response_model=FullBooking)
async def update_booking(
    booking_id: int,
    booking: Booking,
    db=Depends(db_connection),
    user_data=Depends(CheckRole((None,))),
):

    user_address = user_data['user_address']
    user_role = user_data['user_role']
    if user_role == (None,):
        await check_booking_owner(booking_id, user_address, db)

    db.row_factory = aiosqlite.Row

    await db.execute(
        '''
        UPDATE Booking 
        SET owner = ?1, title = ?2, start_date = ?3, location = ?4
        WHERE id = ?5
        ''',
        (user_address, booking.title, booking.start_date, booking.location, booking_id),
    )

    await db.commit()

    cursor = await db.execute(
        '''
        SELECT * 
        FROM Booking
        WHERE id = ?1
        ''',
        (booking_id,),
    )
    updated_booking = await cursor.fetchone()
    updated_booking = dict(updated_booking)
    updated_booking['is_live'] = bool(updated_booking['is_live'])

    meilisearch_headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {SYSTEM_TOKEN}',
    }
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f'{MEILISEARCH_HOST}/indexes/booking/documents',
            headers=meilisearch_headers,
            json=[updated_booking],
        )
        response.raise_for_status()

    return updated_booking


@router.patch('/bookings/{booking_id}', response_model=FullBooking)
async def partial_update_booking(
    booking_id: int,
    booking: BookingPatch,
    db=Depends(db_connection),
    user_data=Depends(CheckRole((None,))),
):

    user_address = user_data['user_address']
    user_role = user_data['user_role']
    if user_role == (None,):
        await check_booking_owner(booking_id, user_address, db)

    db.row_factory = aiosqlite.Row

    updates = {key: value for key, value in booking.dict().items() if value is not None}

    if not updates:
        return None

    query = "UPDATE Booking SET "
    query += ', '.join(f"{key} = ?" for key in updates.keys())
    query += " WHERE id = ?"

    values = list(updates.values())
    values.append(booking_id)

    await db.execute(query, values)

    await db.commit()

    cursor = await db.execute(
        '''
        SELECT * 
        FROM Booking
        WHERE id = ?1
        ''',
        (booking_id,),
    )
    updated_booking = await cursor.fetchone()
    updated_booking = dict(updated_booking)
    updated_booking['is_live'] = bool(updated_booking['is_live'])

    meilisearch_headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {SYSTEM_TOKEN}',
    }
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f'{MEILISEARCH_HOST}/indexes/booking/documents',
            headers=meilisearch_headers,
            json=[updated_booking],
        )
        response.raise_for_status()

    await check_closest_booking(
        booking_id, updated_booking['location'], updated_booking, 'updated', db
    )

    return updated_booking


@router.delete('/bookings/{booking_id}')
async def delete_booking(
    booking_id: int, db=Depends(db_connection), user_data=Depends(CheckRole((None,)))
):

    db.row_factory = aiosqlite.Row

    user_address = user_data['user_address']
    user_role = user_data['user_role']
    if user_role == (None,):
        await check_booking_owner(booking_id, user_address, db)

    cursor = await db.execute('SELECT * FROM Booking WHERE id = ?', (booking_id,))
    deleted_booking = await cursor.fetchone()
    deleted_booking = dict(deleted_booking)
    deleted_booking['is_live'] = bool(deleted_booking['is_live'])
    location = deleted_booking['location']
    await notify_finish_booking(location, [deleted_booking])
    await db.execute('DELETE FROM Booking WHERE id = ?', (booking_id,))
    if deleted_booking['preview']:
        await delete_s3_object(deleted_booking['preview'])
    await db.execute('DELETE FROM Content WHERE booking = ?', (booking_id,))
    await db.commit()

    meilisearch_headers = {'Authorization': f'Bearer {SYSTEM_TOKEN}'}
    async with httpx.AsyncClient() as client:
        response = await client.delete(
            f'{MEILISEARCH_HOST}/indexes/booking/documents/{booking_id}',
            headers=meilisearch_headers,
        )
        response.raise_for_status()

    await check_closest_booking(booking_id, location, deleted_booking, 'deleted', db)

    await notify_finish_booking(location, [{'id': booking_id}])


@router.get('/bookings/{location_id}/active', response_model=List[FullBooking])
async def get_active_bookings(
    location_id: str, take: int, skip: int = 0, db=Depends(db_connection)
):

    db.row_factory = aiosqlite.Row

    current_date = time() * 1000

    cursor = await db.execute(
        '''
        SELECT *
        FROM Booking
        WHERE location = ?1 AND (start_date + duration) > ?4
        ORDER BY start_date
        LIMIT ?2 OFFSET ?3
        ''',
        (location_id, take, skip, current_date),
    )
    all_bookings = await cursor.fetchall()
    all_bookings = [dict(booking) for booking in all_bookings]

    return all_bookings


@router.get('/bookings/{location_id}/inactive', response_model=List[FullBooking])
async def get_inactive_bookings(
    location_id: str, take: int, skip: int = 0, db=Depends(db_connection)
):

    db.row_factory = aiosqlite.Row

    current_date = time() * 1000

    cursor = await db.execute(
        '''
        SELECT *
        FROM Booking
        WHERE location = ?1 AND (start_date + duration < ?4)
        ORDER BY start_date DESC
        LIMIT ?2 OFFSET ?3
        ''',
        (location_id, take, skip, current_date),
    )
    all_bookings = await cursor.fetchall()
    all_bookings = [dict(booking) for booking in all_bookings]

    return all_bookings


@router.get('/users/bookings/{location_id}/active', response_model=List[FullBooking])
async def get_active_user_bookings(
    location_id: str,
    take: int,
    skip: int = 0,
    db=Depends(db_connection),
    user_data=Depends(CheckRole((None,))),
):

    user_address = user_data['user_address']

    db.row_factory = aiosqlite.Row

    current_date = time() * 1000

    cursor = await db.execute(
        '''
        SELECT *
        FROM Booking
        WHERE owner = ?3 AND location = ?5 AND (start_date + duration > ?4)
        ORDER BY start_date
        LIMIT ?1 OFFSET ?2
        ''',
        (take, skip, user_address, current_date, location_id),
    )
    all_bookings = await cursor.fetchall()
    all_bookings = [dict(booking) for booking in all_bookings]

    return all_bookings


@router.get('/users/bookings/{location_id}/inactive', response_model=List[FullBooking])
async def get_inactive_user_bookings(
    location_id: str,
    take: int,
    skip: int = 0,
    db=Depends(db_connection),
    user_data=Depends(CheckRole((None,))),
):

    user_address = user_data['user_address']

    db.row_factory = aiosqlite.Row

    current_date = time() * 1000

    cursor = await db.execute(
        '''
        SELECT *
        FROM Booking
        WHERE owner = ?3 AND location = ?5 AND (start_date + duration < ?4)
        ORDER BY start_date DESC
        LIMIT ?1 OFFSET ?2
        ''',
        (take, skip, user_address, current_date, location_id),
    )
    all_bookings = await cursor.fetchall()
    all_bookings = [dict(booking) for booking in all_bookings]

    return all_bookings


@router.get('/locations/bookings/live', response_model=List[FullBooking])
async def get_active_locations_bookings(
    locations: List[str] = Query(...), db=Depends(db_connection)
):

    db.row_factory = aiosqlite.Row

    locations = tuple(locations)
    if len(locations) == 1:
        locations = locations + locations

    cursor = await db.execute(
        f'''
        SELECT * 
        FROM Booking
        WHERE location IN {locations}
        AND is_live = 1
        ORDER BY start_date
        '''
    )
    all_bookings = await cursor.fetchall()
    all_bookings = [dict(booking) for booking in all_bookings]

    return all_bookings


@router.get('/all/bookings/live', response_model=List[FullBooking])
async def get_live_bookings(db=Depends(db_connection)):

    db.row_factory = aiosqlite.Row

    cursor = await db.execute(
        '''
        SELECT * 
        FROM Booking
        WHERE is_live = 1
        ORDER BY start_date
        '''
    )
    all_bookings = await cursor.fetchall()
    all_bookings = [dict(booking) for booking in all_bookings]

    return all_bookings


@router.get('/bookings/closest/{location_id}', response_model=BookingsClosestResponse)
async def get_poster(location_id: str, db=Depends(db_connection)):

    db.row_factory = aiosqlite.Row

    current_date = int(time() * 1000)

    cursor = await db.execute(
        '''
        SELECT * 
        FROM Booking
        WHERE location = ?1
        AND (start_date + duration) >= ?2
        ORDER BY start_date
        LIMIT 2
        ''',
        (location_id, current_date),
    )
    active_bookings_data = await cursor.fetchall()
    cursor = await db.execute(
        '''
        SELECT * 
        FROM Booking
        WHERE location = ?1
        AND (start_date + duration) < ?2
        ORDER BY (?2 - (start_date + duration)) ASC
        LIMIT 1
        ''',
        (location_id, current_date),
    )
    past_booking_data = await cursor.fetchone()
    active_bookings = [FullBooking(**dict(row)) for row in active_bookings_data]
    past_booking = FullBooking(**dict(past_booking_data)) if past_booking_data else None

    return {"active_bookings": active_bookings, "past_booking": past_booking}


@router.websocket('/ws/scene')
async def connect_scene_socket(websocket: WebSocket):
    await scene_socket_manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        scene_socket_manager.disconnect(websocket)


@router.websocket('/ws/booking/{booking_id}/auth')
async def websocket_endpoint(
    websocket: WebSocket,
    booking_id: int,
    token: str = None,
    db=Depends(db_connection),
):

    db.row_factory = aiosqlite.Row

    if not token:
        user_address = None

    try:
        user_data = await CheckRole((None,))(token)
    except HTTPException as e:
        await websocket.close()
        return e
    user_address = user_data['user_address']

    await booking_socket_manager.connect(websocket, booking_id)

    cursor = await db.execute(
        '''
        SELECT *
        FROM SlotStates
        WHERE booking = ?1
        ''',
        (booking_id,),
    )
    booking_state = await cursor.fetchall()
    booking_state = [dict(el) for el in booking_state]
    await booking_socket_manager.send_personal_message(
        {"type": "init_booking_states", "data": booking_state}, websocket
    )

    try:
        while True:
            data = await websocket.receive_json()
            message_data = data['data']

            async with db.execute(
                'SELECT owner FROM Booking WHERE id = ?1', (booking_id,)
            ) as cursor:
                row = await cursor.fetchone()
                if row and row['owner'] == user_address:
                    await cursor.execute(
                        '''
                        INSERT OR REPLACE INTO SlotStates (booking, slot, content_index, is_paused)
                        VALUES (?1, ?2, ?3, ?4)
                        ''',
                        (
                            booking_id,
                            message_data.get('slot'),
                            message_data.get('content_index'),
                            message_data.get('is_paused'),
                        ),
                    )
                    await db.commit()

                    await booking_socket_manager.broadcast(data, booking_id)
    except WebSocketDisconnect:
        booking_socket_manager.disconnect(websocket, booking_id)


@router.get('/signed/ws-token')
async def get_token(user_address=Depends(validate_auth_chain)):

    expired_at = datetime.now(UTC) + timedelta(seconds=180)
    expired_at = expired_at.isoformat()

    payload = {'expired_at': expired_at, 'user_address': user_address}

    token = jwt.encode(payload, JWT_SECRET, algorithm='HS256')

    return token


@router.websocket('/ws/booking/{booking_id}/signed')
async def signed_websocket_endpoint(
    websocket: WebSocket, booking_id: int, token: str, db=Depends(db_connection)
):

    db.row_factory = aiosqlite.Row

    try:
        decoded_token = await check_token(token)
        user_address = decoded_token.get('user_address')
    except HTTPException as e:
        await websocket.close()
        return e

    await booking_socket_manager.connect(websocket, booking_id)

    cursor = await db.execute(
        '''
        SELECT *
        FROM SlotStates
        WHERE booking = ?1
        ''',
        (booking_id,),
    )
    booking_state = await cursor.fetchall()
    booking_state = [dict(el) for el in booking_state]
    await booking_socket_manager.send_personal_message(
        {"type": "init_booking_states", "data": booking_state}, websocket
    )

    try:
        while True:
            data = await websocket.receive_json()
            message_data = data['data']

            async with db.execute(
                'SELECT owner FROM Booking WHERE id = ?1', (booking_id,)
            ) as cursor:
                row = await cursor.fetchone()
                if row and row['owner'] == user_address:
                    await cursor.execute(
                        '''
                        INSERT OR REPLACE INTO SlotStates (booking, slot, content_index, is_paused)
                        VALUES (?1, ?2, ?3, ?4)
                        ''',
                        (
                            booking_id,
                            message_data.get('slot'),
                            message_data.get('content_index'),
                            message_data.get('is_paused'),
                        ),
                    )
                    await db.commit()

                    await booking_socket_manager.broadcast(data, booking_id)
    except WebSocketDisconnect:
        booking_socket_manager.disconnect(websocket, booking_id)
