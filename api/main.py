from __future__ import annotations

from contextlib import asynccontextmanager

import anthropic
from arq import create_pool
from arq.connections import RedisSettings
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from models.db import init_db
from api.routers import municipalities, metrics, personas


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    app.state.claude = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    try:
        app.state.arq = await create_pool(RedisSettings.from_dsn(settings.redis_url))
    except Exception:
        app.state.arq = None
    yield
    if app.state.arq:
        await app.state.arq.aclose()


app = FastAPI(title="PolicyLab", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(municipalities.router)
app.include_router(metrics.router)
app.include_router(personas.router)
