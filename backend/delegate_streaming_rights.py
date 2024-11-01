import json
import asyncio
import httpx
from datetime import datetime, timezone, timedelta
from web3 import Web3
from eth_account.messages import encode_defunct

from settings import OWNER_ADDRESS, EPHEMERAL_PRIVATE_KEY, SIGNATURE, EXPIRATION

try:
    EPHEMERAL_ADDRESS = Web3().eth.account.from_key(EPHEMERAL_PRIVATE_KEY).address
    AUTH_CHAIN_DELEGATE_MSG = f'Decentraland Login\nEphemeral address: {EPHEMERAL_ADDRESS}\nExpiration: {EXPIRATION}'
except TypeError:
    print("Incorrect variables for delegating streaming rights")

CONTENT_SERVER_URL = 'https://worlds-content-server.decentraland.org'


async def delegate_streaming_rights(world_name: str, address: str):
    '''
    Delegate streaming rights.

    Args:
        world_name (str): The name of the world in full domain format (e.g., 'snikes.dcl.eth').
        address (str): The address in lowercase to delegate streaming rights to.
    '''

    address = address.lower()

    await _update_streaming_rights('put', world_name, address)


async def revoke_streaming_rights(world_name: str, address: str):
    '''
    Revoke streaming rights.

    Args:
        world_name (str): The name of the world in full domain format (e.g., 'snikes.dcl.eth').
        address (str): The address in lowercase to revoke streaming rights from.
    '''

    address = address.lower()

    await _update_streaming_rights('delete', world_name, address)


async def _update_streaming_rights(method: str, world_name: str, address: str):
    permission = 'streaming'
    auth_chain, timestamp = _generate_auth_chain(
        method, f'/world/{world_name}/permissions/{permission}/{address}'
    )
    headers = _generate_signed_fetch_headers(auth_chain, timestamp)
    url = f'{CONTENT_SERVER_URL}/world/{world_name}/permissions/{permission}/{address}'

    counter = 1
    while True:
        print(f"{method} {permission} rights attempt {counter}")

        response = httpx.request(method, url, headers=headers)

        if response.status_code >= 300:
            print(f"{method} {permission} rights fail")
            print(f'Error: {response.status_code}')
            if response.status_code < 500:
                print(f"{method} {permission} fail with server-side error")
                print(response.text)
                return
            await asyncio.sleep(3)
        else: break

        counter += 1
    
    print(f"{method} {permission} rights success")



def _generate_signed_fetch_headers(auth_chain: list, timestamp: int) -> dict:
    headers = {
        f'x-identity-auth-chain-{index}': json.dumps(value)
        for index, value in enumerate(auth_chain)
    }
    headers['x-identity-timestamp'] = str(timestamp)
    return headers


def _generate_auth_chain(method: str, path: str) -> tuple:
    timestamp = int(datetime.now(timezone.utc).timestamp() * 1000)
    auth_chain = [
        {'type': 'SIGNER', 'payload': OWNER_ADDRESS, 'signature': ''},
        {
            'type': 'ECDSA_EPHEMERAL',
            'payload': AUTH_CHAIN_DELEGATE_MSG,
            'signature': SIGNATURE,
        },
        {
            'type': 'ECDSA_SIGNED_ENTITY',
            'payload': f'{method}:{path}:{timestamp}:',
            'signature': '',
        },
    ]

    auth_chain[2]['signature'] = _sign_message(
        auth_chain[2]['payload'], EPHEMERAL_PRIVATE_KEY
    )

    return auth_chain, timestamp


def _sign_message(msg: str, private_key: str) -> str:
    message = encode_defunct(text=msg)
    signed_message = Web3().eth.account.sign_message(message, private_key=private_key)
    return signed_message.signature.hex()


def _current_datetime_utc(offset_days=0) -> str:
    future_time = datetime.now(timezone.utc) + timedelta(days=offset_days)
    return future_time.strftime('%Y-%m-%dT%H:%M:%S.%f')[:-3] + 'Z'
