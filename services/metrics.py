from __future__ import annotations

import anthropic
from pydantic import BaseModel

VALID_TAGS = ["Access", "Equity", "Finance", "Performance", "Demand", "Employment", "Housing", "Health"]

_SYSTEM = (
    "You are a policy analysis assistant for Dutch municipalities. "
    "Suggest outcome metrics framed as plain-language questions any resident can answer "
    "from their personal lived experience — things they would directly feel or notice in daily life. "
    "Avoid bureaucratic KPIs like penalty revenues, compliance percentages, or technical targets. "
    "Good metrics ask things like: 'Will it become easier for me to find an affordable home?', "
    "'Will my rent go up because of this?', 'Will my neighbourhood feel safer or more crowded?', "
    "'Will people like me be able to stay in this city?' "
    "Buckets must use plain human-experience language — "
    "e.g. 'Much easier / Slightly easier / No change / Slightly harder / Much harder' "
    "or 'Strongly agree / Agree / Neutral / Disagree / Strongly disagree'. "
    "Never use monetary ranges, percentages, or technical measurements as buckets. "
    "Each metric should be something a social housing tenant, a young renter, AND a retired homeowner "
    "can all have a meaningful and different opinion about."
)

_TOOL = {
    "name": "suggest_metrics",
    "description": "Return citizen-experience outcome metrics for evaluating the given policy.",
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
                            "description": "A plain-language question a citizen would ask about their own life (e.g. 'Will I find affordable housing?', 'Will my rent increase?')",
                        },
                        "unit": {
                            "type": "string",
                            "description": "The experience dimension being measured (e.g. 'housing access', 'financial stress', 'neighbourhood quality', 'job security')",
                        },
                        "desc": {
                            "type": "string",
                            "description": "One sentence: what lived experience this captures, who it most affects, and why it matters for this policy.",
                        },
                        "ranges": {
                            "type": "array",
                            "description": "5 human-experience outcome levels from worst to best. Use plain language like 'Much harder', 'Slightly harder', 'No change', 'Slightly easier', 'Much easier'. Never use numbers, percentages, or monetary values.",
                            "minItems": 4,
                            "maxItems": 6,
                            "items": {"type": "string"},
                        },
                        "affected_groups": {
                            "type": "array",
                            "description": "2-4 demographic groups whose lived experience of this metric will differ most (e.g. 'Social housing tenants', 'Young renters (18-34)', 'Low-income households', 'Homeowners', 'Self-employed')",
                            "minItems": 2,
                            "maxItems": 4,
                            "items": {"type": "string"},
                        },
                    },
                    "required": ["tag", "name", "unit", "desc", "ranges", "affected_groups"],
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
    affected_groups: list[str] = []


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
