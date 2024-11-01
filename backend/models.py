from pydantic import BaseModel, Field
from typing import Optional, List, Dict


class Booking(BaseModel):
    title: str = Field(..., max_length=150)
    description: str = Field(..., max_length=700)
    start_date: int
    duration: int
    event_date: int
    location: str


class FullBooking(BaseModel):
    id: int
    title: str
    start_date: int
    creation_date: int
    duration: int
    event_date: Optional[int]
    description: str
    owner: Optional[str]
    preview: Optional[str]
    location: str
    is_live: bool


class BookingPatch(Booking):
    owner: Optional[str] = None
    title: str = Field(..., max_length=150)
    creation_date: Optional[int] = None
    start_date: Optional[int] = None
    duration: Optional[int] = None
    event_date: Optional[int] = None
    description: str = Field(..., max_length=700)
    location: Optional[str] = None


class BookingsClosestResponse(BaseModel):
    active_bookings: List[FullBooking]
    past_booking: Optional[FullBooking]


class GetContentResponse(BaseModel):
    booking: Optional[int]
    slot: int
    type: Optional[str]
    s3_urn: Optional[str]
    location_id: str
    content_id: int
    order_id: int
    preview: Optional[str]
    resource_id: int
    name: Optional[str]


class ActiveContent(BaseModel):
    id: int
    slot: int
    type: str
    s3_urn: Optional[str] = None
    order_id: int
    preview: Optional[str] = None
    booking: Optional[int] = None


class SlotDetails(BaseModel):
    location_id: str
    location_type: str
    location_preview: Optional[str]
    slot_name: Optional[str]
    scene: str
    supports_streaming: bool
    for_booking: bool


GetSlotsResponse = Dict[int, SlotDetails]


class SocketMessage(BaseModel):
    type: str
    data: List | Dict


class PutDsScreen(BaseModel):
    guild: str
    channel: str = Field(..., max_length=120)
