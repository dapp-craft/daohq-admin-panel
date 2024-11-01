import asyncio

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime, timezone

from settings import config
from tools import booking_status

import booking_controller
import main_controller
import content_controller
import role_controller
import resource_controller
import ds_controller
import metrics_controller
import music_controller

import meilisearch.index_bookings

print('prefix:', config.prefix)
app = FastAPI(root_path=config.prefix)


app.include_router(booking_controller.router, tags=['bookings'])
app.include_router(main_controller.router, tags=['common'])
app.include_router(content_controller.router, tags=['content'])
app.include_router(role_controller.router, tags=['roles'])
app.include_router(resource_controller.router, tags=['resources'])
app.include_router(ds_controller.router, tags=['discord controllers'])
app.include_router(metrics_controller.router, tags=['metrics controllers'])
app.include_router(music_controller.router, tags=['music'])


app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)


def is_not_expired(iso_date):
    current_time = datetime.now(timezone.utc)
    expiration_time = datetime.fromisoformat(iso_date).replace(tzinfo=timezone.utc)

    return current_time < expiration_time


@app.on_event("startup")
async def startup_event():
    asyncio.create_task(booking_status())
