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


async def init_db() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def get_session():
    async with AsyncSessionLocal() as session:
        yield session
