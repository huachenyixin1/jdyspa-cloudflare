"""
FastAPI 主应用 - Cloudflare Workers 版本
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import all_routers

app = FastAPI(
    title="会议服务管理平台 API",
    description="Cloudflare Workers + D1 版本",
    version="3.0.0",
)

# CORS 配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
for router in all_routers:
    app.include_router(router)


@app.get("/")
async def root():
    return {
        "message": "会议服务管理平台 API",
        "version": "3.0.0",
        "platform": "cloudflare-workers",
    }
