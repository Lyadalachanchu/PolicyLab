from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from models.db import Bet, Market, get_session
from services import lmsr

router = APIRouter(tags=["markets"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class BucketPrice(BaseModel):
    index: int
    label: str
    probability: float
    total_shares: float


class BetRead(BaseModel):
    id: int
    persona_id: int
    bucket_index: int
    bucket_label: str
    shares: float
    cost: float
    reason: str
    batch_index: int
    created_at: datetime

    model_config = {"from_attributes": True}


class MarketDetail(BaseModel):
    id: int
    simulation_id: int
    metric_id: str
    metric_description: str
    condition: str
    status: str
    b: float
    buckets: list[BucketPrice]
    total_bets: int
    bets: list[BetRead]


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/simulations/{simulation_id}/markets", response_model=list[MarketDetail])
async def list_markets(simulation_id: int, session: AsyncSession = Depends(get_session)):
    """All markets for a simulation with current prices. Poll this to track live progress."""
    markets = (
        await session.execute(
            select(Market)
            .where(Market.simulation_id == simulation_id)
            .options(selectinload(Market.bets))
            .order_by(Market.metric_id, Market.condition)
        )
    ).scalars().all()

    if not markets:
        raise HTTPException(status_code=404, detail="Simulation not found or has no markets")

    return [_market_detail(m) for m in markets]


@router.get("/markets/{market_id}", response_model=MarketDetail)
async def get_market(market_id: int, session: AsyncSession = Depends(get_session)):
    """Single market with current prices and all bets."""
    market = (
        await session.execute(
            select(Market)
            .where(Market.id == market_id)
            .options(selectinload(Market.bets))
        )
    ).scalar_one_or_none()

    if not market:
        raise HTTPException(status_code=404, detail="Market not found")

    return _market_detail(market)


@router.get("/markets/{market_id}/bets", response_model=list[BetRead])
async def list_bets(market_id: int, session: AsyncSession = Depends(get_session)):
    """All bets on a market, ordered by application time."""
    market = await session.get(Market, market_id)
    if not market:
        raise HTTPException(status_code=404, detail="Market not found")

    bets = (
        await session.execute(
            select(Bet)
            .where(Bet.market_id == market_id)
            .order_by(Bet.batch_index, Bet.created_at)
        )
    ).scalars().all()

    return [BetRead.model_validate(b) for b in bets]


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def _market_detail(market: Market) -> MarketDetail:
    probs = lmsr.prices(market.q_vector, market.b)
    buckets = [
        BucketPrice(
            index=i,
            label=market.bucket_labels[i],
            probability=round(probs[i], 4),
            total_shares=market.q_vector[i],
        )
        for i in range(len(market.bucket_labels))
    ]
    return MarketDetail(
        id=market.id,
        simulation_id=market.simulation_id,
        metric_id=market.metric_id,
        metric_description=market.metric_description,
        condition=market.condition,
        status=market.status,
        b=market.b,
        buckets=buckets,
        total_bets=len(market.bets),
        bets=[BetRead.model_validate(b) for b in market.bets],
    )
