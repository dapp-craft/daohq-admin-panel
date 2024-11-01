import aiosqlite
import aioboto3
import jwt
import asyncio
import json
from datetime import datetime, timezone
from botocore.exceptions import ClientError

from typing import List
from time import time

from eth_account.messages import encode_defunct
from fastapi import HTTPException, WebSocket, Depends, Request
from fastapi.security import HTTPBearer, APIKeyHeader

from eth_utils import is_address
from eth_account.messages import encode_defunct
from web3 import Web3

from settings import (
    JWT_SECRET,
    SYSTEM_TOKEN,
    SYSTEM_OUT_TOKEN,
    USER_FILES_BUCKET_NAME,
    FILES_BUCKET_FOLDER,
    DEFAULT_IMAGE,
    DEFAULT_PREVIEW,
    DEFAULT_MUSIC,
)
from settings import w3, aws_session, config

from delegate_streaming_rights import delegate_streaming_rights, revoke_streaming_rights
from models import SocketMessage


class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def send_personal_message(self, message: str, websocket: WebSocket):
        await websocket.send_json(message)

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            await connection.send_json(message)


connection_manager = ConnectionManager()


class BookingSocketManager:
    def __init__(self):
        self.active_connections: dict[int, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, booking_id: int):
        await websocket.accept()
        if booking_id not in self.active_connections:
            self.active_connections[booking_id] = []
        self.active_connections[booking_id].append(websocket)

    def disconnect(self, websocket: WebSocket, booking_id: int):
        self.active_connections[booking_id].remove(websocket)
        if not self.active_connections[booking_id]:
            del self.active_connections[booking_id]

    async def send_personal_message(self, message: str, websocket: WebSocket):
        await websocket.send_json(message)

    async def broadcast(self, message: str, booking_id: int):
        if booking_id in self.active_connections:
            for connection in self.active_connections[booking_id]:
                await connection.send_json(message)


booking_socket_manager = BookingSocketManager()


async def db_connection():
    async with aiosqlite.connect('database.sqlite', timeout=30) as db:
        yield db


async def check_closest_booking(booking_id, location_id, booking_data, action, db):

    current_date = int(time() * 1000)
    cursor = await db.execute(
        '''
        SELECT id
        FROM Booking
        WHERE location = ?1
        AND (start_date + duration) >= ?2
        ORDER BY start_date
        LIMIT 2
        ''',
        (location_id, current_date),
    )

    active_bookings_data = await cursor.fetchall()
    active_bookings_data = [booking['id'] for booking in active_bookings_data]

    if booking_id in active_bookings_data:
        await scene_socket_manager.broadcast(
            {'type': f'closest-booking-{action}', 'data': booking_data}
        )


async def check_booking_overlap(location: str, start_date: int, duration: int, db):

    end_date = start_date + duration
    cursor = await db.execute(
        '''
            SELECT id FROM Booking
            WHERE location = ?1
            AND (
                (start_date <= ?2 AND start_date + duration > ?2) OR
                (start_date <= ?3 AND start_date + duration > ?3) OR
                (start_date >= ?2 AND start_date <= ?3) OR
                (start_date = ?2 AND start_date + duration = ?3)
            )
            ''',
        (location, start_date, end_date),
    )

    overlap = await cursor.fetchone()

    if overlap:
        raise HTTPException(
            status_code=400, detail="Booking time overlaps with an existing booking."
        )


def check_signature(signature, msg):
    message = encode_defunct(text=msg)
    signer_address = w3.eth.account.recover_message(message, signature=signature)

    return signer_address


def is_not_expired(iso_date):
    current_time = datetime.now(timezone.utc)

    expiration_time = datetime.fromisoformat(iso_date).replace(tzinfo=timezone.utc)

    return current_time < expiration_time


