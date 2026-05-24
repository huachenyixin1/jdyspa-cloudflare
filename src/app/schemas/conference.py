from dataclasses import dataclass, field
from typing import Optional


@dataclass
class ConferenceCreate:
    title: str = ""
    scale: int = 0
    start_date: str = ""
    end_date: str = ""
    location: str = ""
    schedule: str = ""
    purpose: str = ""
    has_meal: bool = False
    has_hotel: bool = False
    has_transport: bool = False


@dataclass
class ConferenceUpdate:
    title: Optional[str] = None
    date: Optional[str] = None
    scale: Optional[int] = None
    purpose: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    location: Optional[str] = None
    schedule: Optional[str] = None
    has_meal: Optional[bool] = None
    has_hotel: Optional[bool] = None
    has_transport: Optional[bool] = None
