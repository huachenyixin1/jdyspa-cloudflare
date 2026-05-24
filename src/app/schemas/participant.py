from dataclasses import dataclass, field
from typing import Optional


@dataclass
class ParticipantCreate:
    conference_id: int = 0
    name: str = ""
    phone: Optional[str] = ""
    email: Optional[str] = ""
    company: Optional[str] = ""
    department: Optional[str] = ""
    position: Optional[str] = ""
    title: Optional[str] = ""
    is_attending: Optional[bool] = True
    has_meal: Optional[bool] = False
    has_hotel: Optional[bool] = False
    has_transport: Optional[bool] = False


@dataclass
class ParticipantUpdate:
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    company: Optional[str] = None
    department: Optional[str] = None
    position: Optional[str] = None
    title: Optional[str] = None
    is_attending: Optional[bool] = None
    has_meal: Optional[bool] = None
    has_hotel: Optional[bool] = None
    has_transport: Optional[bool] = None


@dataclass
class BatchDeleteRequest:
    ids: list = field(default_factory=list)
