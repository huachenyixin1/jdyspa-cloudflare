from dataclasses import dataclass, field
from typing import Optional


@dataclass
class UserBase:
    username: str = ""
    email: Optional[str] = None


@dataclass
class UserCreate:
    username: str = ""
    email: Optional[str] = None
    password: str = ""


@dataclass
class UserLogin:
    username: str = ""
    password: str = ""


@dataclass
class UserResponse:
    id: int = 0
    username: str = ""
    email: Optional[str] = None
    is_active: bool = True
    is_superuser: bool = False
    is_admin: bool = False
    subscription_start: Optional[str] = None
    subscription_end: Optional[str] = None
    last_active_at: Optional[str] = None
    created_at: Optional[str] = None


@dataclass
class Token:
    access_token: str = ""
    token_type: str = "bearer"


@dataclass
class TokenData:
    user_id: Optional[int] = None
