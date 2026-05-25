"""
Cloudflare Worker 入口 - 逐步诊断
"""

from workers import WorkerEntrypoint, Response
import json


class Default(WorkerEntrypoint):
    async def fetch(self, request):
        steps = []

        try:
            steps.append("s1:import_asgi_app")
            from app.asgi_app import App, Router, HTTPException
            steps.append("s2:import_routers")
            from app.routers import all_routers
            steps.append("s3:import_security")
            from app.core.security import verify_password, get_password_hash
            steps.append("s4:create_hash")
            h = get_password_hash("test123")
            steps.append(f"s5:verify={verify_password('test123',h)}")
            steps.append("s6:create_jwt")
            from app.core.security import create_access_token, decode_token
            t = create_access_token({"sub": "1"})
            d = decode_token(t)
            steps.append(f"s7:jwt_ok=sub={d.get('sub')}")

            return Response(
                body=json.dumps({"status": "ok", "steps": steps}),
                status=200,
                headers={"content-type": "application/json"},
            )
        except Exception as e:
            return Response(
                body=json.dumps({"status": "error", "steps": steps, "error": str(e)}),
                status=500,
                headers={"content-type": "application/json"},
            )