def validate_auth_chain(request: Request):

    # Assume that the chain contains 3 elements
    # 1. Signer
    # 2. ECDSA ephemeral
    # 3. ECDSA signed entity

    headers = {
        key: json.loads(value)
        for key, value in request.headers.items()
        if key.startswith('x-identity-auth-chain-')
    }

    if len(headers) == 0:
        raise HTTPException(status_code=401, detail="Auth chain is empty")

    header_data = headers['x-identity-auth-chain-2']['payload']
    method, path, timestamp = header_data.split(':')[:3]
    timestamp = int(timestamp)
    # print(method, path, timestamp)

    current_time = time() * 1000

    if (
        method.lower() != request.method.lower()
        or path != config.prefix + request.url.path
        or (timestamp - current_time) > 10000
        or (current_time - timestamp) >= (5 * 60) * 1000
    ):
        raise HTTPException(status_code=401, detail="Invalid chain")

    chain = [
        headers[key] for key in sorted(headers, key=lambda x: int(x.split('-')[-1]))
    ]

    # Validate the first element
    if chain[0]["type"] != "SIGNER":
        raise HTTPException(
            status_code=401, detail="First element of auth chain must be a signer"
        )

    # Checksum is not required
    if not is_address(chain[0]["payload"]):
        raise HTTPException(status_code=401, detail="Invalid signer address")

    if chain[0]["signature"] != "":
        raise HTTPException(
            status_code=401,
            detail="First element of auth chain must not have a signature",
        )

    # Validate the second element
    if chain[1]["type"] != "ECDSA_EPHEMERAL":
        raise HTTPException(
            status_code=401,
            detail="Second element of auth chain must be an ECDSA ephemeral",
        )

    _, delegateAddress, expirationDate = parseEphemeralPayload(chain[1]["payload"])

    if datetime.strptime(expirationDate, "%Y-%m-%dT%H:%M:%S.%fZ") < datetime.now():
        raise HTTPException(status_code=401, detail="Expiration date is in the past")

    # Checksum is not required
    if not is_address(delegateAddress):
        raise HTTPException(status_code=401, detail="Invalid delegate address")

    validate_signature(chain[1]["payload"], chain[1]["signature"], chain[0]["payload"])

    # Validate the third element
    if chain[2]["type"] != "ECDSA_SIGNED_ENTITY":
        raise HTTPException(
            status_code=401,
            detail="Third element of auth chain must be an ECDSA signed entity",
        )

    validate_signature(chain[2]["payload"], chain[2]["signature"], delegateAddress)

    return chain[0]["payload"]


def parseEphemeralPayload(payload):
    """
    Verify the payload is in this form and extract the fields:
        <purpose>
        Ephemeral address: <delegate-address>
        Expiration: <date>
    """

    lines = payload.split("\n")

    if len(lines) != 3:
        raise Exception("Invalid ECDSA ephemeral payload")

    if lines[0] != "Decentraland Login":
        raise Exception("Invalid ECDSA ephemeral payload")

    if not lines[1].startswith("Ephemeral address: "):
        raise Exception("Invalid ECDSA ephemeral payload")

    if not lines[2].startswith("Expiration: "):
        raise Exception("Invalid ECDSA ephemeral payload")

    purpose = lines[0]

    # Extract the delegate address
    delegateAddress = lines[1].split(": ")[1]

    # Extract the expiration date
    expirationDate = lines[2].split(": ")[1]

    # Check if the expiration date is a valid date
    try:
        datetime.strptime(expirationDate, "%Y-%m-%dT%H:%M:%S.%fZ")
    except ValueError:
        raise Exception("Invalid expiration date")

    return (purpose, delegateAddress, expirationDate)


def validate_signature(message, signature, expected_address):

    try:
        # Prepare the message to match the format it had when signed
        message_encoded = encode_defunct(text=message)

        # Recover the address from the signature
        recovered_address = Web3().eth.account.recover_message(
            message_encoded, signature=signature
        )
    except Exception as e:
        raise Exception("Invalid signature fromat")

    # Compare the recovered address to the expected address
    if recovered_address.lower() != expected_address.lower():
        raise Exception("Invalid signature")


async def check_token(token: str):

    try:
        decoded_token = jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")

    expiration = decoded_token.get('expired_at')

    if not is_not_expired(expiration):
        raise HTTPException(status_code=401, detail="Expired token")

    return decoded_token


auth_scheme = HTTPBearer(scheme_name='User Authorization')


class CheckRole:

    def __init__(self, roles: tuple):
        self.roles = roles

    async def __call__(self, token=Depends(auth_scheme)) -> str:
        async with aiosqlite.connect('database.sqlite', timeout=30) as db:

            if not isinstance(token, str):
                token = token.credentials

            decoded_token = await check_token(token)

            user_address = decoded_token.get('signer_address')

            cursor = await db.execute(
                '''
                SELECT role
                FROM User
                WHERE address = ?1
                ''',
                (user_address,),
            )
            user_role = await cursor.fetchone()

        if not user_role:
            raise HTTPException(status_code=401, detail="User does not exist")

        if self.roles[0] != None and user_role[0] not in self.roles:
            raise HTTPException(status_code=403, detail="Insufficient rights")

        decoded_token['role'] = user_role[0]

        return {'user_address': user_address, 'user_role': user_role}


system_token_header_scheme = APIKeyHeader(name='Authorize', scheme_name='System Token')


