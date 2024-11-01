import aioboto3
from dynaconf import Dynaconf
from datetime import datetime
from web3 import Web3


config = Dynaconf(
    envvar_prefix='DYNACONF',
    env_switcher='ENVIRONMENT',
    env='DEVELOPOMENT',  # default environment
)

# config.ENV_FOR_DYNACONF = 'DEVELOPMENT' | 'TESTING' | 'PRODUCTION'
print(f"Dynaconf environment: {config.ENV_FOR_DYNACONF}")

config = Dynaconf(
    load_dotenv=True,
    envvar_prefix='DYNACONF',
    env_switcher='ENVIRONMENT',
    settings_files=[
        'config/config.toml',
        f'config/{config.ENV_FOR_DYNACONF.lower()}.toml',
    ],
)


COMMIT_HASH = config.get('COMMIT_HASH')

DS_CLIENT_SECRET = config.get('DS_CLIENT_SECRET')

PRIVATE_KEY = config.W3_PRIVATE_KEY
JWT_SECRET = config.JWT_SECRET
INFURA_KEY = config.get('INFURA_KEY')

SYSTEM_TOKEN = config.get('SYSTEM_TOKEN')
SYSTEM_OUT_TOKEN = config.get('SYSTEM_OUT_TOKEN')

DEFAULT_IMAGE = config.get('DEFAULT_IMAGE')
DEFAULT_PREVIEW = config.get('DEFAULT_PREVIEW')
DEFAULT_MUSIC = config.get('DEFAULT_PREVIEW')

MIN_BOOKING_TIME = config.get('MIN_BOOKING_TIME')
MAX_BOOKING_TIME = config.get('MAX_BOOKING_TIME')

# limit for every 30 minutes of booking
CONTENT_LIMIT = config.get('CONTENT_LIMIT')
MUSIC_LIMIT = config.get('MUSIC_LIMIT')

MAX_FILE_SIZE = 1 * 1024 * 1024

w3 = Web3(
    Web3.HTTPProvider(f'https://goerli.infura.io/v3/{INFURA_KEY}')
)
account = w3.eth.account.from_key(PRIVATE_KEY)

FILES_BUCKET_NAME = config.s3.files_bucket_name
USER_FILES_BUCKET_NAME = config.s3.user_files_bucket_name
FILES_BUCKET_FOLDER = (
    config.ENV_FOR_DYNACONF.lower()
    if not config.ENV_FOR_DYNACONF == 'DEVELOPMENT'
    else 'testing'
)

MEILISEARCH_HOST = 'http://localhost:7700'

# delegate streaming rights
OWNER_ADDRESS = hex(config.get('OWNER_ADDRESS'))
EPHEMERAL_PRIVATE_KEY = config.get('EPHEMERAL_PRIVATE_KEY')
SIGNATURE = hex(config.get('SIGNATURE'))
EXPIRATION = config.get('EXPIRATION').strftime('%Y-%m-%dT%H:%M:%S.%f')[:-3] + 'Z'

aws_session = aioboto3.Session()
