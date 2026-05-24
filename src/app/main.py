"""
主应用 - Cloudflare Workers 版本
"""

from app.asgi_app import App
from app.routers import all_routers

app = App(
    title="会议服务管理平台 API",
    description="Cloudflare Workers + D1 版本",
    version="3.0.0",
)

# 注册路由
for router in all_routers:
    app.include_router(router)
