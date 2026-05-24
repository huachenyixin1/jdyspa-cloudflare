"""
轻量级 ASGI 框架 - 替代 FastAPI 用于 Cloudflare Workers
无外部依赖，纯 Python 标准库实现
"""

import json
import re
import io
from urllib.parse import parse_qs, unquote
from dataclasses import is_dataclass, fields
from traceback import format_exc


class HTTPException(Exception):
    def __init__(self, status_code: int = 400, detail: str = "", headers: dict = None):
        self.status_code = status_code
        self.detail = detail
        self.headers = headers or {}


class JsonResponse:
    """JSON 响应"""
    def __init__(self, data, status: int = 200, headers: dict = None):
        self.data = data
        self.status = status
        self.headers = headers or {}


class StreamingResponse:
    """流式响应"""
    def __init__(self, content, media_type: str = "text/plain", headers: dict = None):
        self.content = content  # iterable of strings
        self.media_type = media_type
        self.headers = headers or {}


class Request:
    """封装的请求对象，传递给路由处理器"""
    def __init__(self, scope: dict, body: bytes, env, db=None, user=None):
        self.method = scope["method"]
        self.path = scope["path"]
        self.headers = {k.decode(): v.decode() for k, v in scope.get("headers", [])}
        self.body_bytes = body
        self.query = parse_qs(scope.get("query_string", b"").decode())
        self.env = env
        self.db = db
        self.user = user

    @property
    def json_body(self) -> dict:
        """解析 JSON 请求体"""
        if not hasattr(self, "_json_body"):
            try:
                self._json_body = json.loads(self.body_bytes) if self.body_bytes else {}
            except (json.JSONDecodeError, ValueError):
                self._json_body = {}
        return self._json_body

    def json(self, dataclass_type=None):
        """解析请求体并可选地转为 dataclass"""
        data = self.json_body
        if dataclass_type and is_dataclass(dataclass_type):
            return dataclass_type(**{
                f.name: data.get(f.name, f.default)
                for f in fields(dataclass_type)
            })
        return data

    def query_param(self, name: str, default=None):
        """获取单个查询参数"""
        vals = self.query.get(name, [])
        return vals[0] if vals else default

    @property
    def authorization(self) -> str:
        """从请求头提取 Bearer token"""
        auth = self.headers.get("authorization", "")
        if auth.startswith("Bearer "):
            return auth[7:]
        return ""


def cors_headers():
    """返回 CORS 头"""
    return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS, PATCH",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept",
        "Access-Control-Allow-Credentials": "true",
    }


class RouteNode:
    """路由节点"""
    def __init__(self, method: str, pattern: str, handler, param_names: list):
        self.method = method
        self.handler = handler
        self.param_names = param_names
        self.regex = re.compile(pattern)


class Router:
    """路由器 - 替代 FastAPI APIRouter"""

    def __init__(self, prefix: str = ""):
        self.prefix = prefix
        self._routes = []

    def _compile_path(self, path: str):
        """将带参数的路径编译为正则表达式"""
        full_path = self.prefix + path
        # 去除尾部 /
        if full_path.endswith("/"):
            full_path = full_path.rstrip("/")

        param_names = []
        pattern_parts = []
        for segment in full_path.split("/"):
            if not segment:
                continue
            if segment.startswith("{") and segment.endswith("}"):
                name = segment[1:-1]
                param_names.append(name)
                pattern_parts.append(f"(?P<{name}>[^/]+)")
            else:
                pattern_parts.append(re.escape(segment))

        pattern = "^/" + "/".join(pattern_parts) + "$"
        return pattern, param_names

    def _add_route(self, method: str, path: str, handler):
        pattern, param_names = self._compile_path(path)
        self._routes.append(RouteNode(method, pattern, handler, param_names))

    def get(self, path: str):
        """@router.get(path) 装饰器"""
        def decorator(handler):
            self._add_route("GET", path, handler)
            return handler
        return decorator

    def post(self, path: str):
        def decorator(handler):
            self._add_route("POST", path, handler)
            return handler
        return decorator

    def put(self, path: str):
        def decorator(handler):
            self._add_route("PUT", path, handler)
            return handler
        return decorator

    def delete(self, path: str):
        def decorator(handler):
            self._add_route("DELETE", path, handler)
            return handler
        return decorator

    def match(self, method: str, path: str):
        """匹配路由"""
        for route in self._routes:
            if route.method != method:
                continue
            match = route.regex.match(path)
            if match:
                params = {name: match.group(name) for name in route.param_names}
                return route.handler, params
        return None, {}


