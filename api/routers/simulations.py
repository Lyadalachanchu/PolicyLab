from __future__ import annotations

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from models.db import Gemeente, Market, Persona, Policy, Simulation, get_session
from services import lmsr

router = APIRouter(tags=["simulations"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class PolicyCreate(BaseModel):
    gemeente_code: str
    title: str
    description: str


class PolicyRead(BaseModel):
    id: int
    gemeente_code: str
    title: str
    description: str
    version: int
    created_at: datetime

    model_config = {"from_attributes": True}


class MetricInput(BaseModel):
    metric_id: str
    description: str
    buckets: list[str] = Field(min_length=2)


class CreateSimulationRequest(BaseModel):
    metrics: list[MetricInput] = Field(min_length=1)


class MarketSummary(BaseModel):
    id: int
    metric_id: str
    metric_description: str
    condition: str
    bucket_labels: list[str]
    probabilities: list[float]
    total_bets: int


class SimulationRead(BaseModel):
    id: int
    policy_id: int
    status: str
    created_at: datetime
    kicked_off_at: Optional[datetime]
    completed_at: Optional[datetime]
    markets: list[MarketSummary]


class RunResponse(BaseModel):
    job_id: Optional[str]
    status: str


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _market_summary(market: Market) -> MarketSummary:
    return MarketSummary(
        id=market.id,
        metric_id=market.metric_id,
        metric_description=market.metric_description,
        condition=market.condition,
        bucket_labels=market.bucket_labels,
        probabilities=lmsr.prices(market.q_vector, market.b),
        total_bets=len(market.bets),
    )


# ---------------------------------------------------------------------------
# Policy endpoints
# ---------------------------------------------------------------------------

@router.post("/policies", response_model=PolicyRead, status_code=201)
async def create_policy(body: PolicyCreate, session: AsyncSession = Depends(get_session)):
    gemeente = (
        await session.execute(
            select(Gemeente).where(Gemeente.cbs_code == body.gemeente_code)
        )
    ).scalar_one_or_none()

    if not gemeente:
        raise HTTPException(
            status_code=404,
            detail=f"Gemeente {body.gemeente_code!r} not found. Generate personas first.",
        )

    policy = Policy(
        gemeente_id=gemeente.id,
        title=body.title,
        description=body.description,
    )
    session.add(policy)
    await session.commit()
    await session.refresh(policy)

    return PolicyRead(
        id=policy.id,
        gemeente_code=gemeente.cbs_code,
        title=policy.title,
        description=policy.description,
        version=policy.version,
        created_at=policy.created_at,
    )


@router.get("/policies/{policy_id}", response_model=PolicyRead)
async def get_policy(policy_id: int, session: AsyncSession = Depends(get_session)):
    policy = await session.get(Policy, policy_id)
    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found")

    gemeente = await session.get(Gemeente, policy.gemeente_id)
    return PolicyRead(
        id=policy.id,
        gemeente_code=gemeente.cbs_code,
        title=policy.title,
        description=policy.description,
        version=policy.version,
        created_at=policy.created_at,
    )


# ---------------------------------------------------------------------------
# Simulation endpoints
# ---------------------------------------------------------------------------

@router.post("/policies/{policy_id}/simulations", response_model=SimulationRead, status_code=201)
async def create_simulation(
    policy_id: int,
    body: CreateSimulationRequest,
    session: AsyncSession = Depends(get_session),
):
    policy = await session.get(Policy, policy_id)
    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found")

    n_personas: int = await session.scalar(
        select(func.count(Persona.id)).where(Persona.gemeente_id == policy.gemeente_id)
    )
    if n_personas == 0:
        raise HTTPException(
            status_code=400,
            detail="No personas found for this gemeente. Run persona generation first.",
        )

    simulation = Simulation(policy_id=policy_id)
    session.add(simulation)
    await session.flush()  # get simulation.id before adding markets

    for metric in body.metrics:
        n_buckets = len(metric.buckets)
        b = lmsr.default_b(n_personas, n_buckets)
        for condition in ("passes", "fails"):
            session.add(Market(
                simulation_id=simulation.id,
                metric_id=metric.metric_id,
                metric_description=metric.description,
                condition=condition,
                b=b,
                q_vector=[0.0] * n_buckets,
                bucket_labels=list(metric.buckets),
            ))

    await session.commit()

    # Reload with markets and bets for the response
    sim = await _load_simulation_full(session, simulation.id)
    return _simulation_read(sim)


@router.get("/simulations/{simulation_id}", response_model=SimulationRead)
async def get_simulation(simulation_id: int, session: AsyncSession = Depends(get_session)):
    sim = await _load_simulation_full(session, simulation_id)
    if not sim:
        raise HTTPException(status_code=404, detail="Simulation not found")
    return _simulation_read(sim)


@router.post("/simulations/{simulation_id}/run", response_model=RunResponse, status_code=202)
async def run_simulation(
    simulation_id: int,
    request: Request,
    session: AsyncSession = Depends(get_session),
):
    sim = await session.get(Simulation, simulation_id)
    if not sim:
        raise HTTPException(status_code=404, detail="Simulation not found")
    if sim.status == "running":
        raise HTTPException(status_code=409, detail="Simulation already running")
    if sim.status == "complete":
        raise HTTPException(status_code=409, detail="Simulation already complete")

    job = await request.app.state.arq.enqueue_job("run_simulation", simulation_id)
    sim.status = "pending"
    await session.commit()

    return RunResponse(job_id=job.job_id if job else None, status="pending")


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

async def _load_simulation_full(session: AsyncSession, simulation_id: int) -> Simulation | None:
    result = await session.execute(
        select(Simulation)
        .where(Simulation.id == simulation_id)
        .options(selectinload(Simulation.markets).selectinload(Market.bets))
    )
    return result.scalar_one_or_none()


def _simulation_read(sim: Simulation) -> SimulationRead:
    return SimulationRead(
        id=sim.id,
        policy_id=sim.policy_id,
        status=sim.status,
        created_at=sim.created_at,
        kicked_off_at=sim.kicked_off_at,
        completed_at=sim.completed_at,
        markets=[_market_summary(m) for m in sim.markets],
    )
