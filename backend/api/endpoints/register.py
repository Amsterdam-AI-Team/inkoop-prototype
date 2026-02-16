from fastapi import FastAPI

from .health_router import router as health_router
from .auth_router import router as users_router
from .collections_router import router as collections_router
from .flows_router import router as flows_router
from .generations_router import router as generations_router
from .admin_router import router as admin_router
from .settings_router import router as settings_router


def register_routes(app: FastAPI) -> None:
    app.include_router(health_router)
    app.include_router(settings_router)
    app.include_router(users_router)
    app.include_router(collections_router)
    app.include_router(flows_router)
    app.include_router(generations_router)
    app.include_router(admin_router)
