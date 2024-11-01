import asyncio
from time import time
import aiosqlite
from typing import List, Dict

from fastapi import APIRouter, Depends, WebSocket, Query, HTTPException, Response

from tools import (
    db_connection,
    get_default_music,
    connection_manager,
    check_booking_owner,
    CheckRole,
)

from settings import DEFAULT_MUSIC, DEFAULT_IMAGE, MUSIC_LIMIT


super_admin_wallet = '0x7777777777777777777777777777777777777777'

router = APIRouter()


@router.post('/music')
async def add_content(
    location: str,
    resource: int,
    booking: int = None,
    db=Depends(db_connection),
    user_data=Depends(CheckRole((None,))),
):

    limit_data = await music_limit(booking, db)
    if (limit_data['limit'] - limit_data['content_count']) <= 0:
        raise HTTPException(status_code=403, detail="Music content limit full")

    user_address = user_data['user_address']
    user_role = user_data['user_role']
    if user_role == (None,):
        await check_booking_owner(booking, user_address, db)

    await db.execute(
        '''
        INSERT INTO Music (booking, location, resource, order_id)
        VALUES (?1, ?2, ?3, (SELECT COUNT(id)+1 FROM Music WHERE booking=?1))
        ''',
        (booking, location, resource),
    )

    await db.commit()

    asyncio.create_task(
        connection_manager.broadcast([{'location': location, 'booking': booking}])
    )
    # asyncio.create_task(broadcast_changed_slot_if_live(slot, booking))


@router.delete('/music/playlist')
async def remove_music_from_playlist(
    music_id: int, db=Depends(db_connection), user_data=Depends(CheckRole((None,)))
):

    cursor = await db.execute(
        '''
    SELECT location, booking
    FROM Music
    WHERE id = ?
    ''',
        (music_id,),
    )
    content_data = await cursor.fetchone()
    if not content_data:
        return Response(status_code=204)
    location = content_data[0]
    booking_id = content_data[1]

    user_address = user_data['user_address']
    user_role = user_data['user_role']
    if user_role == (None,):
        await check_booking_owner(booking_id, user_address, db)

    await db.execute(
        '''
        DELETE FROM Music
        WHERE id = ?
        ''',
        (music_id,),
    )

    await db.commit()

    asyncio.create_task(
        connection_manager.broadcast([{'location': location, 'booking': booking_id}])
    )
    # asyncio.create_task(broadcast_changed_slot_if_live(slot, booking_id))
    # await connection_manager.broadcast([{'slot': slot, 'booking': booking_id}])
    # if is_booking_actual(booking_id, db):
    #     await actual_booking_manager.broadcast([{'slot': slot, 'booking': booking_id}])


@router.get('/music')
async def get_music(
    location_id: str = None,
    booking_id: int = None,
    resource_id: int = None,
    db=Depends(db_connection),
):

    db.row_factory = aiosqlite.Row

    queries = []

    if location_id:
        queries.append(f'm.location = "{location_id}"')
    # else:
    #     raise HTTPException(status_code=400)

    if resource_id:
        queries.append(f'r.id = {resource_id}')

    if booking_id:
        queries.append(f'm.booking = {booking_id}')
    else:
        queries.append('m.booking IS NULL')

    where_sql = ' AND '.join(queries)

    cursor = await db.execute(
        f'''
        SELECT m.booking, r.type, f.s3_urn, m.location AS location_id, m.id AS content_id, m.order_id, r.id AS resource_id, r.name, r.deleted
        FROM Music m
        JOIN Resource r ON m.resource = r.id
        LEFT JOIN Files f ON r.file = f.id
        WHERE {where_sql}
        ORDER BY m.order_id
        '''
    )
    content = await cursor.fetchall()
    content = [dict(el) for el in content]
    for el in content:
        if el['deleted']:
            el['s3_urn'] = DEFAULT_MUSIC if el['type'] == 'music' else DEFAULT_IMAGE

    return content


@router.patch('/music/order')
async def update_content_order(
    new_order: dict, db=Depends(db_connection), user_data=Depends(CheckRole((None,)))
):

    music = []

    for content_id, order_id in new_order.items():

        cursor = await db.execute(
            '''
            SELECT booking, location
            FROM Music
            WHERE id = ?1
            ''',
            (content_id,),
        )
        cursor = await cursor.fetchone()
        booking_id, location = cursor[0:2]
        music.append({'location': location, 'booking': booking_id})

        user_address = user_data['user_address']
        user_role = user_data['user_role']
        if user_role == (None,):
            await check_booking_owner(booking_id, user_address, db)

        await db.execute(
            '''
            UPDATE Music
            SET order_id = ?2
            WHERE id = ?1
            ''',
            (content_id, order_id),
        )

    await db.commit()

    music_tuples = set([tuple(d.items()) for d in music])
    unique_dicts = [dict(t) for t in music_tuples]

    asyncio.create_task(connection_manager.broadcast(unique_dicts))
    # asyncio.create_task(broadcast_changed_slot_if_live(slot, booking_id))


@router.get('/user/music')
async def get_user_music(
    db=Depends(db_connection), user_data=Depends(CheckRole((None,)))
):

    user_address = user_data['user_address']

    db.row_factory = aiosqlite.Row

    cursor = await db.execute(
        '''
        SELECT *
        FROM Resource r
        JOIN File f ON f.id = r.file
        WHERE f.user = ?1
        ''',
        (user_address,),
    )

    user_files = await cursor.fetchall()
    user_files = [dict(user_file) for user_file in user_files]

    return user_files


@router.get('/music/live')
async def get_active_music(
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
        SELECT m.id, r.type, f.s3_urn, m.order_id, m.booking, m.location, r.deleted
        FROM Music m
        JOIN Location l ON m.location = l.id
        JOIN Resource r ON m.resource = r.id
        LEFT JOIN Files f ON r.file = f.id
        JOIN Booking b ON m.booking = b.id
        WHERE m.booking {bookings_condition} AND m.location {locations_condition}
        ORDER BY m.order_id
    '''

    cursor = await db.execute(query, combined_parameters)
    content = await cursor.fetchall()
    content = [dict(el) for el in content]
    for el in content:
        if el['deleted']:
            el['s3_urn'] = DEFAULT_MUSIC if el['type'] == 'music' else DEFAULT_IMAGE

    location_dict = {}

    for item in content:
        location = item.pop('location')
        if location not in location_dict:
            location_dict[location] = []
        location_dict[location].append(item)

    for location in locations:
        if not location_dict.get(location):
            if location not in [booking['location'] for booking in bookings]:
                default_contents = await get_default_music(location, db)
            else:
                default_contents = [{}]
            if not location_dict.get(location):
                location_dict[location] = []
            location_dict[location] = location_dict[location] + default_contents

    return location_dict


@router.get('/music/limit')
async def music_limit(
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
        raise HTTPException(status_code=404)
    booking_duration = booking_duration[0]

    duration_minutes = booking_duration / 60000
    limit = (duration_minutes / 30) * MUSIC_LIMIT
    limit = int(round(limit, 2))

    cursor = await db.execute(
        '''
    SELECT COUNT(*)
    FROM Music
    WHERE booking = ?1
    ''',
        (booking_id,),
    )
    content_count = await cursor.fetchone()
    content_count = content_count[0]

    return {"limit": limit, "content_count": content_count}
