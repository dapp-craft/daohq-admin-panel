import sqlite3
import httpx

import os
import sys

sys.path.append('..')
from settings import SYSTEM_TOKEN, MEILISEARCH_HOST

current_dir = os.path.dirname(os.path.abspath(__file__))
database_path = os.path.join(current_dir, '..', 'database.sqlite')


meilisearch_headers = {
    'Authorization': f'Bearer {SYSTEM_TOKEN}',
    'Content-Type': 'application/json',
}
httpx.delete(
    f'{MEILISEARCH_HOST}/indexes/booking/documents/', headers=meilisearch_headers
)


conn = sqlite3.connect(database_path)
conn.row_factory = sqlite3.Row

cursor = conn.cursor()

cursor.execute('SELECT * FROM Booking')
rows = cursor.fetchall()

documents = [dict(row) for row in rows]


url = f'{MEILISEARCH_HOST}/indexes/booking/documents'

response = httpx.post(url, headers=meilisearch_headers, json=documents)
if response.status_code == 202:
    print('Data indexed successfully!')
else:
    print('Error indexing data:', response.json())


conn.close()

import meilisearch.index_setup
import meilisearch.key
