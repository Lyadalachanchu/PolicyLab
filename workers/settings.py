from __future__ import annotations

import logging

import anthropic
from arq.connections import RedisSettings
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from config import settings
from workers.persona_job import generate_personas
from workers.simulation_job import run_simulation

logger = logging.getLogger(__name__)


async def startup(ctx: dict) -> None:
    engine = create_async_engine(settings.database_url, echo=False)
    ctx["session_factory"] = async_sessionmaker(engine, expire_on_commit=False)
    ctx["claude"] = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    logger.info("Worker started")


async def shutdown(ctx: dict) -> None:
    logger.info("Worker shutting down")


class WorkerSettings:
    functions = [generate_personas, run_simulation]
    on_startup = startup
    on_shutdown = shutdown
    redis_settings = RedisSettings.from_dsn(settings.redis_url)
    max_tries = 3
