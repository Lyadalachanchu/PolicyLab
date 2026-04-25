from __future__ import annotations

import anthropic
from fastapi import APIRouter, Request
from pydantic import BaseModel

from services.metrics import MetricSuggestion, suggest_metrics

router = APIRouter(prefix="/metrics", tags=["metrics"])


class SuggestRequest(BaseModel):
    policy: str


@router.post("/suggest", response_model=list[MetricSuggestion])
async def suggest(body: SuggestRequest, request: Request) -> list[MetricSuggestion]:
    client: anthropic.AsyncAnthropic = request.app.state.claude
    return await suggest_metrics(body.policy, client)
