"""
管理员路由 - D1 版本
"""

from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime
import secrets
import string

from app.core.database import get_db, D1Database
from app.core.security import get_current_active_user, get_password_hash

router = APIRouter(prefix="/admin", tags=["admin"])


def is_admin(user: dict) -> bool:
    return user.get("is_superuser") or user.get("is_admin")


@router.get("/users")
async def list_users(
    current_user: dict = Depends(get_current_active_user),
    db: D1Database = Depends(get_db),
):
    if not is_admin(current_user):
        raise HTTPException(status_code=403, detail="需要管理员权限")

    result = await db.execute(
        "SELECT id, username, email, is_active, is_superuser, is_admin, subscription_start, subscription_end, last_active_at, created_at FROM users ORDER BY created_at DESC",
        []
    )
    return [dict(r) for r in result["results"]]


@router.put("/users/{user_id}/toggle-active")
async def toggle_user_active(
    user_id: int,
    current_user: dict = Depends(get_current_active_user),
    db: D1Database = Depends(get_db),
):
    if not is_admin(current_user):
        raise HTTPException(status_code=403, detail="需要管理员权限")

    user = await db.execute_one("SELECT is_active FROM users WHERE id = ?", [user_id])
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")

    new_status = 0 if dict(user)["is_active"] else 1
    await db.execute_run("UPDATE users SET is_active = ? WHERE id = ?", [new_status, user_id])
    return {"message": "用户状态已更新", "is_active": bool(new_status)}


@router.post("/invitation-codes")
async def create_invitation_code(
    duration_days: int = 30,
    count: int = 1,
    current_user: dict = Depends(get_current_active_user),
    db: D1Database = Depends(get_db),
):
    if not is_admin(current_user):
        raise HTTPException(status_code=403, detail="需要管理员权限")

    codes = []
    for _ in range(count):
        code = ''.join(secrets.choices(string.ascii_uppercase + string.digits, k=8))
        await db.execute_run(
            "INSERT INTO invitation_codes (code, duration_days, created_by) VALUES (?, ?, ?)",
            [code, duration_days, current_user["id"]]
        )
        codes.append(code)

    return {"codes": codes}


@router.get("/invitation-codes")
async def list_invitation_codes(
    current_user: dict = Depends(get_current_active_user),
    db: D1Database = Depends(get_db),
):
    if not is_admin(current_user):
        raise HTTPException(status_code=403, detail="需要管理员权限")

    result = await db.execute(
        "SELECT * FROM invitation_codes ORDER BY created_at DESC",
        []
    )
    return [dict(r) for r in result["results"]]


@router.get("/stats")
async def get_admin_stats(
    current_user: dict = Depends(get_current_active_user),
    db: D1Database = Depends(get_db),
):
    if not is_admin(current_user):
        raise HTTPException(status_code=403, detail="需要管理员权限")

    user_count = await db.execute_one("SELECT COUNT(*) as cnt FROM users", [])
    conf_count = await db.execute_one("SELECT COUNT(*) as cnt FROM conferences", [])
    part_count = await db.execute_one("SELECT COUNT(*) as cnt FROM participants", [])

    return {
        "user_count": dict(user_count)["cnt"] if user_count else 0,
        "conference_count": dict(conf_count)["cnt"] if conf_count else 0,
        "participant_count": dict(part_count)["cnt"] if part_count else 0,
    }


@router.get("/system-logs")
async def get_system_logs(
    limit: int = 100,
    current_user: dict = Depends(get_current_active_user),
    db: D1Database = Depends(get_db),
):
    if not is_admin(current_user):
        raise HTTPException(status_code=403, detail="需要管理员权限")

    result = await db.execute(
        "SELECT * FROM system_logs ORDER BY created_at DESC LIMIT ?",
        [limit]
    )
    return [dict(r) for r in result["results"]]
