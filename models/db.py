from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, JSON, String, func
from sqlalchemy.ext.asyncio import AsyncAttrs, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

from config import settings

engine = create_async_engine(settings.database_url, echo=False)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


class Base(AsyncAttrs, DeclarativeBase):
    pass


class Gemeente(Base):
    __tablename__ = "gemeente"

    id: Mapped[int] = mapped_column(primary_key=True)
    cbs_code: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(200))
    distribution_json: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    fetched_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    generation_status: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    generation_job_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    personas: Mapped[list[Persona]] = relationship(back_populates="gemeente")
    policies: Mapped[list[Policy]] = relationship(back_populates="gemeente")


class Persona(Base):
    __tablename__ = "persona"

    id: Mapped[int] = mapped_column(primary_key=True)
    gemeente_id: Mapped[int] = mapped_column(ForeignKey("gemeente.id"), index=True)
    source: Mapped[str] = mapped_column(String(20))  # cbs_anchored | manual
    age_band: Mapped[str] = mapped_column(String(20))
    gender: Mapped[str] = mapped_column(String(20))
    income_quartile: Mapped[str] = mapped_column(String(10))
    employment_status: Mapped[str] = mapped_column(String(30))
    migration_background: Mapped[str] = mapped_column(String(30))
    housing_type: Mapped[str] = mapped_column(String(30))
    narrative: Mapped[str] = mapped_column(String(3000))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())

    gemeente: Mapped[Gemeente] = relationship(back_populates="personas")
    bets: Mapped[list[Bet]] = relationship(back_populates="persona")


class Policy(Base):
    __tablename__ = "policy"

    id: Mapped[int] = mapped_column(primary_key=True)
    gemeente_id: Mapped[int] = mapped_column(ForeignKey("gemeente.id"), index=True)
    title: Mapped[str] = mapped_column(String(300))
    description: Mapped[str] = mapped_column(String(5000))
    version: Mapped[int] = mapped_column(default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())

    gemeente: Mapped[Gemeente] = relationship(back_populates="policies")
    simulations: Mapped[list[Simulation]] = relationship(back_populates="policy")


class Simulation(Base):
    __tablename__ = "simulation"

    id: Mapped[int] = mapped_column(primary_key=True)
    policy_id: Mapped[int] = mapped_column(ForeignKey("policy.id"), index=True)
    status: Mapped[str] = mapped_column(String(20), default="pending")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    kicked_off_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    policy: Mapped[Policy] = relationship(back_populates="simulations")
    markets: Mapped[list[Market]] = relationship(back_populates="simulation")


class Market(Base):
    __tablename__ = "market"

    id: Mapped[int] = mapped_column(primary_key=True)
    simulation_id: Mapped[int] = mapped_column(ForeignKey("simulation.id"), index=True)
    metric_id: Mapped[str] = mapped_column(String(100))
    metric_description: Mapped[str] = mapped_column(String(1000))
    condition: Mapped[str] = mapped_column(String(10))   # passes | fails
    b: Mapped[float] = mapped_column()
    q_vector: Mapped[list] = mapped_column(JSON)          # list[float], LMSR state
    bucket_labels: Mapped[list] = mapped_column(JSON)     # list[str]
    status: Mapped[str] = mapped_column(String(10), default="open")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())

    simulation: Mapped[Simulation] = relationship(back_populates="markets")
    bets: Mapped[list[Bet]] = relationship(back_populates="market")


class Bet(Base):
    __tablename__ = "bet"

    id: Mapped[int] = mapped_column(primary_key=True)
    market_id: Mapped[int] = mapped_column(ForeignKey("market.id"), index=True)
    persona_id: Mapped[int] = mapped_column(ForeignKey("persona.id"), index=True)
    bucket_index: Mapped[int] = mapped_column()
    bucket_label: Mapped[str] = mapped_column(String(200))
    shares: Mapped[float] = mapped_column()
    cost: Mapped[float] = mapped_column()
    reason: Mapped[str] = mapped_column(String(2000))
    batch_index: Mapped[int] = mapped_column()
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())

    market: Mapped[Market] = relationship(back_populates="bets")
    persona: Mapped[Persona] = relationship(back_populates="bets")


async def init_db() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def get_session():
    async with AsyncSessionLocal() as session:
        yield session
