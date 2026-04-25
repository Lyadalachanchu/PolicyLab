from __future__ import annotations

import asyncio
import logging
import random
from datetime import UTC, datetime

import anthropic
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
from sqlalchemy.orm import selectinload
from sqlalchemy.orm.attributes import flag_modified

from models.db import Bet, Gemeente, Market, Persona, Policy, Simulation
from services import lmsr
from services.llm import generate_bets

logger = logging.getLogger(__name__)

_BATCH_SIZE = 10
_PERSONA_BUDGET = 100.0


async def run_simulation(ctx: dict, simulation_id: int) -> dict:
    """ARQ job: run all persona bets for a simulation.

    Flow per batch:
      1. Generate bets in parallel (LLM calls, one per persona).
      2. Shuffle the batch to randomise LMSR application order.
      3. Apply bets to each market sequentially — no concurrency within a batch.
      4. Commit. Repeat.
    """
    session_factory: async_sessionmaker = ctx["session_factory"]
    claude: anthropic.AsyncAnthropic = ctx["claude"]

    # --- Mark running ---
    async with session_factory() as session:
        sim = await session.get(Simulation, simulation_id)
        if not sim:
            raise ValueError(f"Simulation {simulation_id} not found")
        sim.status = "running"
        sim.kicked_off_at = datetime.now(UTC)
        await session.commit()

    # --- Load all static data once ---
    async with session_factory() as session:
        sim = await _load_simulation(session, simulation_id)
        policy = await session.get(Policy, sim.policy_id)
        gemeente = await session.get(Gemeente, policy.gemeente_id)

        personas: list[Persona] = (
            await session.execute(
                select(Persona).where(Persona.gemeente_id == policy.gemeente_id)
            )
        ).scalars().all()

        markets: list[Market] = (
            await session.execute(
                select(Market).where(Market.simulation_id == simulation_id)
            )
        ).scalars().all()

    if not personas:
        raise ValueError(
            f"No personas found for gemeente {gemeente.cbs_code}. "
            "Generate personas before running a simulation."
        )

    n = len(personas)
    logger.info("[sim:%d] Starting — %d personas, %d markets", simulation_id, n, len(markets))

    # --- Batch loop ---
    for batch_start in range(0, n, _BATCH_SIZE):
        batch = personas[batch_start: batch_start + _BATCH_SIZE]
        batch_idx = batch_start // _BATCH_SIZE

        # 1. Generate bets in parallel
        sem = asyncio.Semaphore(_BATCH_SIZE)

        async def _bet_for_persona(persona: Persona) -> tuple[Persona, list[dict]]:
            async with sem:
                bets = await generate_bets(persona, policy, markets, gemeente.name, claude)
                return persona, bets

        logger.info("[sim:%d] Batch %d — generating bets", simulation_id, batch_idx)
        batch_results: list[tuple[Persona, list[dict]]] = list(
            await asyncio.gather(*[_bet_for_persona(p) for p in batch])
        )

        # 2. Shuffle application order within the batch
        random.shuffle(batch_results)

        # 3. Apply bets to LMSR sequentially, commit whole batch atomically
        async with session_factory() as session:
            market_map: dict[int, Market] = {
                m.id: m
                for m in (
                    await session.execute(
                        select(Market).where(Market.simulation_id == simulation_id)
                    )
                ).scalars().all()
            }

            for persona, persona_bets in batch_results:
                for bet_data in persona_bets:
                    market = market_map[bet_data["market_id"]]
                    bucket_index: int = bet_data["bucket_index"]

                    new_q, shares, actual_cost = lmsr.apply_bet(
                        market.q_vector, market.b, bucket_index, _PERSONA_BUDGET
                    )
                    market.q_vector = new_q
                    flag_modified(market, "q_vector")  # JSON column needs explicit flag

                    session.add(Bet(
                        market_id=market.id,
                        persona_id=persona.id,
                        bucket_index=bucket_index,
                        bucket_label=market.bucket_labels[bucket_index],
                        shares=shares,
                        cost=actual_cost,
                        reason=bet_data["reason"],
                        batch_index=batch_idx,
                    ))

            await session.commit()
            logger.info("[sim:%d] Batch %d committed", simulation_id, batch_idx)

    # --- Mark complete ---
    async with session_factory() as session:
        sim = await session.get(Simulation, simulation_id)
        sim.status = "complete"
        sim.completed_at = datetime.now(UTC)
        await session.commit()

    logger.info("[sim:%d] Complete", simulation_id)
    return {"status": "complete", "simulation_id": simulation_id}


async def _load_simulation(session: AsyncSession, simulation_id: int) -> Simulation:
    result = await session.execute(
        select(Simulation)
        .where(Simulation.id == simulation_id)
        .options(selectinload(Simulation.markets))
    )
    sim = result.scalar_one_or_none()
    if not sim:
        raise ValueError(f"Simulation {simulation_id} not found")
    return sim