async def check_system_token(token=Depends(system_token_header_scheme)):

    if token != SYSTEM_TOKEN:
        raise HTTPException(status_code=401, detail="Invalid token")


async def s3_upload(save_path, file):

    save_path = save_path.replace('+', '_')

    async with aws_session.client('s3') as s3:
        await s3.put_object(
            Bucket=USER_FILES_BUCKET_NAME,
            Key=f'{FILES_BUCKET_FOLDER}/{save_path}',
            Body=file,
            ContentType='image/png',
        )

    return f"https://{USER_FILES_BUCKET_NAME}.s3.amazonaws.com/{FILES_BUCKET_FOLDER}/{save_path}"


async def delete_s3_file_if_exceeds(
    db,
    max_files=100000,
):

    cursor = await db.execute(
        '''
        SELECT COUNT(*)
        FROM Files
        '''
    )
    files_count = await cursor.fetchone()
    files_count = files_count[0]

    if files_count < max_files:
        return False

    cursor = await db.execute(
        '''
        SELECT f.s3_urn, r.id
        FROM Files f
        JOIN Resource r ON r.file = f.id
        JOIN Content c ON c.resource = r.id
        WHERE type IN ("image", "music") AND c.booking IS NOT NULL
        ORDER BY last_usage
        LIMIT 1
        '''
    )

    oldest_file = await cursor.fetchone()

    # print(oldest_file)

    await delete_s3_object(oldest_file[0])

    await db.execute(
        '''
        DELETE FROM Files
        WHERE s3_urn = ?1
        ''',
        (oldest_file[0],),
    )

    await db.execute(
        '''
        UPDATE Resource
        SET deleted = 1,
        file = NULL
        WHERE id = ?1
        ''',
        (oldest_file[1],),
    )

    await db.commit()
    return True


async def delete_s3_object(url: str):

    bucket_name = url.split('//')[1].split('.')[0]
    object_key = url.split('.com')[1][1:]

    async with aws_session.client('s3') as s3:
        await s3.delete_object(Bucket=bucket_name, Key=object_key)


async def get_s3_objects(bucket_name: str, env: str):

    session = aioboto3.Session()
    async with session.client('s3') as s3_client:
        response = await s3_client.list_objects_v2(Bucket=bucket_name, Prefix=env)
        objects = response.get('Contents', [])

        return [obj['Key'] for obj in objects]


async def get_db_urns(db):
    urls = set()

    async with db.execute('SELECT s3_urn FROM Files') as cursor:
        urls.update(row[0] for row in await cursor.fetchall())
    async with db.execute('SELECT s3_urn FROM Discord') as cursor:
        urls.update(row[0] for row in await cursor.fetchall())
    async with db.execute('SELECT s3_urn FROM Metrics') as cursor:
        urls.update(row[0] for row in await cursor.fetchall())
    async with db.execute('SELECT preview FROM Location') as cursor:
        urls.update(row[0] for row in await cursor.fetchall())
    async with db.execute('SELECT preview FROM Booking') as cursor:
        urls.update(row[0] for row in await cursor.fetchall())
    async with db.execute('SELECT preview FROM Files') as cursor:
        urls.update(row[0] for row in await cursor.fetchall())

    urns = []
    for url in urls:
        try:
            urns.append(url.split('.com')[1][1:])
        except Exception:
            pass

    return urns


async def delete_s3_objects(bucket_name: str, objects):

    async with aws_session.client('s3') as s3_client:
        for obj in objects:
            await s3_client.delete_object(Bucket=bucket_name, Key=obj)


external_service_token_header_scheme = APIKeyHeader(
    name='Authorize', scheme_name='External Service Token'
)


async def check_system_out_token(token=Depends(external_service_token_header_scheme)):

    if token != SYSTEM_OUT_TOKEN:
        raise HTTPException(status_code=401, detail="Invalid token")


async def check_booking_owner(booking_id, user_id, db):

    cursor = await db.execute(
        '''
        SELECT owner
        FROM Booking
        WHERE id = ?1
        ''',
        (booking_id,),
    )
    booking_owner = await cursor.fetchone()

    if not booking_owner:
        raise HTTPException(
            status_code=403,
            detail="Insufficient rights for accessing to default content",
        )

    booking_owner = booking_owner[0]
    if user_id != booking_owner:
        raise HTTPException(status_code=403, detail="Insufficient rights")


