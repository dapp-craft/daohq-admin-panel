import asyncio
import time
from typing import List, Optional

import aiosqlite

from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, Query

from tools import (
    db_connection,
    s3_upload,
    check_booking_owner,
    check_system_token,
    CheckRole,
    connection_manager,
    broadcast_changed_slot_if_live,
    delete_s3_file_if_exceeds,
    scene_socket_manager,
    delete_s3_object,
)

from content_controller import get_content
from settings import DEFAULT_IMAGE, DEFAULT_PREVIEW, DEFAULT_MUSIC, MAX_FILE_SIZE
from content_controller import content_limit

from models import GetContentResponse


router = APIRouter()


@router.post('/image-content', response_model=List[GetContentResponse])
async def image_content(
    file_name: str,
    slot: int,
    booking: int = None,
    file: UploadFile = File(...),
    db=Depends(db_connection),
    user_data=Depends(CheckRole((None,))),
):

    file_content = await file.read()
    file_size = len(file_content)
    if file_size > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400, detail="File too large, maximum allowed size is 1MB"
        )

    file.file.seek(0)

    if len(file_name) > 250:
        raise HTTPException(
            status_code=400, detail="file_name must not exceed 250 characters"
        )

    user_address = user_data['user_address']
    user_role = user_data['user_role']
    if user_role == (None,):
        if not booking:
            raise HTTPException(status_code=403, detail="Insufficient rights")
        await check_booking_owner(booking, user_address, db)

    if booking:
        limit_data = await content_limit(booking, db)
        if (limit_data['limit'] - limit_data['content_count']) <= 0:
            raise HTTPException(status_code=403, detail="Content limit full")
    
    save_path = f'{hash(user_address)}/{int(time.time())}_{file.filename}'
    file_content = await file.read()

    await delete_s3_file_if_exceeds(db)
    s3_urn = await s3_upload(save_path, file_content)

    await db.execute(
        '''
        INSERT INTO Files (s3_urn, user)
        VALUES (?, ?)
        ''',
        (s3_urn, user_address),
    )
    await db.commit()
    cursor = await db.execute('SELECT last_insert_rowid()')
    file_id = await cursor.fetchone()
    file_id = file_id[0]

    await db.execute(
        '''
        INSERT INTO Resource (file, name, type)
        VALUES (?, ?, ?)
        ''',
        (file_id, file_name, 'image'),
    )

    await db.commit()
    cursor = await db.execute('SELECT last_insert_rowid()')
    resource_id = await cursor.fetchone()
    resource_id = resource_id[0]

    await db.execute(
        '''
        INSERT INTO Content (booking, slot, resource, order_id)
        VALUES (?, ?, ?, (SELECT COUNT(id)+1 FROM Content WHERE booking=?1 AND slot=?2))
        ''',
        (booking, slot, resource_id),
    )

    await db.commit()

    asyncio.create_task(
        connection_manager.broadcast([{'slot': slot, 'booking': booking}])
    )
    asyncio.create_task(broadcast_changed_slot_if_live(slot, booking))
    # await connection_manager.broadcast([{'slot': slot, 'booking': booking}])

    return await get_content(slot_id=slot, resource_id=resource_id, db=db)


@router.post('/streaming-content')
async def streaming_content(
    slot: int,
    booking: int = None,
    db=Depends(db_connection),
    user_data=Depends(CheckRole((None,))),
) -> int:

    cursor = await db.execute(
        '''
        SELECT supports_streaming
        FROM Slot
        WHERE id = ?1
        ''',
        (slot,),
    )
    supports_streaming = await cursor.fetchone()
    if not supports_streaming:
        raise HTTPException(status_code=400, detail="Incorrect slot id")

    if not supports_streaming[0]:
        raise HTTPException(status_code=403, detail="slot does not support booking")

    user_address = user_data['user_address']
    user_role = user_data['user_role']
    if user_role == (None,):
        if not booking:
            raise HTTPException(status_code=403, detail="Insufficient rights")
        await check_booking_owner(booking, user_address, db)

    if booking:
        limit_data = await content_limit(booking, db)
        if (limit_data['limit'] - limit_data['content_count']) <= 0:
            raise HTTPException(status_code=403, detail="Content limit full")
    
    await db.execute(
        '''
        INSERT INTO Resource (type)
        VALUES (?1)
        ''',
        ('streaming',),
    )

    await db.commit()
    cursor = await db.execute('SELECT last_insert_rowid()')
    resource_id = await cursor.fetchone()
    resource_id = resource_id[0]

    await db.execute(
        '''
        INSERT INTO Content (booking, slot, resource, order_id)
        VALUES (?, ?, ?, (SELECT COUNT(id)+1 FROM Content WHERE booking=?1 AND slot=?2))
        ''',
        (booking, slot, resource_id),
    )
    await db.commit()
    cursor = await db.execute('SELECT last_insert_rowid()')
    content_id = await cursor.fetchone()
    content_id = content_id[0]

    await db.commit()

    asyncio.create_task(
        connection_manager.broadcast([{'slot': slot, 'booking': booking}])
    )
    asyncio.create_task(broadcast_changed_slot_if_live(slot, booking))

    return content_id


