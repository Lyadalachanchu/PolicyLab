from __future__ import annotations

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from models.db import Gemeente, get_session

router = APIRouter(prefix="/municipalities", tags=["municipalities"])


class GemeenteRead(BaseModel):
    id: int
    cbs_code: str
    name: str
    generation_status: Optional[str]
    fetched_at: Optional[datetime]
    persona_count: int
    cbs_fields_found: list[str]

    model_config = {"from_attributes": True}


@router.get("/{code}", response_model=GemeenteRead)
async def get_gemeente(code: str, session: AsyncSession = Depends(get_session)):
    gemeente = (
        await session.execute(
            select(Gemeente)
            .where(Gemeente.cbs_code == code)
            .options(selectinload(Gemeente.personas))
        )
    ).scalar_one_or_none()

    if not gemeente:
        raise HTTPException(status_code=404, detail="Gemeente not found")

    dist = gemeente.distribution_json or {}
    return GemeenteRead(
        id=gemeente.id,
        cbs_code=gemeente.cbs_code,
        name=gemeente.name,
        generation_status=gemeente.generation_status,
        fetched_at=gemeente.fetched_at,
        persona_count=len(gemeente.personas),
        cbs_fields_found=dist.get("cbs_fields_found", []),
    )
