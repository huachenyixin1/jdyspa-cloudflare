from dataclasses import dataclass, field
from typing import Optional, List


@dataclass
class RestaurantCreate:
    name: str = ""
    address: Optional[str] = None
    capacity: Optional[int] = 0
    note: Optional[str] = None


@dataclass
class RestaurantUpdate:
    name: Optional[str] = None
    address: Optional[str] = None
    capacity: Optional[int] = None
    note: Optional[str] = None


@dataclass
class TableCreate:
    restaurant_id: int = 0
    name: str = ""
    table_type: str = "round"
    capacity: int = 10
    position_x: int = 0
    position_y: int = 0


@dataclass
class TableBatchCreate:
    restaurant_id: int = 0
    table_type: str = "round"
    capacity_per_table: int = 10
    quantity: int = 1
    name_prefix: str = "圆桌"


@dataclass
class TableUpdate:
    name: Optional[str] = None
    table_type: Optional[str] = None
    capacity: Optional[int] = None
    position_x: Optional[int] = None
    position_y: Optional[int] = None


@dataclass
class SeatAssignCreate:
    table_id: int = 0
    participant_id: int = 0
    meal_type: str = "lunch"
    seat_index: int = None


@dataclass
class SeatAssignDelete:
    participant_id: int = 0
    meal_type: str = "lunch"


@dataclass
class SwapAssignRequest:
    source_assignment_id: int = 0
    target_assignment_id: int = 0


@dataclass
class MoveAssignRequest:
    assignment_id: int = 0
    target_table_id: int = 0
    target_seat_index: int = 0


@dataclass
class AutoAssignRequest:
    meal_type: str = "lunch"
    arrange_mode: Optional[str] = "middle"
    priority_fields: Optional[List[str]] = None
    position_priority: Optional[dict] = None
    company_priority: Optional[dict] = None