@router.post('/video-content', response_model=List[GetContentResponse])
async def video_content(
    file_name: str,
    slot: int,
    video_url: str,
    booking: int = None,
    preview: Optional[UploadFile] = File(None),
    db=Depends(db_connection),
    user_data=Depends(CheckRole((None,))),
):

    if len(file_name) > 250:
        raise HTTPException(
            status_code=400, detail="file_name must not exceed 250 characters"
        )

    user_address = user_data['user_address']
    user_role = user_data['user_role']
    if user_role == (None,):
        if not booking:
            raise HTTPException(status_code=403, detail="Insufficient rights")
        await check_booking_owner(booking, user_address, db)

    if booking:
        limit_data = await content_limit(booking, db)
        if (limit_data['limit'] - limit_data['content_count']) <= 0:
            raise HTTPException(status_code=403, detail="Content limit full")
    
    if preview:
        save_path = (
            f'{hash(user_address)}/{int(time.time())}_{preview.filename}-preview'
        )

        preview_content = await preview.read()
        await delete_s3_file_if_exceeds(db)
        s3_urn = await s3_upload(save_path, preview_content)
    else:
        s3_urn = None

    await db.execute(
        '''
        INSERT INTO Files (s3_urn, user, preview)
        VALUES (?, ?, ?)
        ''',
        (video_url, user_address, s3_urn),
    )
    await db.commit()
    cursor = await db.execute('SELECT last_insert_rowid()')
    file_id = await cursor.fetchone()
    file_id = file_id[0]

    await db.execute(
        '''
        INSERT INTO Resource (file, name, type)
        VALUES (?, ?, ?)
        ''',
        (file_id, file_name, 'video'),
    )
    await db.commit()
    cursor = await db.execute('SELECT last_insert_rowid()')
    resource_id = await cursor.fetchone()
    resource_id = resource_id[0]

    await db.execute(
        '''
        INSERT INTO Content (booking, slot, resource, order_id)
        VALUES (?, ?, ?, (SELECT COUNT(id)+1 FROM Content WHERE booking=?1 AND slot=?2))
        ''',
        (booking, slot, resource_id),
    )

    await db.commit()

    asyncio.create_task(
        connection_manager.broadcast([{'slot': slot, 'booking': booking}])
    )
    asyncio.create_task(broadcast_changed_slot_if_live(slot, booking))

    return await get_content(slot_id=slot, resource_id=resource_id, db=db)


@router.post('/music-content')
async def music_content(
    file_name: str,
    location: str,
    booking: int = None,
    file: UploadFile = File(...),
    db=Depends(db_connection),
    user_data=Depends(CheckRole((None,))),
):
    # user_address = 'test_user'
    user_address = user_data['user_address']
    user_role = user_data['user_role']
    if user_role == (None,):
        if not booking:
            raise HTTPException(status_code=403, detail="Insufficient rights")
        await check_booking_owner(booking, user_address, db)

    save_path = f'{hash(user_address)}/{int(time.time())}_{file.filename}'
    file_content = await file.read()
    await delete_s3_file_if_exceeds(db)
    s3_urn = await s3_upload(save_path, file_content)

    await db.execute(
        '''
        INSERT INTO Files (s3_urn, user)
        VALUES (?, ?)
        ''',
        (s3_urn, user_address),
    )
    await db.commit()
    cursor = await db.execute('SELECT last_insert_rowid()')
    file_id = await cursor.fetchone()
    file_id = file_id[0]

    await db.execute(
        '''
        INSERT INTO Resource (file, name, type)
        VALUES (?, ?, ?)
        ''',
        (file_id, file_name, 'music'),
    )

    await db.commit()
    cursor = await db.execute('SELECT last_insert_rowid()')
    resource_id = await cursor.fetchone()
    resource_id = resource_id[0]

    await db.execute(
        '''
        INSERT INTO Music (location, booking, resource, order_id)
        VALUES (?1, ?2, ?3, (SELECT COUNT(id)+1 FROM Music WHERE booking=?2))
        ''',
        (location, booking, resource_id),
    )

    await db.commit()

    asyncio.create_task(
        connection_manager.broadcast([{'location': location, 'booking': booking}])
    )
    # asyncio.create_task(broadcast_changed_slot_if_live(slot, booking))
    # await connection_manager.broadcast([{'slot': slot, 'booking': booking}])

    # TODO
    # return await get_content(slot_id=slot, resource_id=resource_id, db=db)


