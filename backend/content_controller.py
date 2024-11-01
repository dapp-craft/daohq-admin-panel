import asyncio
from time import time
import aiosqlite
from typing import List, Dict

from fastapi import APIRouter, Depends, WebSocket, Query, HTTPException, Response

from tools import (
    db_connection,
    get_default_content,
    connection_manager,
    check_booking_owner,
    broadcast_changed_slot_if_live,
    CheckRole,
)

from models import GetContentResponse, GetSlotsResponse, ActiveContent
from settings import DEFAULT_PREVIEW, DEFAULT_IMAGE, DEFAULT_MUSIC, CONTENT_LIMIT


super_admin_wallet = '0x7777777777777777777777777777777777777777'

router = APIRouter()


@router.post('/contents')
async def add_content(
    slot: int,
    resource: int,
    booking: int = None,
    db=Depends(db_connection),
    user_data=Depends(CheckRole((None,))),
):

    user_address = user_data['user_address']
    user_role = user_data['user_role']
    if user_role == (None,):
        await check_booking_owner(booking, user_address, db)
    
    if booking:
        limit_data = await content_limit(booking, db)
        if (limit_data['limit'] - limit_data['content_count']) <= 0:
            raise HTTPException(status_code=403, detail="Content limit full")

    await db.execute(
        '''
        INSERT INTO Content (booking, slot, resource, order_id)
        VALUES (?1, ?2, ?3, (SELECT COUNT(id)+1 FROM Content WHERE booking=?1 AND slot=?2))
        ''',
        (booking, slot, resource),
    )

    await db.execute(
        '''
        UPDATE Resource
        SET last_used = ?1
        ''',
        (int(time()),),
    )

    await db.commit()

    asyncio.create_task(
        connection_manager.broadcast([{'slot': slot, 'booking': booking}])
    )
    asyncio.create_task(broadcast_changed_slot_if_live(slot, booking))
    # await connection_manager.broadcast([{'slot': slot, 'booking': booking}])
    # await broadcast_changed_slot_if_live(slot, booking, db)


@router.delete('/contents')
async def remove_content(
    content_id: int, db=Depends(db_connection), user_data=Depends(CheckRole((None,)))
):

    cursor = await db.execute(
        '''
    SELECT slot, booking
    FROM Content
    WHERE id = ?
    ''',
        (content_id,),
    )
    content_data = await cursor.fetchone()
    if not content_data:
        return Response(status_code=204)
    slot = content_data[0]
    booking_id = content_data[1]

    user_address = user_data['user_address']
    user_role = user_data['user_role']
    if user_role == (None,):
        await check_booking_owner(booking_id, user_address, db)

    await db.execute(
        '''
        DELETE FROM Content
        WHERE id = ?
        ''',
        (content_id,),
    )

    await db.commit()

    asyncio.create_task(
        connection_manager.broadcast([{'slot': slot, 'booking': booking_id}])
    )
    asyncio.create_task(broadcast_changed_slot_if_live(slot, booking_id))
    # await connection_manager.broadcast([{'slot': slot, 'booking': booking_id}])
    # if is_booking_actual(booking_id, db):
    #     await actual_booking_manager.broadcast([{'slot': slot, 'booking': booking_id}])


@router.get('/content')
async def get_content(
    slot_id: int = None,
    location_id: str = None,
    booking_id: int = None,
    resource_id: int = None,
    db=Depends(db_connection),
):

    db.row_factory = aiosqlite.Row

    queries = []

    if slot_id:
        queries.append(f's.id = {slot_id}')
    elif location_id:
        queries.append(f'l.id = "{location_id}"')
    else:
        raise HTTPException(status_code=400)

    if resource_id:
        queries.append(f'r.id = {resource_id}')

    if booking_id:
        queries.append(f'c.booking = {booking_id}')
    else:
        queries.append('c.booking IS NULL')

    where_sql = ' AND '.join(queries)

    cursor = await db.execute(
        f'''
        SELECT c.booking, c.slot, r.type, f.s3_urn, l.id AS location_id, c.id AS content_id, c.order_id, f.preview, r.id AS resource_id, r.name, r.deleted
        FROM Content c
        JOIN Slot s ON c.slot = s.id
        JOIN Location l ON s.location = l.id
        JOIN Resource r ON c.resource = r.id
        LEFT JOIN Files f ON r.file = f.id
        WHERE {where_sql}
        ORDER BY c.order_id
        '''
    )
    content = await cursor.fetchall()
    content = [dict(el) for el in content]
    for el in content:
        if el['deleted']:
            el['s3_urn'] = DEFAULT_MUSIC if el['type'] == 'music' else DEFAULT_IMAGE
            el['preview'] = DEFAULT_PREVIEW

    return content


