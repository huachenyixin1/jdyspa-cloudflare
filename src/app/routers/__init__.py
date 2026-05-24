from .health import router as health_router
from .auth import router as auth_router
from .conferences import router as conferences_router
from .participants import router as participants_router
from .seating import router as seating_router
from .hotels import router as hotels_router
from .restaurants import router as restaurants_router
from .transport import router as transport_router
from .admin import router as admin_router

all_routers = [
    health_router,
    auth_router,
    conferences_router,
    participants_router,
    seating_router,
    hotels_router,
    restaurants_router,
    transport_router,
    admin_router,
]
