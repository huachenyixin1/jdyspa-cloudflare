"""
Cloudflare Worker 入口
"""

from workers import WorkerEntrypoint
import asgi


class Default(WorkerEntrypoint):
    async def fetch(self, request):
        from app.main import app
        return await asgi.fetch(app, request, self.env)
