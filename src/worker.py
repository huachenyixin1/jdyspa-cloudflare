"""
Cloudflare Worker 入口 - FastAPI ASGI 适配
"""

from workers import WorkerEntrypoint


class Default(WorkerEntrypoint):
    async def fetch(self, request):
        import asgi
        from fastapi import FastAPI
        
        app = FastAPI()
        
        @app.get("/")
        async def root():
            return {"message": "Hello from FastAPI!"}
        
        return await asgi.fetch(app, request, self.env)
