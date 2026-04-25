from __future__ import annotations

import asyncio
import logging
from datetime import UTC, datetime

import anthropic
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker

from models.db import Gemeente, Persona
from services.cbs import DemographicDistribution, fetch_distribution, sample_profiles
from services.llm import generate_persona_narrative

logger = logging.getLogger(__name__)


async def generate_personas(ctx: dict, gemeente_code: str, n: int) -> dict:
    """ARQ job: CBS fetch → profile sampling → narrative generation → DB persistence."""
    session_factory: async_sessionmaker = ctx["session_factory"]
    claude: anthropic.AsyncAnthropic = ctx["claude"]

    # Mark as running
    async with session_factory() as session:
        gemeente = (
            await session.execute(select(Gemeente).where(Gemeente.cbs_code == gemeente_code))
        ).scalar_one_or_none()

        if not gemeente:
            logger.error("Gemeente %s not found — was it created before the job was enqueued?", gemeente_code)
            return {"status": "failed", "error": "gemeente not found"}

        gemeente.generation_status = "running"
        await session.commit()

    logger.info("[%s] Fetching CBS distribution", gemeente_code)
    distribution = await fetch_distribution(gemeente_code)

    async with session_factory() as session:
        gemeente = (
            await session.execute(select(Gemeente).where(Gemeente.cbs_code == gemeente_code))
        ).scalar_one()
        gemeente.distribution_json = distribution.to_dict()
        gemeente.fetched_at = datetime.now(UTC)
        if not gemeente.name or gemeente.name == gemeente_code:
            gemeente.name = distribution.gemeente_name
        await session.commit()

    # Sample demographic profiles from the distribution
    profiles = sample_profiles(distribution, n)
    logger.info("[%s] Sampled %d profiles, generating narratives", gemeente_code, n)

    # Generate narratives in parallel — cap at 10 concurrent Claude calls
    sem = asyncio.Semaphore(10)

    async def _generate_one(profile):
        async with sem:
            narrative = await generate_persona_narrative(profile, distribution.gemeente_name, claude)
            return profile, narrative

    results = await asyncio.gather(*[_generate_one(p) for p in profiles])

    # Persist all personas in a single transaction
    async with session_factory() as session:
        gemeente = (
            await session.execute(select(Gemeente).where(Gemeente.cbs_code == gemeente_code))
        ).scalar_one()

        for profile, narrative in results:
            session.add(Persona(
                gemeente_id=gemeente.id,
                source="cbs_anchored",
                age_band=profile.age_band,
                gender=profile.gender,
                income_quartile=profile.income_quartile,
                employment_status=profile.employment_status,
                migration_background=profile.migration_background,
                housing_type=profile.housing_type,
                narrative=narrative,
            ))

        gemeente.generation_status = "complete"
        await session.commit()

    logger.info("[%s] Done — persisted %d personas", gemeente_code, n)
    return {"status": "complete", "gemeente_code": gemeente_code, "count": n}
