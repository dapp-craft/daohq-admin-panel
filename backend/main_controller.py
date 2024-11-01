import re
import json
import jwt
import subprocess
import httpx
import aiosqlite
import aioboto3
from fastapi import APIRouter, Depends, Response, Body, File, UploadFile, HTTPException

from tools import (
    db_connection,
    check_signature,
    check_system_token,
    check_system_out_token,
    delete_s3_object,
    get_db_urns,
    get_s3_objects,
    delete_s3_objects,
)
from settings import (
    JWT_SECRET,
    COMMIT_HASH,
    FILES_BUCKET_NAME,
    FILES_BUCKET_FOLDER,
    USER_FILES_BUCKET_NAME,
    aws_session,
)


router = APIRouter()


@router.get('/version')
async def version():
    '''
    This endpoint returns the current version of the application
    '''

    if COMMIT_HASH:
        return COMMIT_HASH

    try:
        result = subprocess.run(
            ['git', 'rev-parse', 'HEAD'], capture_output=True, text=True, check=True
        )
        commit_hash = result.stdout.strip()
        return commit_hash
    except subprocess.CalledProcessError as e:
        print(f"An error occurred while getting the commit hash: {e}")
        return "UNDEFINED"


@router.post('/auth')
async def auth(
    signature: str, data_to_sign: str = Body(...), db=Depends(db_connection)
):
    '''
    This endpoint handles the authentication of users
    by verifying their web3 signature and returning a JWT token if the signature is valid
    '''

    address = [el for el in data_to_sign.split() if el.startswith('0x')][0]
    signer_address = check_signature(signature, data_to_sign)
    if not signer_address or (signer_address != address):
        return Response(status_code=403, content='unvalid signature')

    pattern = r'\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}'

    expirated_at = re.findall(pattern, data_to_sign)

    token_data = {
        'expired_at': expirated_at[0],
        'signer_address': signer_address,
    }

    await db.execute(
        '''
        INSERT OR IGNORE INTO User (address)
        VALUES (?1)
        ''',
        (signer_address,),
    )
    await db.commit()

    token = jwt.encode(token_data, JWT_SECRET, algorithm='HS256')

    return token


@router.post('/sync/location-schema')
async def synchronization(
    scene: str,
    sync_file: UploadFile = File(...),
    db=Depends(db_connection),
    _=Depends(check_system_token),
):
    '''
    This endpoint synchronizes the location schema
    by uploading a JSON file containing location data
    and updating the database accordingly
    '''

    json_data = await sync_file.read()
    locations = json.loads(json_data)

    await db.execute(
        '''
        DELETE FROM Slot
        WHERE location IN (
            SELECT id
            FROM Location
            WHERE scene = ?1
        )
        ''',
        (scene,),
    )

    cursor = await db.execute(
        '''
        SELECT id, preview 
        FROM Location
        WHERE scene = ?1
        ''',
        (scene,),
    )
    previews = await cursor.fetchall()
    previews = dict(previews)

    await db.execute('DELETE FROM Location WHERE scene = ?1', (scene,))

    for location_id, location_data in locations.items():
        await db.execute(
            '''
            INSERT INTO Location (id, type, scene, for_booking, preview)
            VALUES (?1, ?2, ?3, ?4, ?5)
            ''',
            (
                location_id,
                location_data['type'],
                scene,
                location_data.get('for_booking', 1),
                previews.get(location_id),
            ),
        )

        slots = location_data.get('slots')
        if slots:
            for slot in slots:

                try:
                    slot_id = int(slot['id'])
                except ValueError:
                    raise HTTPException(status_code=400, detail='Invalid slot id')

                await db.execute(
                    '''
                    INSERT INTO Slot (id, location, name, supports_streaming, format, trigger)
                    VALUES (?1, ?2, ?3, ?4, ?5, ?6)
                    ''',
                    (
                        slot_id,
                        location_id,
                        slot['name'],
                        slot.get('supports_streaming', 1),
                        slot['format'],
                        slot['trigger'],
                    ),
                )

        discord_screens = location_data.get('discord_screens')
        if discord_screens:
            # TODO
            # await db.execute(
            #     f'''
            #     DELETE FROM DiscordScreen
            #     WHERE id NOT IN {tuple([discord_screen['id'] for discord_screen in discord_screens])}
            #     '''
            # )
            for discord_screen in discord_screens:
                await db.execute(
                    '''
                    INSERT INTO DiscordScreen (id, description, location)
                    VALUES (?1, ?2, ?3)
                    ON CONFLICT(id) DO UPDATE SET
                    description = ?2,
                    location = ?3;
                    ''',
                    (discord_screen['id'], discord_screen['description'], location_id),
                )
    await db.commit()