@router.get('/slots')
async def get_slots(
    db=Depends(db_connection), _=Depends(CheckRole(('admin', 'superadmin')))
):

    cursor = await db.execute(
        '''
        SELECT s.id, s.location, l.type, s.name, l.preview, l.scene, s.supports_streaming, l.for_booking, s.format, s.trigger
        FROM Slot s
        JOIN Location l ON s.location = l.id
        '''
    )
    content = await cursor.fetchall()
    if not content:
        return {}

    return {
        el[0]: {
            "location_id": el[1],
            "location_type": el[2],
            "slot_name": el[3],
            "location_preview": el[4],
            "scene": el[5],
            "supports_streaming": bool(el[6]),
            "for_booking": bool(el[7]),
            "format": el[8],
            "trigger": el[9]
        }
        for el in content
    }


@router.get('/slots/for-booking')
async def get_bookings_slots(db=Depends(db_connection)):
    cursor = await db.execute(
        '''
        SELECT s.id, s.location, l.type, s.name, l.preview, l.scene, s.supports_streaming, l.for_booking, s.format, s.trigger
        FROM Slot s
        JOIN Location l ON s.location = l.id
        WHERE l.for_booking = 1
        '''
    )
    content = await cursor.fetchall()
    if not content:
        return {}

    return {
        el[0]: {
            "location_id": el[1],
            "location_type": el[2],
            "slot_name": el[3],
            "location_preview": el[4],
            "scene": el[5],
            "supports_streaming": bool(el[6]),
            "for_booking": bool(el[7]),
            "format": el[8],
            "trigger": el[9]
        }
        for el in content
    }


@router.websocket('/ws/changed/slots')
async def changed_slots(websocket: WebSocket):
    await connection_manager.connect(websocket)
    try:
        while True:
            await websocket.receive_json()
    except Exception as e:
        print(f"WebSocket connection error: {e}")
    finally:
        connection_manager.disconnect(websocket)


@router.patch('/contents/order')
async def update_content_order(
    new_order: dict, db=Depends(db_connection), user_data=Depends(CheckRole((None,)))
):

    slots = []

    for content_id, order_id in new_order.items():

        cursor = await db.execute(
            '''
            SELECT booking, slot
            FROM Content
            WHERE id = ?1
            ''',
            (content_id,),
        )
        cursor = await cursor.fetchone()
        booking_id, slot = cursor[0:2]
        slots.append({'slot': slot, 'booking': booking_id})

        user_address = user_data['user_address']
        user_role = user_data['user_role']
        if user_role == (None,):
            await check_booking_owner(booking_id, user_address, db)

        await db.execute(
            '''
            UPDATE Content
            SET order_id = ?2
            WHERE id = ?1
            ''',
            (content_id, order_id),
        )

    await db.commit()

    slots_tuples = set([tuple(d.items()) for d in slots])
    unique_dicts = [dict(t) for t in slots_tuples]

    asyncio.create_task(connection_manager.broadcast(unique_dicts))
    asyncio.create_task(broadcast_changed_slot_if_live(slot, booking_id))
    # await connection_manager.broadcast(list(set(unique_dicts)))


@router.get('/contents/live', response_model=Dict[str, List[ActiveContent | Dict]])
async def get_active_content(
    locations: List[str] = Query(...), db=Depends(db_connection)
):

    db.row_factory = aiosqlite.Row

    locations_placeholders = ','.join('?' for _ in locations)
    first_query = f'''
        SELECT id, location
        FROM Booking
        WHERE location IN ({locations_placeholders}) AND is_live = 1
    '''

    cursor = await db.execute(first_query, locations)
    bookings = await cursor.fetchall()
    actual_bookings = [booking['id'] for booking in bookings]
    actual_locations = [booking['location'] for booking in bookings]

    if not actual_bookings:
        bookings_condition = "IS NULL"
    else:
        bookings_placeholders = ','.join('?' for _ in actual_bookings)
        bookings_condition = f"IN ({bookings_placeholders})"

    if not actual_locations:
        locations_condition = "IS NULL"
    else:
        locations_placeholders = ','.join('?' for _ in actual_locations)
        locations_condition = f"IN ({locations_placeholders})"

    combined_parameters = actual_bookings + actual_locations

    query = f'''
        SELECT c.id, c.slot, r.type, f.s3_urn, c.order_id, f.preview, c.booking, s.location, r.deleted
        FROM Content c
        JOIN Slot s ON c.slot = s.id
        JOIN Location l ON s.location = l.id
        JOIN Resource r ON c.resource = r.id
        LEFT JOIN Files f ON r.file = f.id
        JOIN Booking b ON c.booking = b.id
        WHERE c.booking {bookings_condition} AND s.location {locations_condition}
        ORDER BY c.order_id
    '''

    cursor = await db.execute(query, combined_parameters)
    content = await cursor.fetchall()
    content = [dict(el) for el in content]
    for el in content:
        if el['deleted']:
            el['s3_urn'] = DEFAULT_MUSIC if el['type'] == 'music' else DEFAULT_IMAGE
            el['preview'] = DEFAULT_PREVIEW

    location_dict = {}

    for item in content:
        location = item.pop('location')
        if location not in location_dict:
            location_dict[location] = []
        location_dict[location].append(item)

    for location in locations:
        if not location_dict.get(location):
            if location not in [booking['location'] for booking in bookings]:
                default_contents = await get_default_content(location, db)
            else:
                default_contents = [{}]
            if not location_dict.get(location):
                location_dict[location] = []
            location_dict[location] = location_dict[location] + default_contents

    return location_dict


