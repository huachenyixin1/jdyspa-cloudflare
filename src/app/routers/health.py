"""
健康检查路由
"""

from app.asgi_app import Router

router = Router()


@router.get("/health")
async def health_check(req):
    return {"status": "ok", "message": "服务运行中", "version": "3.0.0", "platform": "cloudflare-workers"}


@router.get("/")
async def root(req):
    return {
        "message": "会议服务管理平台 API",
        "version": "3.0.0",
        "platform": "cloudflare-workers",
    }
