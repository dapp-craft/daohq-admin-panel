import httpx

import sys

sys.path.append('..')
from settings import SYSTEM_TOKEN, MEILISEARCH_HOST


headers = {
    'Authorization': f'Bearer {SYSTEM_TOKEN}',
    'Content-Type': 'application/json',
}

typo_tolerance_settings = {
    "minWordSizeForTypos": {"oneTypo": 4, "twoTypos": 8},
    "disableOnAttributes": [],
    "disableOnWords": [],
    "enabled": True,
}

response = httpx.patch(
    f'{MEILISEARCH_HOST}/indexes/booking/settings/typo-tolerance',
    headers=headers,
    json=typo_tolerance_settings,
)
if response.status_code < 300:
    print('Typo tolerance settings updated successfully!')
else:
    print('Error updating typo tolerance settings:', response)


filterable_attributes = ["location"]
response = httpx.put(
    f"{MEILISEARCH_HOST}/indexes/booking/settings/filterable-attributes",
    json=filterable_attributes,
    headers=headers,
)

if response.status_code < 300:
    print("Filterable attributes set successfully.")
else:
    print(f"Failed to set filterable attributes. Status code: {response.status_code}")
    print(f"Response: {response.json()}")
