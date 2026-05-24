"""
安全模块 - Cloudflare Workers 版本
使用 python-jose 和 passlib 进行认证
"""

from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext

from app.asgi_app import HTTPException
from app.core.database import get_db_from_env
from app.core.config import settings

pwd_context = CryptContext(schemes=["sha256_crypt"], deprecated="auto")

ACCESS_TOKEN_EXPIRE_HOURS = 24


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


async def get_current_user(req) -> dict:
    """从请求中获取当前用户"""
    token = req.authorization
    if not token:
        raise HTTPException(status_code=401, detail="未提供认证凭据")

    credentials_exception = HTTPException(
        status_code=401,
        detail="无法验证凭据",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise credentials_exception
        user_id = int(user_id)
    except (JWTError, ValueError, TypeError):
        raise credentials_exception

    db = get_db_from_env(req.env)
    row = await db.execute_one("SELECT * FROM users WHERE id = ?", [user_id])
    if not row:
        raise credentials_exception

    user = dict(row)
    if not user.get("is_active"):
        raise HTTPException(status_code=400, detail="用户已被禁用")
    return user


async def get_current_active_user(req) -> dict:
    """获取当前活跃用户"""
    user = await get_current_user(req)
    if not user.get("is_active"):
        raise HTTPException(status_code=400, detail="用户已被禁用")
    return user
