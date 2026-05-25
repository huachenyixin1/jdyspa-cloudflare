"""
Cloudflare Worker 入口 - 手动 ASGI 调用
"""

from workers import WorkerEntrypoint, Response


class Default(WorkerEntrypoint):
    async def fetch(self, request):
        from app.asgi_app import App
        from app.routers import all_routers

        app = App(
            title="会议服务管理平台 API",
            description="Cloudflare Workers + D1 版本",
            version="3.0.0",
        )
        for router in all_routers:
            app.include_router(router)

        # 手动构建 ASGI 调用
        url_str = str(request.url)
        idx_q = url_str.find("?")
        path = url_str[:idx_q] if idx_q >= 0 else url_str
        query = url_str[idx_q+1:] if idx_q >= 0 else ""
        # 提取路径
        slash_count = 0
        for i, c in enumerate(path):
            if c == '/':
                slash_count += 1
                if slash_count == 3:
                    path = path[i:]
                    break

        body = await request.body()
        headers = [(k.lower().encode(), v.encode()) for k, v in request.headers.items()]

        scope = {
            "type": "http",
            "method": request.method,
            "path": path,
            "query_string": query.encode(),
            "headers": headers,
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
                result["body"] = msg["body"]

        await app(scope, receive, send)

        resp_headers = {}
        for k, v in result["headers"]:
            resp_headers[k.decode()] = v.decode()

        return Response(body=result["body"], status=result["status"], headers=resp_headers)