# @router.post('/music-content/for-tests')
async def music_content_for_tests(
    file_name: str,
    location: str,
    booking: int = None,
    file: UploadFile = File(...),
    db=Depends(db_connection),
    # user_data=Depends(CheckRole((None,)))
):
    user_address = 'test_user'
    # user_address = user_data['user_address']
    # user_role = user_data['user_role']
    # if user_role == (None,):
    #     if not booking:
    #         raise HTTPException(status_code=403, detail="Insufficient rights")

    save_path = f'{hash(user_address)}/{int(time.time())}_{file.filename}'
    file_content = await file.read()
    s3_urn = await s3_upload(save_path, file_content)

    await db.execute(
        '''
        INSERT INTO Files (s3_urn, user)
        VALUES (?, ?)
        ''',
        (s3_urn, user_address),
    )
    await db.commit()
    cursor = await db.execute('SELECT last_insert_rowid()')
    file_id = await cursor.fetchone()
    file_id = file_id[0]

    await db.execute(
        '''
        INSERT INTO Resource (file, name, type)
        VALUES (?, ?, ?)
        ''',
        (file_id, file_name, 'music'),
    )

    await db.commit()
    cursor = await db.execute('SELECT last_insert_rowid()')
    resource_id = await cursor.fetchone()
    resource_id = resource_id[0]

    await db.execute(
        '''
        INSERT INTO Music (location, booking, resource, order_id)
        VALUES (?1, ?2, ?3, (SELECT COUNT(id)+1 FROM Music WHERE booking=?2))
        ''',
        (location, booking, resource_id),
    )

    await db.commit()

    asyncio.create_task(
        connection_manager.broadcast([{'location': location, 'booking': booking}])
    )


@router.patch('/video-content/{res_id}/preview')
async def patch_video_content_preview(
    res_id: str,
    preview: UploadFile = File(...),
    db=Depends(db_connection),
    user_data=Depends(CheckRole((None,))),
) -> int:

    cursor = await db.execute(
        '''
        SELECT booking, slot
        FROM Content
        WHERE resource = ?1
        ''',
        (res_id,),
    )
    row = await cursor.fetchone()
    booking_id, slot = row[0], row[1]

    user_address = user_data['user_address']
    user_role = user_data['user_role']
    if user_role == (None,):
        if not booking_id:
            raise HTTPException(status_code=403, detail="Insufficient rights")
        await check_booking_owner(booking_id, user_address, db)

    cursor = await db.execute(
        '''
        SELECT r.file, f.user
        FROM Resource as r
        JOIN Files as f ON r.file = f.id
        WHERE r.id = ?1
        ''',
        (res_id,),
    )
    file_id, file_owner = await cursor.fetchone()
    if not file_owner == user_address:
        raise HTTPException(status_code=403, detail="Insufficient rights")

    save_path = f'{hash(user_address)}/{int(time.time())}_{preview.filename}-preview'

    preview_content = await preview.read()
    await delete_s3_file_if_exceeds(db)
    s3_urn = await s3_upload(save_path, preview_content)

    cursor = await db.execute(
        '''
        SELECT preview
        FROM Files
        WHERE id = ?1
        ''',
        (file_id,),
    )
    preview_s3_urn = await cursor.fetchone()
    if preview_s3_urn:
        preview_s3_urn = preview_s3_urn[0]
        await delete_s3_object(preview_s3_urn)

    await db.execute(
        '''
        UPDATE Files
        SET preview = ?2
        WHERE id = ?1
        ''',
        (file_id, s3_urn),
    )

    await db.commit()

    asyncio.create_task(
        connection_manager.broadcast([{'slot': slot, 'booking': booking_id}])
    )
    asyncio.create_task(broadcast_changed_slot_if_live(slot, booking_id))
    # await connection_manager.broadcast([{'slot': slot, 'booking': booking_id}])

    return res_id


