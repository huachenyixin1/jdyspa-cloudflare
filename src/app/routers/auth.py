"""
认证路由 - D1 版本
所有数据库操作改为 D1 原生 SQL
"""

from app.asgi_app import Router, HTTPException
from datetime import datetime, timedelta
from dataclasses import dataclass
import secrets
import string

from app.core.database import get_db_from_env
from app.core.security import (
    verify_password, get_password_hash, create_access_token,
    get_current_active_user, ACCESS_TOKEN_EXPIRE_HOURS
)

router = Router(prefix="/auth")


@dataclass
class ChangePasswordRequest:
    old_password: str = ""
    new_password: str = ""


@dataclass
class ForgotPasswordRequest:
    email: str = ""


@dataclass
class ResetPasswordRequest:
    token: str = ""
    new_password: str = ""


@dataclass
class RegisterWithCode:
    username: str = ""
    email: str = ""
    password: str = ""
    invitation_code: str = ""


@dataclass
class UseInvitationCode:
    code: str = ""


@router.post("/register")
async def register(req):
    db = get_db_from_env(req.env)
    user = req.json(RegisterWithCode)

    # 检查用户名
    existing = await db.execute_one(
        "SELECT id FROM users WHERE username = ?", [user.username]
    )
    if existing:
        raise HTTPException(status_code=400, detail="用户名已存在")

    # 检查邮箱
    if user.email:
        existing_email = await db.execute_one(
            "SELECT id FROM users WHERE email = ?", [user.email]
        )
        if existing_email:
            raise HTTPException(status_code=400, detail="邮箱已被注册")

    # 验证邀请码
    invitation = await db.execute_one(
        "SELECT id, duration_days FROM invitation_codes WHERE code = ? AND status = 'unused'",
        [user.invitation_code]
    )
    if not invitation:
        raise HTTPException(status_code=400, detail="邀请码无效或已被使用")

    invitation = dict(invitation)
    now = datetime.now()
    subscription_end = now + timedelta(days=invitation["duration_days"])

    # 创建用户
    hashed_pw = get_password_hash(user.password)
    result = await db.execute_run(
        """INSERT INTO users (username, email, hashed_password, invitation_code_id, subscription_start, subscription_end)
           VALUES (?, ?, ?, ?, ?, ?)""",
        [user.username, user.email or None, hashed_pw, invitation["id"],
         now.isoformat(), subscription_end.isoformat()]
    )
    user_id = result["meta"]["last_row_id"]

    # 更新邀请码
    await db.execute_run(
        "UPDATE invitation_codes SET status = 'used', used_by = ?, used_at = ? WHERE id = ?",
        [user_id, now.isoformat(), invitation["id"]]
    )

    # 返回用户信息
    return {
        "id": user_id,
        "username": user.username,
        "email": user.email,
        "is_active": True,
        "is_superuser": False,
        "is_admin": False,
        "subscription_start": now.isoformat(),
        "subscription_end": subscription_end.isoformat(),
        "last_active_at": None,
        "created_at": now.isoformat(),
    }


