"""
Cloudflare Worker 入口 - 测试 ASGI
"""

from workers import WorkerEntrypoint
import asgi


async def simple_app(scope, receive, send):
    """最简单的 ASGI 应用"""
    body = b'{"status":"ok","message":"ASGI works!"}'
    await send({
        "type": "http.response.start",
        "status": 200,
        "headers": [
            (b"content-type", b"application/json"),
            (b"content-length", str(len(body)).encode()),
        ],
    })
    await send({
        "type": "http.response.body",
        "body": body,
    })


class Default(WorkerEntrypoint):
    async def fetch(self, request):
        return await asgi.fetch(simple_app, request, self.env)