@router.patch('/locations/{location_id}/preview')
async def patch_location_preview(
    location_id: str,
    preview: UploadFile = File(...),
    db=Depends(db_connection),
    _=Depends(CheckRole(('admin', 'superadmin'))),
) -> str:

    save_path = f'location-previews/{location_id}-{int(time.time())}-preview'

    preview_content = await preview.read()
    await delete_s3_file_if_exceeds(db)
    s3_urn = await s3_upload(save_path, preview_content)

    cursor = await db.execute(
        '''
        SELECT preview
        FROM Location
        WHERE id = ?1
        ''',
        (location_id,),
    )

    preview_s3_urn = await cursor.fetchone()
    if preview_s3_urn != (None,):
        preview_s3_urn = preview_s3_urn[0]
        await delete_s3_object(preview_s3_urn)

    await db.execute(
        '''
        UPDATE Location
        SET preview = ?2
        WHERE id = ?1
        ''',
        (location_id, s3_urn),
    )

    await db.commit()

    # await connection_manager.broadcast([slot,])

    return s3_urn


@router.get('/resources')
async def get_resources(
    types: List[str] = Query(...),
    user_data=Depends(CheckRole((None,))),
    db=Depends(db_connection),
):

    db.row_factory = aiosqlite.Row
    user_address = user_data['user_address']

    types = tuple(types)
    if len(types) == 1:
        types = types + types

    cursor = await db.execute(
        f'''
        SELECT r.id, r.name, r.file, r.type, f.s3_urn, f.preview, r.deleted
        FROM Resource r
        JOIN Files f ON r.file = f.id
        WHERE f.user = ?1 AND r.type IN {types}
        ''',
        (user_address,),
    )
    content = await cursor.fetchall()

    if not content:
        return []

    content = [dict(el) for el in content]

    for el in content:
        if el['deleted']:
            el['url'] = DEFAULT_MUSIC if el['type'] == 'music' else DEFAULT_IMAGE
            el['preview'] = DEFAULT_PREVIEW

    return content


@router.patch('/resources')
async def patch_resources(
    resource_id: int, new_name: str, db=Depends(db_connection)
) -> int:

    await db.execute(
        '''
        UPDATE Resource
        SET name = ?1
        WHERE id = ?2
        ''',
        (new_name, resource_id),
    )

    await db.commit()

    return resource_id


@router.delete('/resources/{resource_id}')
async def delete_resource(
    resource_id: int, db=Depends(db_connection), _=Depends(CheckRole((None,)))
) -> int:

    cursor = await db.execute(
        '''
        SELECT id
        FROM Content
        WHERE resource = ?1
        ''',
        (resource_id,),
    )
    resource_content = await cursor.fetchone()
    if resource_content:
        raise HTTPException(
            status_code=403, detail="There is content with this resource"
        )

    cursor = await db.execute(
        '''
        SELECT file
        FROM Resource
        WHERE id = ?1
        ''',
        (resource_id,),
    )
    resource_file = await cursor.fetchone()
    if resource_file:
        cursor = await db.execute(
            '''
        SELECT s3_urn, preview
        FROM Files
        WHERE id = ?1;
        ''',
            (resource_file[0],),
        )
        file_for_deleting = await cursor.fetchone()
        await delete_s3_object(file_for_deleting[0])
        if file_for_deleting[1]:
            await delete_s3_object(file_for_deleting[1])
        await db.execute(
            '''
            DELETE FROM Files
            WHERE id = ?1
            ''',
            (resource_file[0],),
        )

    await db.execute(
        '''
        DELETE FROM Resource
        WHERE id = ?1
        ''',
        (resource_id,),
    )

    await db.commit()
    return resource_id


@router.post('/resources')
async def add_resource(
    body: dict, db=Depends(db_connection), _=Depends(CheckRole((None,)))
):

    type = body.get('type')
    name = body.get('name')
    user_id = body.get('user_id')
    bot = body.get('bot')
    s3_urn = body.get('s3_urn')

    file_id = None
    if s3_urn:
        await db.execute(
            '''
            INSERT INTO Files (user, s3_urn)
            VALUES (?1, ?2)
            ''',
            (user_id, s3_urn),
        )
        await db.commit()
        cursor = await db.execute('SELECT last_insert_rowid()')
        file_id = await cursor.fetchone()
        file_id = file_id[0]

    await db.execute(
        '''
        INSERT INTO Resource (file, bot, name, type)
        VALUES (?1, ?2, ?3, ?4)
        ''',
        (file_id, bot, name, type),
    )
    await db.commit()
    cursor = await db.execute('SELECT last_insert_rowid()')
    resource_id = await cursor.fetchone()
    resource_id = resource_id[0]

    await db.commit()

    return resource_id
