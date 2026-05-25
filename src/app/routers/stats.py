from app.asgi_app import Router

router = Router()


@router.get("/stats")
async def get_stats(req):
    return {"message": "Stats - TODO: implement with D1"}
