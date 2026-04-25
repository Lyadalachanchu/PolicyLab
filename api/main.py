from __future__ import annotations

from contextlib import asynccontextmanager

from arq import create_pool
from arq.connections import RedisSettings
from fastapi import FastAPI

from config import settings
from models.db import init_db
from api.routers import municipalities, personas


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    app.state.arq = await create_pool(RedisSettings.from_dsn(settings.redis_url))
    yield
    await app.state.arq.aclose()


app = FastAPI(title="PolicyLab", version="0.1.0", lifespan=lifespan)
app.include_router(municipalities.router)
app.include_router(personas.router)
