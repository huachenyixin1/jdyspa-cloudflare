"""
健康检查路由
"""

from fastapi import APIRouter

router = APIRouter(tags=["health"])


@router.get("/health")
async def health_check():
    return {"status": "ok", "message": "服务运行中", "version": "3.0.0", "platform": "cloudflare-workers"}
