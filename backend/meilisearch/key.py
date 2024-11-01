import httpx

import os
import sys

sys.path.append('..')

from settings import SYSTEM_TOKEN, MEILISEARCH_HOST


headers = {
    'Authorization': f'Bearer {SYSTEM_TOKEN}',
    'Content-Type': 'application/json',
}


public_key_payload = {
    'description': 'Public key for searching on the booking index',
    'actions': ['search'],
    'indexes': ['booking'],
    'expiresAt': None,
}

response = httpx.post(
    f'{MEILISEARCH_HOST}/keys', headers=headers, json=public_key_payload
)
public_key = response.json()['key']

current_dir = os.path.dirname(os.path.abspath(__file__))
public_key_path = os.path.join(current_dir, 'public_key.txt')

with open(public_key_path, 'w') as file:
    file.write(str(public_key))


print(f'Public Key: {public_key}')
