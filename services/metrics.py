from __future__ import annotations

import anthropic
from pydantic import BaseModel

VALID_TAGS = ["Access", "Equity", "Finance", "Performance", "Demand", "Employment", "Housing", "Health"]

_SYSTEM = (
    "You are a policy analysis assistant for Dutch municipalities. "
    "Given a policy text, suggest concrete, measurable outcome metrics policymakers should track. "
    "Every metric must have a specific unit (people, jobs, €/year, days, %, etc.) and "
    "realistic prediction-market ranges that are mutually exclusive and exhaustive."
)

_TOOL = {
    "name": "suggest_metrics",
    "description": "Return concrete outcome metrics for evaluating the given policy.",
    "input_schema": {
        "type": "object",
        "properties": {
            "metrics": {
                "type": "array",
                "minItems": 5,
                "maxItems": 7,
                "items": {
                    "type": "object",
                    "properties": {
                        "tag": {
                            "type": "string",
                            "enum": VALID_TAGS,
                        },
                        "name": {
                            "type": "string",
                            "description": "Short, concrete metric name (e.g. 'Net jobs created', 'Average rent change')",
                        },
                        "unit": {
                            "type": "string",
                            "description": "Unit of measurement (e.g. 'jobs', '€/month', 'days', '%', 'people')",
                        },
                        "desc": {
                            "type": "string",
                            "description": "One sentence: what is counted and why it matters for this policy.",
                        },
                        "ranges": {
                            "type": "array",
                            "description": "5 betting ranges covering all realistic outcomes, from worst to best.",
                            "minItems": 4,
                            "maxItems": 6,
                            "items": {"type": "string"},
                        },
                    },
                    "required": ["tag", "name", "unit", "desc", "ranges"],
                },
            }
        },
        "required": ["metrics"],
    },
}


class MetricSuggestion(BaseModel):
    tag: str
    name: str
    unit: str
    desc: str
    ranges: list[str]


async def suggest_metrics(policy: str, client: anthropic.AsyncAnthropic) -> list[MetricSuggestion]:
    response = await client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=2048,
        system=_SYSTEM,
        tools=[_TOOL],
        tool_choice={"type": "tool", "name": "suggest_metrics"},
        messages=[{
            "role": "user",
            "content": f"Policy:\n\n{policy}",
        }],
    )

    for block in response.content:
        if block.type == "tool_use" and block.name == "suggest_metrics":
            return [MetricSuggestion(**m) for m in block.input["metrics"]]

    return []