@router.delete('/location')
async def delete_scene_locations(
    scene: str, db=Depends(db_connection), _=Depends(check_system_token)
):

    await db.execute(
        '''
        DELETE FROM Slot
        WHERE location IN (
            SELECT id
            FROM Location
            WHERE scene = ?1
        );
        ''',
        (scene,),
    )

    cursor = await db.execute(
        '''
        SELECT preview
        FROM Location
        WHERE scene = ?1;
        ''',
        (scene,),
    )
    locations_for_deleting = await cursor.fetchall()

    await db.execute(
        '''
        DELETE FROM Location
        WHERE scene = ?;
        ''',
        (scene,),
    )

    await db.commit()

    for location_for_deleting in locations_for_deleting:
        if location_for_deleting != (None,):
            await delete_s3_object(location_for_deleting[0])


@router.post('/sync/superadmins')
async def superadmin_synchronization(
    sync_json_link: str = 'https://raw.githubusercontent.com/Decentraland-DAO/transparency/gh-pages/api.json',
    db=Depends(db_connection),
    _=Depends(check_system_out_token),
):
    '''
    This endpoint fetches a list of superadmin addresses
    from a remote JSON file and updates the database with this information
    '''

    async with httpx.AsyncClient() as client:
        response = await client.get(sync_json_link)

        if response.status_code >= 400:
            raise HTTPException(detail='Something went wrong during fetching data')

        data = response.json()
        committees = data.get('committees')

    members = []
    for committee in committees:
        for member in committee['members']:
            members.append((member['address'], 'superadmin'))

    if members:
        insert_query = 'INSERT OR IGNORE INTO User (address, role) VALUES '
        insert_query += ', '.join(['(?, ?)'] * len(members))
        flattened_members = [item for sublist in members for item in sublist]
        await db.execute(insert_query, flattened_members)

    await db.commit()

    return members


@router.get('/meilisearch/public-key')
async def meilisearch_public_key():
    with open('./meilisearch/public_key.txt', 'r') as file:
        public_key = file.read()
    return public_key


@router.get('/location/{location_id}')
async def get_location_data(location_id, db=Depends(db_connection)):

    db.row_factory = aiosqlite.Row

    cursor = await db.execute(
        '''
        SELECT *
        FROM Location
        WHERE id = ?1
        ''',
        (location_id,),
    )

    location_data = await cursor.fetchone()

    if not location_data:
        raise HTTPException(status_code=404, detail="Location not found")

    return dict(location_data)


@router.delete('/sync/s3')
async def s3_synchronization(db=Depends(db_connection), _=Depends(check_system_token)):

    s3_objects_1 = await get_s3_objects(FILES_BUCKET_NAME, FILES_BUCKET_FOLDER)
    s3_objects_2 = await get_s3_objects(USER_FILES_BUCKET_NAME, FILES_BUCKET_FOLDER)

    db_urns = await get_db_urns(db)

    objects_to_delete_1 = set(s3_objects_1) - set(db_urns)
    objects_to_delete_2 = set(s3_objects_2) - set(db_urns)

    await delete_s3_objects(FILES_BUCKET_NAME, list(objects_to_delete_1))
    await delete_s3_objects(USER_FILES_BUCKET_NAME, list(objects_to_delete_2))

    result = [*objects_to_delete_1, *objects_to_delete_2]

    return {"deleted": result}