@router.post("/login")
async def login(req):
    db = get_db_from_env(req.env)
    body = req.json_body
    username = body.get("username", "")
    password = body.get("password", "")

    row = await db.execute_one(
        "SELECT * FROM users WHERE username = ?", [username]
    )
    if not row:
        raise HTTPException(
            status_code=401,
            detail="用户名或密码错误",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = dict(row)
    if not verify_password(password, user["hashed_password"]):
        raise HTTPException(
            status_code=401,
            detail="用户名或密码错误",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.get("is_active"):
        raise HTTPException(status_code=400, detail="用户已被禁用")

    # 更新最后活跃时间
    now = datetime.now().isoformat()
    await db.execute_run(
        "UPDATE users SET last_active_at = ? WHERE id = ?",
        [now, user["id"]]
    )

    access_token = create_access_token(
        data={"sub": str(user["id"])},
        expires_delta=timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    )

    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/me")
async def get_me(req):
    current_user = await get_current_active_user(req)
    return {
        "id": current_user["id"],
        "username": current_user["username"],
        "email": current_user.get("email"),
        "is_active": current_user.get("is_active", True),
        "is_superuser": current_user.get("is_superuser", False),
        "is_admin": current_user.get("is_admin", False),
        "subscription_start": current_user.get("subscription_start"),
        "subscription_end": current_user.get("subscription_end"),
        "last_active_at": current_user.get("last_active_at"),
        "created_at": current_user.get("created_at"),
    }


@router.post("/change-password")
async def change_password(req):
    current_user = await get_current_active_user(req)
    db = get_db_from_env(req.env)
    request = req.json(ChangePasswordRequest)

    if not verify_password(request.old_password, current_user["hashed_password"]):
        raise HTTPException(status_code=400, detail="当前密码错误")

    if len(request.new_password) < 6:
        raise HTTPException(status_code=400, detail="新密码长度至少6位")

    new_hash = get_password_hash(request.new_password)
    await db.execute_run(
        "UPDATE users SET hashed_password = ? WHERE id = ?",
        [new_hash, current_user["id"]]
    )

    return {"message": "密码修改成功"}


@router.post("/forgot-password")
async def forgot_password(req):
    db = get_db_from_env(req.env)
    request = req.json(ForgotPasswordRequest)

    user = await db.execute_one(
        "SELECT id, username FROM users WHERE email = ?", [request.email]
    )
    if not user:
        raise HTTPException(status_code=400, detail="该邮箱未注册")

    user = dict(user)
    new_password = "123456"
    hashed_pw = get_password_hash(new_password)
    await db.execute_run(
        "UPDATE users SET hashed_password = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?",
        [hashed_pw, user["id"]]
    )

    return {"message": "密码已重置为 123456"}


@router.post("/reset-password")
async def reset_password(req):
    db = get_db_from_env(req.env)
    request = req.json(ResetPasswordRequest)

    user = await db.execute_one(
        "SELECT id, reset_token_expires FROM users WHERE reset_token = ?",
        [request.token]
    )
    if not user:
        raise HTTPException(status_code=400, detail="无效的重置链接")

    user = dict(user)
    if user.get("reset_token_expires"):
        expires = datetime.fromisoformat(user["reset_token_expires"])
        if expires < datetime.utcnow():
            raise HTTPException(status_code=400, detail="重置链接已过期，请重新申请")

    if len(request.new_password) < 6:
        raise HTTPException(status_code=400, detail="密码长度至少6位")

    hashed_pw = get_password_hash(request.new_password)
    await db.execute_run(
        "UPDATE users SET hashed_password = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?",
        [hashed_pw, user["id"]]
    )

    return {"message": "密码重置成功，请使用新密码登录"}


@router.get("/verify-reset-token")
async def verify_reset_token(req):
    db = get_db_from_env(req.env)
    token = req.query_param("token", "")

    user = await db.execute_one(
        "SELECT username, reset_token_expires FROM users WHERE reset_token = ?",
        [token]
    )
    if not user:
        return {"valid": False, "message": "无效的重置链接"}

    user = dict(user)
    if user.get("reset_token_expires"):
        expires = datetime.fromisoformat(user["reset_token_expires"])
        if expires < datetime.utcnow():
            return {"valid": False, "message": "重置链接已过期，请重新申请"}

    return {"valid": True, "username": user["username"]}


@router.post("/invitation-codes/use")
async def use_invitation_code(req):
    current_user = await get_current_active_user(req)
    db = get_db_from_env(req.env)
    request = req.json(UseInvitationCode)

    invitation = await db.execute_one(
        "SELECT id, duration_days FROM invitation_codes WHERE code = ? AND status = 'unused'",
        [request.code]
    )
    if not invitation:
        raise HTTPException(status_code=400, detail="邀请码无效或已被使用")

    invitation = dict(invitation)
    now = datetime.now()

    current_end = current_user.get("subscription_end")
    if current_end:
        try:
            end_dt = datetime.fromisoformat(current_end)
            if end_dt > now:
                new_end = end_dt + timedelta(days=invitation["duration_days"])
            else:
                new_end = now + timedelta(days=invitation["duration_days"])
        except:
            new_end = now + timedelta(days=invitation["duration_days"])
    else:
        new_end = now + timedelta(days=invitation["duration_days"])

    await db.execute_run(
        "UPDATE users SET subscription_end = ? WHERE id = ?",
        [new_end.isoformat(), current_user["id"]]
    )
    await db.execute_run(
        "UPDATE invitation_codes SET status = 'used', used_by = ?, used_at = ? WHERE id = ?",
        [current_user["id"], now.isoformat(), invitation["id"]]
    )

    return {"message": "续期成功", "subscription_end": new_end.isoformat()}


@router.post("/invitation-codes/validate")
async def validate_invitation_code(req):
    db = get_db_from_env(req.env)
    code = req.query_param("code", "")

    invitation = await db.execute_one(
        "SELECT duration_days FROM invitation_codes WHERE code = ? AND status = 'unused'",
        [code]
    )
    if not invitation:
        raise HTTPException(status_code=400, detail="邀请码无效或已被使用")

    return {"valid": True, "duration_days": dict(invitation)["duration_days"]}
