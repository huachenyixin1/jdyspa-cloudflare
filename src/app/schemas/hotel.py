from dataclasses import dataclass, field
from typing import Optional, List


@dataclass
class HotelCreate:
    name: str = ""
    location: Optional[str] = None
    contact: Optional[str] = None
    note: Optional[str] = None


@dataclass
class HotelUpdate:
    name: Optional[str] = None
    location: Optional[str] = None
    contact: Optional[str] = None
    note: Optional[str] = None


@dataclass
class RoomCreate:
    hotel_id: int = 0
    room_number: str = ""
    room_type: str = "single"
    floor: int = 1
    position_x: int = 0
    position_y: int = 0


@dataclass
class RoomBatchCreate:
    hotel_id: int = 0
    rooms: List[dict] = field(default_factory=list)


@dataclass
class RoomUpdate:
    room_number: Optional[str] = None
    room_type: Optional[str] = None
    floor: Optional[int] = None
    position_x: Optional[int] = None
    position_y: Optional[int] = None
    status: Optional[str] = None


@dataclass
class AssignmentCreate:
    room_id: int = 0
    participant_id: int = 0
    check_in: Optional[str] = None
    check_out: Optional[str] = None
