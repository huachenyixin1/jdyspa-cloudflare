from dataclasses import dataclass, field
from typing import Optional, List


@dataclass
class VehicleCreate:
    plate: str = ""
    model: str = ""
    seats: int = 0
    driver_name: Optional[str] = None
    driver_phone: Optional[str] = None


@dataclass
class VehicleUpdate:
    plate: Optional[str] = None
    model: Optional[str] = None
    seats: Optional[int] = None
    driver_name: Optional[str] = None
    driver_phone: Optional[str] = None


@dataclass
class TaskCreate:
    vehicle_id: int = 0
    task_type: str = ""
    task_date: str = ""
    start_time: str = ""
    end_time: str = ""
    from_location: str = ""
    from_lat: Optional[float] = None
    from_lng: Optional[float] = None
    to_location: str = ""
    to_lat: Optional[float] = None
    to_lng: Optional[float] = None
    participant_ids: List[int] = field(default_factory=list)
    escort_name: Optional[str] = None
    escort_phone: Optional[str] = None
    note: Optional[str] = None


@dataclass
class TaskUpdate:
    vehicle_id: Optional[int] = None
    task_type: Optional[str] = None
    task_date: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    from_location: Optional[str] = None
    from_lat: Optional[float] = None
    from_lng: Optional[float] = None
    to_location: Optional[str] = None
    to_lat: Optional[float] = None
    to_lng: Optional[float] = None
    participant_ids: Optional[List[int]] = None
    escort_name: Optional[str] = None
    escort_phone: Optional[str] = None
    note: Optional[str] = None


@dataclass
class TaskStatusUpdate:
    status: str = ""
    lat: Optional[float] = None
    lng: Optional[float] = None
