"""
Cloudflare Worker 入口
"""

from workers import WorkerEntrypoint
from app.asgi_app import asgi_fetch


class Default(WorkerEntrypoint):
    async def fetch(self, request):
        from app.main import app
        return await asgi_fetch(app, request, self.env)