class App:
    """ASGI 应用 - 替代 FastAPI"""

    def __init__(self, title="API", description="", version="1.0.0"):
        self.title = title
        self.description = description
        self.version = version
        self._routers = []

    def include_router(self, router: Router):
        self._routers.append(router)

    def _match(self, method: str, path: str):
        """在所有注册的路由器中查找匹配"""
        for router in self._routers:
            handler, params = router.match(method, path)
            if handler:
                return handler, params
        return None, {}

    async def _send(self, send, status: int, body, headers: dict = None):
        """发送 HTTP 响应"""
        if body is None:
            body_bytes = b""
        elif isinstance(body, str):
            body_bytes = body.encode("utf-8")
        else:
            body_bytes = json.dumps(body, ensure_ascii=False, default=str).encode("utf-8")

        resp_headers = [
            ("content-type", "application/json; charset=utf-8"),
            ("content-length", str(len(body_bytes))),
        ]
        if headers:
            for k, v in headers.items():
                resp_headers.append((k.lower(), v))

        await send({
            "type": "http.response.start",
            "status": status,
            "headers": resp_headers,
        })
        await send({
            "type": "http.response.body",
            "body": body_bytes,
        })

    async def _send_streaming(self, send, response: StreamingResponse):
        """发送流式响应（用于 CSV 下载等）"""
        # 收集所有内容
        content = "".join(response.content)
        content_bytes = content.encode("utf-8")

        resp_headers = [
            ("content-type", response.media_type),
            ("content-length", str(len(content_bytes))),
        ]
        if response.headers:
            for k, v in response.headers.items():
                resp_headers.append((k.lower(), v))

        await send({
            "type": "http.response.start",
            "status": 200,
            "headers": resp_headers,
        })
        await send({
            "type": "http.response.body",
            "body": content_bytes,
        })

    async def __call__(self, scope, receive, send):
        """ASGI 入口"""
        if scope["type"] != "http":
            return

        method = scope["method"]
        path = scope["path"]

        # OPTIONS 预检请求
        if method == "OPTIONS":
            await self._send(send, 204, None, cors_headers())
            return

        try:
            # 读取请求体
            body_bytes = b""
            more_body = True
            while more_body:
                event = await receive()
                body_bytes += event.get("body", b"")
                more_body = event.get("more_body", False)

            # 创建 Request 对象（不含 db 和 user，稍后注入）
            req = Request(scope, body_bytes, scope.get("env"))

            # 匹配路由
            handler, path_params = self._match(method, path)
            if not handler:
                await self._send(send, 404, {"detail": "Not Found"})
                return

            # 调用处理器
            result = await handler(req, **path_params)

            # 处理响应
            if isinstance(result, StreamingResponse):
                await self._send_streaming(send, result)
            else:
                await self._send(send, 200, result, cors_headers())

        except HTTPException as e:
            await self._send(send, e.status_code, {"detail": e.detail}, {**cors_headers(), **e.headers})
        except Exception as e:
            await self._send(send, 500, {"detail": f"Internal Server Error: {str(e)}"}, cors_headers())


def asgi_app_factory(app: App):
    """创建 ASGI 应用的工厂函数"""
    return app


async def asgi_fetch(app: App, workers_request, env):
    """
    将 Cloudflare Workers Request 转为 ASGI 调用
    """
    from workers import Response
    from urllib.parse import urlsplit

    # Workers 中 request.url 是字符串 (完整URL)
    url_str = str(workers_request.url)
    parsed = urlsplit(url_str)
    path = parsed.path
    query_str = parsed.query

    # 构建 ASGI scope
    scope = {
        "type": "http",
        "method": workers_request.method,
        "path": path,
        "query_string": query_str.encode(),
        "headers": [(k.lower().encode(), v.encode()) for k, v in workers_request.headers.items()],
        "env": env,
    }

    # 构建 ASGI receive 函数
    body_received = False

    async def receive():
        nonlocal body_received
        if not body_received:
            body_received = True
            body = await workers_request.body()
            return {"type": "http.request", "body": body, "more_body": False}
        return {"type": "http.disconnect"}

    # 构建 ASGI send 函数 - 收集响应
    response_data = {"status": 500, "headers": [], "body": b""}

    async def send(message):
        if message["type"] == "http.response.start":
            response_data["status"] = message["status"]
            response_data["headers"] = message["headers"]
        elif message["type"] == "http.response.body":
            response_data["body"] = message["body"]

    # 调用 ASGI 应用
    await app(scope, receive, send)

    # 转换为 Workers Response
    resp_headers = {}
    for k, v in response_data["headers"]:
        key = k.decode() if isinstance(k, bytes) else k
        val = v.decode() if isinstance(v, bytes) else v
        resp_headers[key] = val

    return Response(
        body=response_data["body"],
        status=response_data["status"],
        headers=resp_headers,
    )
