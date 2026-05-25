"""
安全模块 - Cloudflare Workers 版本
纯 Python 标准库实现，兼容 Pyodide（WebAssembly）
替代 passlib + python-jose
"""

import hashlib
import hmac
import base64
import os
import json
import time
from datetime import timedelta

from app.asgi_app import HTTPException
from app.core.database import get_db_from_env
from app.core.config import settings

ACCESS_TOKEN_EXPIRE_HOURS = 24


# ===== 密码哈希（替代 passlib） =====

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """验证密码"""
    if not hashed_password:
        return False

    try:
        parts = hashed_password.split("$")
        if len(parts) != 4 or parts[0] != "pbkdf2_sha256":
            return False
        _, iterations_str, salt_b64, stored_hash = parts
        iterations = int(iterations_str)
        new_hash = hashlib.pbkdf2_hmac(
            "sha256",
            plain_password.encode("utf-8"),
            base64.b64decode(salt_b64),
            iterations,
        )
        return hmac.compare_digest(
            base64.b64encode(new_hash).decode("ascii"),
            stored_hash,
        )
    except Exception:
        return False


def get_password_hash(password: str) -> str:
    """生成密码哈希（PBKDF2-SHA256，纯 Python）"""
    salt = base64.b64encode(os.urandom(16)).decode("ascii")
    iterations = 100000
    hashed = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        base64.b64decode(salt),
        iterations,
    )
    return f"pbkdf2_sha256${iterations}${salt}${base64.b64encode(hashed).decode('ascii')}"


# ===== JWT（替代 python-jose） =====

def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _b64url_decode(s: str) -> bytes:
    padding = 4 - len(s) % 4
    s += "=" * padding
    return base64.urlsafe_b64decode(s)


def create_access_token(data: dict, expires_delta: timedelta = None) -> str:
    """创建 JWT token"""
    to_encode = data.copy()
    expire = time.time() + (
        expires_delta.total_seconds() if expires_delta
        else ACCESS_TOKEN_EXPIRE_HOURS * 3600
    )
    to_encode["exp"] = expire

    header = _b64url_encode(json.dumps({"alg": "HS256", "typ": "JWT"}).encode())
    payload = _b64url_encode(json.dumps(to_encode, default=str).encode())
    signature = _b64url_encode(
        hmac.new(
            settings.JWT_SECRET_KEY.encode(),
            f"{header}.{payload}".encode(),
            hashlib.sha256,
        ).digest()
    )
    return f"{header}.{payload}.{signature}"


def decode_token(token: str) -> dict:
    """解码并验证 JWT token"""
    try:
        parts = token.split(".")
        if len(parts) != 3:
            raise ValueError("Invalid token format")

        header_b64, payload_b64, signature_b64 = parts

        expected_sig = _b64url_encode(
            hmac.new(
                settings.JWT_SECRET_KEY.encode(),
                f"{header_b64}.{payload_b64}".encode(),
                hashlib.sha256,
            ).digest()
        )
        if not hmac.compare_digest(signature_b64, expected_sig):
            raise ValueError("Invalid signature")

        data = json.loads(_b64url_decode(payload_b64))
        if data.get("exp", 0) < time.time():
            raise ValueError("Token expired")

        return data
    except Exception:
        raise ValueError("Invalid token")


# ===== 用户认证 =====

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
        payload = decode_token(token)
        user_id = payload.get("sub")
        if user_id is None:
            raise credentials_exception
        user_id = int(user_id)
    except (ValueError, TypeError):
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