@router.get('/contents/slot/live', response_model=Dict[str, List[ActiveContent | Dict]])
async def get_active_slot_content(slot_id: str, db=Depends(db_connection)):
    db.row_factory = aiosqlite.Row

    cursor = await db.execute(
        '''
        SELECT b.id
        FROM Booking b
        JOIN location l ON b.location = l.id
        JOIN slot s ON s.location = l.id
        WHERE b.is_live = 1 AND s.id = ?1;
        ''',
        (slot_id,),
    )
    slot_booking = await cursor.fetchone()

    if not slot_booking:
        cursor = await db.execute(
            '''
                SELECT c.id, s.id AS slot, r.type, f.s3_urn, c.order_id, f.preview, NULL AS booking, s.location, r.deleted
                FROM Content c
                JOIN Slot s ON s.id = c.slot
                JOIN Location l ON s.location = l.id
                LEFT JOIN Resource r ON c.resource = r.id
                LEFT JOIN Files f ON r.file = f.id
                WHERE s.id = ?1 AND c.booking IS NULL
                ORDER BY c.order_id
                ''',
            (slot_id,),
        )
        default_contents = await cursor.fetchall()
        default_contents = {
            slot_id: [dict(default_content) for default_content in default_contents]
        }

        if not default_contents:
            return {slot_id: []}

        for ls in default_contents.values():
            for el in ls:
                if el['deleted']:
                    el['s3_urn'] = (
                        DEFAULT_MUSIC if el['type'] == 'music' else DEFAULT_IMAGE
                    )
                    el['preview'] = DEFAULT_PREVIEW
        return default_contents

    cursor = await db.execute(
        '''
        SELECT c.id, c.slot, r.type, f.s3_urn, c.order_id, f.preview, c.booking, b.location, r.deleted
        FROM Content c
        JOIN Booking b ON c.booking = b.id
        LEFT JOIN Resource r ON c.resource = r.id
        LEFT JOIN Files f ON r.file = f.id
        WHERE c.slot = ?1 AND c.booking = ?2
        ORDER BY c.order_id
        ''',
        (slot_id, slot_booking['id']),
    )
    contents = await cursor.fetchall()
    contents = [dict(content) for content in contents]

    if not contents:
        return {slot_id: []}
    else:
        for el in contents:
            if el['deleted']:
                el['s3_urn'] = DEFAULT_MUSIC if el['type'] == 'music' else DEFAULT_IMAGE
                el['preview'] = DEFAULT_PREVIEW
        return {slot_id: contents}


@router.get('/content/limit')
async def content_limit(
    booking_id: int,
    db=Depends(db_connection),
):

    cursor = await db.execute(
        '''
    SELECT duration
    FROM Booking
    WHERE id = ?1
    ''',
        (booking_id,),
    )
    booking_duration = await cursor.fetchone()
    if not booking_duration:
        raise HTTPException(status_code=404, detail="There is no such booking")
    booking_duration = booking_duration[0]

    duration_minutes = booking_duration / 60000
    limit = (duration_minutes / 30) * CONTENT_LIMIT
    limit = int(round(limit, 2))

    cursor = await db.execute(
        '''
    SELECT COUNT(*)
    FROM Content c
    JOIN Resource r ON c.resource = r.id
    WHERE c.booking = ?1 AND r.type = "image"
    ''',
        (booking_id,),
    )
    content_count = await cursor.fetchone()
    content_count = content_count[0]

    return {"limit": limit, "content_count": content_count}
