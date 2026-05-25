"""
Cloudflare Worker 入口 - 直接路由
"""

from workers import WorkerEntrypoint, Response
import json
from app.asgi_app import App, Router, HTTPException
from app.routers import all_routers


class Default(WorkerEntrypoint):
    async def fetch(self, request):
        # 解析 URL
        url_str = str(request.url)
        q_idx = url_str.find("?")
        full_path = url_str[:q_idx] if q_idx >= 0 else url_str
        # 提取路径（去掉域名）
        path = "/" + "/".join(full_path.split("/")[3:])
        query = url_str[q_idx+1:] if q_idx >= 0 else ""

        # 获取请求体
        body = await request.body()

        # 构建 ASGI scope
        scope = {
            "type": "http",
            "method": request.method,
            "path": path,
            "query_string": query.encode(),
            "headers": [(k.lower().encode(), v.encode()) for k, v in request.headers.items()],
            "env": self.env,
        }

        result = {"status": 500, "body": b"", "headers": []}

        async def receive():
            return {"type": "http.request", "body": body, "more_body": False}

        async def send(msg):
            if msg["type"] == "http.response.start":
                result["status"] = msg["status"]
                result["headers"] = msg["headers"]
            elif msg["type"] == "http.response.body":
                result["body"] = msg.get("body", b"")

        # 构建应用
        app = App()
        for r in all_routers:
            app.include_router(r)

        await app(scope, receive, send)

        headers = {}
        for k, v in result["headers"]:
            headers[k.decode()] = v.decode()

        return Response(body=result["body"], status=result["status"], headers=headers)
