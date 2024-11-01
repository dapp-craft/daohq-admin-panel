import time
import asyncio
import aiosqlite
from fastapi import APIRouter, Depends, HTTPException

from models import PutDsScreen
from tools import (
    db_connection,
    CheckRole,
    broadcast_deleted_ds_message,
    check_system_token,
    broadcast_added_ds_message,
    delete_s3_object,
    scene_socket_manager,
)


router = APIRouter()


@router.delete('/discord/images')
async def delete_discord_image(
    message_link: str,
    db=Depends(db_connection),
    _=Depends(CheckRole(('admin', 'superadmin'))),
):

    db.row_factory = aiosqlite.Row

    cursor = await db.execute(
        '''
        SELECT pd.s3_urn, ds.id AS screen_id, pd.message_link
        FROM Discord pd
        JOIN DiscordScreen ds ON pd.guild = ds.guild AND pd.channel = ds.channel
        WHERE message_link = ?1
        ''',
        (message_link,),
    )

    deleted_messages = await cursor.fetchall()
    deleted_messages = (
        [] if not deleted_messages else [dict(image) for image in deleted_messages]
    )

    await db.execute(
        '''
        DELETE FROM Discord
        WHERE message_link = ?1
        ''',
        (message_link,),
    )

    await db.commit()

    for deleted_message in deleted_messages:
        if deleted_message['s3_urn']:
            await delete_s3_object(deleted_message['s3_urn'])

    asyncio.create_task(broadcast_deleted_ds_message(deleted_messages))
    return message_link


@router.delete('/discord/bot/images')
async def delete_discord_image_from_bot(
    message_link: str, db=Depends(db_connection), _=Depends(check_system_token)
):

    db.row_factory = aiosqlite.Row

    cursor = await db.execute(
        '''
        SELECT d.s3_urn, ds.id AS screen_id, d.message_link
        FROM Discord d
        JOIN DiscordScreen ds ON d.guild = ds.guild AND d.channel = ds.channel
        WHERE message_link = ?1
        ''',
        (message_link,),
    )

    deleted_messages = await cursor.fetchall()
    deleted_messages = (
        [] if not deleted_messages else [dict(image) for image in deleted_messages]
    )

    if not deleted_messages:
        raise HTTPException(
            status_code=404, detail="Image does not exist in attached chennels"
        )

    cursor = await db.execute(
        '''
        DELETE FROM Discord
        WHERE message_link = ?1
        ''',
        (message_link,),
    )

    await db.commit()

    for deleted_message in deleted_messages:
        if deleted_message['s3_urn']:
            await delete_s3_object(deleted_message['s3_urn'])

    if cursor.rowcount:
        asyncio.create_task(broadcast_deleted_ds_message(deleted_messages))


@router.get('/discord/screens/{screen_id}/images')
async def discord_images_list(screen_id: str, db=Depends(db_connection)):

    db.row_factory = aiosqlite.Row

    cursor = await db.execute(
        '''
        SELECT pd.message_link, pd.guild, pd.channel, pd.s3_urn, ds.id AS screen_id
        FROM Discord pd
        JOIN DiscordScreen ds ON pd.guild = ds.guild AND pd.channel = ds.channel
        WHERE ds.id = ?1
        ORDER BY pd.added_at DESC
        LIMIT 3
        ''',
        (screen_id,),
    )
    discord_images = await cursor.fetchall()
    if not discord_images:
        return []

    discord_images = [dict(image) for image in discord_images]

    return discord_images


@router.get('/discord/screens')
async def discord_screens_list(db=Depends(db_connection)):

    db.row_factory = aiosqlite.Row

    cursor = await db.execute(
        '''
        SELECT ds.id, ds.description, ds.guild, ds.channel, ds.location, l.preview AS location_preview
        FROM DiscordScreen ds
        JOIN Location l ON ds.location = l.id
        '''
    )
    discord_images = await cursor.fetchall()
    if not discord_images:
        return []

    discord_images = [dict(image) for image in discord_images]

    return discord_images


@router.delete('/discord/screens/{screen_id}')
async def delete_discord_screen(
    screen_id: str,
    db=Depends(db_connection),
    _=Depends(CheckRole(('admin', 'superadmin'))),
):

    await db.execute(
        '''
        DELETE FROM DiscordScreen
        WHERE id = ?1
        ''',
        (screen_id,),
    )

    await db.commit()

    return screen_id


@router.put('/discord/screens/{screen_id}')
async def put_discord_screen(
    screen_id: str,
    data: PutDsScreen,
    db=Depends(db_connection),
    _=Depends(CheckRole(('admin', 'superadmin'))),
):

    print("GUILD: ", data.guild, "CHANNEL: ", data.channel)

    await db.execute(
        '''
        UPDATE DiscordScreen
        SET guild = ?1,
        channel = ?2
        WHERE id = ?3
        ''',
        (data.guild, data.channel, screen_id),
    )

    await db.commit()

    return (data.guild, data.channel)


@router.post('/discord/images')
async def discord_content(
    s3_urn: str,
    guild: str,
    channel: str,
    jump_url: str,
    db=Depends(db_connection),
    _=Depends(check_system_token),
):

    cursor = await db.execute(
        '''
        SELECT message_link, s3_urn
        FROM Discord
        WHERE guild = ?1 AND channel = ?2 AND (
            SELECT COUNT(*)
            FROM Discord
            WHERE guild = ?1 AND channel = ?2
        ) >= 3
        ORDER BY added_at ASC
        LIMIT 1
        ''',
        (guild, channel),
    )

    image_for_deleting = await cursor.fetchone()

    try:
        await db.execute(
            '''
            DELETE FROM Discord
            WHERE message_link = ?1
            ''',
            (image_for_deleting[0],),
        )
        await delete_s3_object(image_for_deleting[1])
    except TypeError:
        pass

    await db.execute(
        '''
        INSERT INTO Discord (message_link, guild, channel, s3_urn, added_at)
        VALUES (?1, ?2, ?3, ?4, ?5)
        ''',
        (jump_url, guild, channel, s3_urn, int(time.time())),
    )

    await db.commit()

    asyncio.create_task(broadcast_added_ds_message(jump_url))


@router.put('/discord/images')
async def update_discord_content(jump_url: str, _=Depends(check_system_token)):

    async with aiosqlite.connect('database.sqlite', timeout=30) as db:
        db.row_factory = aiosqlite.Row

        cursor = await db.execute(
            '''
            SELECT pd.message_link, pd.guild, pd.channel, pd.s3_urn, ds.id AS screen_id
            FROM Discord pd
            LEFT JOIN DiscordScreen ds ON pd.guild = ds.guild AND pd.channel = ds.channel
            WHERE pd.message_link = ?1
            ''',
            (jump_url,),
        )
        discord_images = await cursor.fetchall()

    data = [] if not discord_images else [dict(image) for image in discord_images]

    if discord_images:
        asyncio.create_task(
            scene_socket_manager.broadcast({'type': 'discord-updated', 'data': data})
        )