async def get_default_content(location_id: str, db):
    db.row_factory = aiosqlite.Row

    cursor = await db.execute(
        '''
        SELECT c.id, c.slot, r.type, f.s3_urn, c.order_id, f.preview, c.booking, s.location, r.deleted
        FROM Content c
        JOIN Slot s ON c.slot = s.id
        JOIN Location l ON s.location = l.id
        JOIN Resource r ON c.resource = r.id
        LEFT JOIN Files f ON r.file = f.id
        WHERE c.booking IS NULL AND s.location = ?1
        ORDER BY c.order_id
        ''',
        (location_id,),
    )
    content = await cursor.fetchall()

    if not content:
        return [{}]

    content = [dict(el) for el in content]
    for el in content:
        if el['deleted']:
            el['s3_urn'] = DEFAULT_MUSIC if el['type'] == 'music' else DEFAULT_IMAGE
            el['preview'] = DEFAULT_PREVIEW
    return content


async def get_default_music(location_id: str, db):
    db.row_factory = aiosqlite.Row

    cursor = await db.execute(
        '''
        SELECT m.id, r.type, f.s3_urn, m.order_id, m.booking, m.location
        FROM Music m
        JOIN Location l ON m.location = l.id
        JOIN Resource r ON m.resource = r.id
        LEFT JOIN Files f ON r.file = f.id
        WHERE m.booking IS NULL AND m.location = ?1
        ORDER BY m.order_id
        ''',
        (location_id,),
    )
    content = await cursor.fetchall()

    if not content:
        return [{}]

    content = [dict(el) for el in content]
    return content


def parse_location_identifier(scene):

    coordinates, realm, network, catalyst = scene.split(":")
    x, y = coordinates.split(",") if coordinates else (None, None)

    return {
        "coordinates": {"x": int(x), "y": int(y)} if x and y else None,
        "realm": realm,
        "network": network,
        "catalyst": catalyst,
    }


class SceneSocketManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def send_personal_message(self, message: SocketMessage, websocket: WebSocket):
        await websocket.send_json(message)

    async def broadcast(self, message: SocketMessage):
        for connection in self.active_connections:
            await connection.send_json(message)


scene_socket_manager = SceneSocketManager()


async def broadcast_deleted_ds_message(deleted_messages: list[dict]):

    await scene_socket_manager.broadcast(
        {'type': 'discord-deleted', 'data': deleted_messages}
    )


async def broadcast_added_ds_message(message_link: str):

    async with aiosqlite.connect('database.sqlite', timeout=30) as db:
        db.row_factory = aiosqlite.Row

        cursor = await db.execute(
            '''
            SELECT pd.message_link, pd.guild, pd.channel, pd.s3_urn, ds.id AS screen_id
            FROM Discord pd
            LEFT JOIN DiscordScreen ds ON pd.guild = ds.guild AND pd.channel = ds.channel
            WHERE pd.message_link = ?1
            ''',
            (message_link,),
        )
        discord_images = await cursor.fetchall()

    data = [] if not discord_images else [dict(image) for image in discord_images]

    await scene_socket_manager.broadcast({'type': 'discord-added', 'data': data})


async def broadcast_changed_slot_if_live(slot, booking):

    async with aiosqlite.connect('database.sqlite', timeout=30) as db:
        if booking == await live_booking_for(slot, db):
            await scene_socket_manager.broadcast(
                {'type': 'slot-changed', 'data': [{'slot': slot, 'booking': booking}]}
            )


async def live_booking_for(slot: int, db) -> int | None:

    cursor = await db.execute(
        '''
        SELECT b.id
        FROM Booking b
        JOIN Location l ON b.location = l.id
        JOIN Slot s ON s.location = l.id
        WHERE s.id = ? AND b.is_live = 1
        ''',
        (slot,),
    )
    booking = await cursor.fetchone()
    if booking:
        return booking[0]
    else:
        return None


async def is_booking_with_streaming(booking_id: int, db):

    cursor = await db.execute(
        '''
        SELECT supports_streaming
        FROM Slot s
        JOIN Booking b ON b.location = s.location
        WHERE b.id = ?1
        ''',
        (booking_id,),
    )
    supports_streaming = await cursor.fetchall()
    supports_streaming = [el[0] for el in supports_streaming]

    if 1 not in supports_streaming:
        return False
    else:
        return True

    # cursor = await db.execute(
    #     '''
    #     SELECT r.type
    #     FROM Content c
    #     JOIN Resource r ON c.resource = r.id
    #     WHERE c.booking = ?1
    #     LIMIT 1
    #     ''', (booking_id,)
    # )
    # resource_type = await cursor.fetchone()
    # if not resource_type or resource_type != 'streaming':
    #     return False

    # return True


# current_bookings = set()
custom_current_bookings = set()


