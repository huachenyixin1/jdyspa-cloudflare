"""
D1 数据库配置 - Cloudflare Workers 版本
共用一个 D1 数据库，通过 user_id 字段实现数据隔离
通过 FastAPI request scope 获取 env.DB 绑定
"""

import json
from fastapi import Request, Depends


class D1Database:
    """D1 数据库操作封装"""

    def __init__(self, d1_binding):
        self.d1 = d1_binding

    async def execute(self, query: str, params: list = None):
        """执行查询，返回所有结果"""
        stmt = self.d1.prepare(query)
        if params:
            stmt = stmt.bind(*params)
        result = await stmt.all()
        return result

    async def execute_one(self, query: str, params: list = None):
        """执行查询，返回第一条结果"""
        stmt = self.d1.prepare(query)
        if params:
            stmt = stmt.bind(*params)
        result = await stmt.first()
        return result

    async def execute_run(self, query: str, params: list = None):
        """执行写入操作（INSERT/UPDATE/DELETE），返回 meta 信息"""
        stmt = self.d1.prepare(query)
        if params:
            stmt = stmt.bind(*params)
        result = await stmt.run()
        return result

    async def batch(self, statements: list):
        """批量执行多条语句"""
        stmts = []
        for item in statements:
            query = item[0] if isinstance(item, (list, tuple)) else item
            params = item[1] if isinstance(item, (list, tuple)) and len(item) > 1 else None
            stmt = self.d1.prepare(query)
            if params:
                stmt = stmt.bind(*params)
            stmts.append(stmt)
        return await self.d1.batch(stmts)


async def get_db(request: Request) -> D1Database:
    """FastAPI 依赖注入：从 request scope 获取 D1 数据库实例"""
    env = request.scope.get("env")
    if env is None:
        raise RuntimeError("无法获取 Workers env，请确保通过 asgi.fetch 传递了 env")
    if not hasattr(env, "DB"):
        raise RuntimeError("D1 数据库绑定未找到，请检查 wrangler.jsonc 中的 binding 配置")
    return D1Database(env.DB)
