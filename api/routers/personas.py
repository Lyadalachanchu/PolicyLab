from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from models.db import Gemeente, Persona, get_session
from services.cbs import DemographicDistribution, compute_coverage

router = APIRouter(prefix="/municipalities", tags=["personas"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class GenerateRequest(BaseModel):
    n: int = Field(default=50, ge=1, le=500)


class PersonaCreate(BaseModel):
    age_band: Literal["0-17", "18-24", "25-34", "35-44", "45-54", "55-64", "65+"]
    gender: Literal["male", "female", "non-binary"]
    income_quartile: Literal["Q1", "Q2", "Q3", "Q4"]
    employment_status: Literal[
        "employed", "self_employed", "unemployed", "student", "retired", "other_inactive"
    ]
    migration_background: Literal["dutch", "western", "non_western"]
    housing_type: Literal["owner", "social_rent", "private_rent"]
    narrative: str = Field(min_length=10, max_length=3000)


class PersonaRead(BaseModel):
    id: int
    source: str
    age_band: str
    gender: str
    income_quartile: str
    employment_status: str
    migration_background: str
    housing_type: str
    narrative: str
    created_at: datetime

    model_config = {"from_attributes": True}


class PersonaListResponse(BaseModel):
    gemeente_code: str
    generation_status: Optional[str]
    persona_count: int
    personas: list[PersonaRead]
    coverage: dict  # dimension → bucket → {cbs_pct, actual_pct, count, status}
    cbs_fields_from_api: list[str]


class GenerateResponse(BaseModel):
    job_id: Optional[str]
    status: str
    n: int


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/{code}/personas/generate", response_model=GenerateResponse, status_code=202)
async def generate_personas(
    code: str,
    body: GenerateRequest,
    request: Request,
    session: AsyncSession = Depends(get_session),
):
    """Kick off async persona generation for a gemeente.

    Creates the gemeente row if it doesn't exist yet.
    Returns 409 if generation is already running.
    """
    gemeente = (
        await session.execute(select(Gemeente).where(Gemeente.cbs_code == code))
    ).scalar_one_or_none()

    if not gemeente:
        gemeente = Gemeente(cbs_code=code, name=code, generation_status="pending")
        session.add(gemeente)
        await session.flush()  # get the auto-generated id before committing

    if gemeente.generation_status == "running":
        raise HTTPException(status_code=409, detail="Generation already in progress")

    job = await request.app.state.arq.enqueue_job("generate_personas", code, body.n)

    gemeente.generation_status = "pending"
    gemeente.generation_job_id = job.job_id if job else None
    await session.commit()

    return GenerateResponse(
        job_id=job.job_id if job else None,
        status="pending",
        n=body.n,
    )


@router.get("/{code}/personas", response_model=PersonaListResponse)
async def list_personas(code: str, session: AsyncSession = Depends(get_session)):
    """Return all personas for a gemeente with per-dimension coverage stats.

    Poll this endpoint after kicking off generation — generation_status will
    transition pending → running → complete.
    """
    gemeente = (
        await session.execute(
            select(Gemeente)
            .where(Gemeente.cbs_code == code)
            .options(selectinload(Gemeente.personas))
        )
    ).scalar_one_or_none()

    if not gemeente:
        raise HTTPException(status_code=404, detail="Gemeente not found")

    distribution = (
        DemographicDistribution.from_dict(gemeente.distribution_json)
        if gemeente.distribution_json
        else None
    )
    coverage = compute_coverage(gemeente.personas, distribution) if distribution else {}
    cbs_fields = (gemeente.distribution_json or {}).get("cbs_fields_found", [])

    return PersonaListResponse(
        gemeente_code=code,
        generation_status=gemeente.generation_status,
        persona_count=len(gemeente.personas),
        personas=[PersonaRead.model_validate(p) for p in gemeente.personas],
        coverage=coverage,
        cbs_fields_from_api=cbs_fields,
    )


@router.post("/{code}/personas", response_model=PersonaRead, status_code=201)
async def add_manual_persona(
    code: str,
    body: PersonaCreate,
    session: AsyncSession = Depends(get_session),
):
    """Add a manually-authored persona to fill a coverage gap.

    The policy maker writes the narrative directly — the LLM is not involved.
    """
    gemeente = (
        await session.execute(select(Gemeente).where(Gemeente.cbs_code == code))
    ).scalar_one_or_none()

    if not gemeente:
        raise HTTPException(status_code=404, detail="Gemeente not found")

    persona = Persona(gemeente_id=gemeente.id, source="manual", **body.model_dump())
    session.add(persona)
    await session.commit()
    await session.refresh(persona)
    return PersonaRead.model_validate(persona)