async def notify_replaced_booking(location, started_bookings, finished_bookings):
    async with aiosqlite.connect('database.sqlite', timeout=30) as db:
        db.row_factory = aiosqlite.Row
        await scene_socket_manager.broadcast(
            {
                'type': 'bookings_replaced',
                'data': {
                    'location': location,
                    'started': started_bookings,
                    'finished': finished_bookings,
                },
            }
        )
        for el in finished_bookings:
            is_booking_streaming = await is_booking_with_streaming(el['id'], db)
            if not is_booking_streaming:
                continue
            cursor = await db.execute(
                '''
                SELECT scene
                FROM Location
                WHERE id = ?1
                ''',
                (el['location'],),
            )
            scene = await cursor.fetchone()
            scene = scene['scene']

            realm = parse_location_identifier(scene)['realm']
            asyncio.create_task(revoke_streaming_rights(realm, el['owner']))


async def notify_finish_booking(location, bookings_to_send):
    print("notify_finish_booking")
    async with aiosqlite.connect('database.sqlite', timeout=30) as db:
        db.row_factory = aiosqlite.Row
        await scene_socket_manager.broadcast(
            {
                'type': 'bookings_finished',
                'data': {'location': location, 'bookings': bookings_to_send},
            }
        )
        for el in bookings_to_send:
            is_booking_streaming = await is_booking_with_streaming(el['id'], db)
            if not is_booking_streaming:
                continue
            cursor = await db.execute(
                '''
                SELECT scene
                FROM Location
                WHERE id = ?1
                ''',
                (el['location'],),
            )
            scene = await cursor.fetchone()
            scene = scene['scene']

            realm = parse_location_identifier(scene)['realm']
            asyncio.create_task(revoke_streaming_rights(realm, el['owner']))


async def check_live_bookings():

    while True:
        async with aiosqlite.connect('database.sqlite', timeout=30) as db:
            db.row_factory = aiosqlite.Row

            current_time = int(time() * 1000)
            cursor = await db.execute(
                '''
                SELECT *
                FROM Booking
                WHERE is_live = 1 AND ?1 >= (start_date + duration)
                ''',
                (current_time,),
            )

            new_current_bookings = await cursor.fetchall()
            finished_bookings_to_send = [
                dict(booking) for booking in new_current_bookings
            ]
            if finished_bookings_to_send:
                for el in finished_bookings_to_send:
                    await db.execute(
                        '''
                        UPDATE Booking
                        SET is_live = 0
                        WHERE id = ?1
                        ''',
                        (el['id'],),
                    )

                await db.commit()

            cursor = await db.execute(
                '''
                SELECT * 
                FROM Booking
                WHERE ?1 <= (start_date + duration) AND ?1 >= start_date AND is_live != 1
                ''',
                (current_time,),
            )
            new_current_bookings = await cursor.fetchall()
            started_bookings_to_send = [
                dict(booking) for booking in new_current_bookings
            ]

            if started_bookings_to_send:
                for el in started_bookings_to_send:
                    is_booking_streaming = await is_booking_with_streaming(el['id'], db)
                    if not is_booking_streaming:
                        continue

                    cursor = await db.execute(
                        '''
                        SELECT scene
                        FROM Location
                        WHERE id = ?1
                        ''',
                        (el['location'],),
                    )

                    scene = await cursor.fetchone()
                    scene = scene['scene']
                    realm = parse_location_identifier(scene)['realm']
                    asyncio.create_task(delegate_streaming_rights(realm, el['owner']))

                for el in started_bookings_to_send:
                    await db.execute(
                        '''
                        UPDATE Booking
                        SET is_live = 1
                        WHERE id = ?1
                        ''',
                        (el['id'],),
                    )

                await db.commit()

            changed_locations = set(
                (
                    b['location']
                    for b in started_bookings_to_send + finished_bookings_to_send
                )
            )

            for l in changed_locations:
                finished = [b for b in finished_bookings_to_send if b['location'] == l]
                started = [b for b in started_bookings_to_send if b['location'] == l]

                if finished and started:
                    await notify_replaced_booking(l, started, finished)
                elif finished:
                    for el in finished:
                        el['is_live'] = False
                    await notify_finish_booking(l, finished)
                else:  # started
                    for el in started:
                        el['is_live'] = True
                    await scene_socket_manager.broadcast(
                        {
                            'type': 'bookings_started',
                            'data': {'location': l, 'bookings': started},
                        }
                    )

        await asyncio.sleep(5)


async def booking_status():
    await asyncio.gather(
        check_live_bookings(),
    )
