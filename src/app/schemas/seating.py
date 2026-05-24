from dataclasses import dataclass, field
from typing import Optional, List


@dataclass
class AreaCreate:
    name: str = ""
    area_type: str = ""
    config: dict = field(default_factory=dict)
    position_x: Optional[int] = 0
    position_y: Optional[int] = 0


@dataclass
class AreaUpdate:
    name: Optional[str] = None
    area_type: Optional[str] = None
    config: Optional[dict] = None
    position_x: Optional[int] = None
    position_y: Optional[int] = None
    scale: Optional[float] = None


@dataclass
class AreaPositionUpdate:
    position_x: int = 0
    position_y: int = 0
    scale: Optional[float] = None


@dataclass
class SeatAssign:
    area_id: int = 0
    participant_id: int = 0
    seat_number: Optional[str] = None


@dataclass
class SwapRequest:
    assignment_id_1: int = 0
    assignment_id_2: int = 0


@dataclass
class AutoAssignRequest:
    mode: Optional[str] = "middle"
    priorities: Optional[list] = None


@dataclass
class PriorityConfig:
    arrange_mode: Optional[str] = "middle"
    priority_fields: Optional[list] = None
    position_priority: Optional[dict] = None
    company_priority: Optional[dict] = None
