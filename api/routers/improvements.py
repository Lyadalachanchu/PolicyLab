from __future__ import annotations

import anthropic
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from models.db import Bet, Market, Policy, Simulation, get_session
from services.improvements import ImprovementResult, PolicyHunk, apply_hunks, suggest_improvements

router = APIRouter(tags=["improvements"])


@router.post("/simulations/{simulation_id}/improvements", response_model=ImprovementResult)
async def get_improvements(
    simulation_id: int,
    request: Request,
    session: AsyncSession = Depends(get_session),
):
    sim = await session.get(Simulation, simulation_id)
    if not sim:
        raise HTTPException(status_code=404, detail="Simulation not found")
    if sim.status != "complete":
        raise HTTPException(status_code=400, detail="Simulation must be complete before generating improvements")

    policy = await session.get(Policy, sim.policy_id)

    markets = (
        await session.execute(
            select(Market)
            .where(Market.simulation_id == simulation_id)
            .options(selectinload(Market.bets))
        )
    ).scalars().all()

    markets_data = []
    for m in markets:
        from services import lmsr
        probs = lmsr.prices(m.q_vector, m.b)
        markets_data.append({
            "condition": m.condition,
            "metric_description": m.metric_description,
            "buckets": [
                {"label": m.bucket_labels[i], "probability": probs[i]}
                for i in range(len(m.bucket_labels))
            ],
            "bets": [{"reason": b.reason} for b in m.bets],
        })

    client: anthropic.AsyncAnthropic = request.app.state.claude
    return await suggest_improvements(policy.title, policy.description, markets_data, client)
