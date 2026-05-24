"""
Cloudflare Worker 入口 - 简单版本
"""

from workers import WorkerEntrypoint, Response


class Default(WorkerEntrypoint):
    async def fetch(self, request):
        return Response(
            body='{"message":"OK"}',
            status=200,
            headers={"content-type": "application/json"},
        )
