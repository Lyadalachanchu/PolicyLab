from __future__ import annotations

import anthropic
from pydantic import BaseModel

_SYSTEM = (
    "You are a senior policy advisor for Dutch municipalities. "
    "You review citizen prediction market outcomes and suggest concrete, targeted improvements "
    "to policy text. Your changes must be specific and directly address the concerns raised."
)

_TOOL = {
    "name": "suggest_improvements",
    "description": "Identify metrics with adverse outcomes and return exact policy text changes.",
    "input_schema": {
        "type": "object",
        "properties": {
            "adverse_findings": {
                "type": "array",
                "description": "Metrics where personas predict adverse or insufficient outcomes.",
                "items": {
                    "type": "object",
                    "properties": {
                        "metric": {"type": "string"},
                        "consensus_outcome": {"type": "string"},
                        "citizen_concern": {
                            "type": "string",
                            "description": "Core concern synthesised from persona reasoning.",
                        },
                        "suggested_change": {
                            "type": "string",
                            "description": "Concrete policy change that would address this.",
                        },
                    },
                    "required": ["metric", "consensus_outcome", "citizen_concern", "suggested_change"],
                },
            },
            "policy_hunks": {
                "type": "array",
                "description": (
                    "Exact find-and-replace pairs. 'original' must be a verbatim substring of "
                    "the current policy text. Each hunk addresses one or more adverse findings."
                ),
                "items": {
                    "type": "object",
                    "properties": {
                        "original": {
                            "type": "string",
                            "description": "Exact text from the current policy to replace.",
                        },
                        "revised": {
                            "type": "string",
                            "description": "Replacement text.",
                        },
                        "reason": {
                            "type": "string",
                            "description": "Why this change addresses the citizen concern.",
                        },
                    },
                    "required": ["original", "revised", "reason"],
                },
            },
        },
        "required": ["adverse_findings", "policy_hunks"],
    },
}


class AdverseFinding(BaseModel):
    metric: str
    consensus_outcome: str
    citizen_concern: str
    suggested_change: str


class PolicyHunk(BaseModel):
    original: str
    revised: str
    reason: str


class ImprovementResult(BaseModel):
    adverse_findings: list[AdverseFinding]
    policy_hunks: list[PolicyHunk]


def apply_hunks(policy_text: str, hunks: list[PolicyHunk]) -> str:
    result = policy_text
    for hunk in hunks:
        result = result.replace(hunk.original, hunk.revised, 1)
    return result


async def suggest_improvements(
    policy_title: str,
    policy_description: str,
    markets: list[dict],
    client: anthropic.AsyncAnthropic,
) -> ImprovementResult:
    passes_markets = [m for m in markets if m["condition"] == "passes"]

    market_summaries = []
    for m in passes_markets:
        buckets = m["buckets"]
        top_bucket = max(buckets, key=lambda b: b["probability"])

        sample_reasons = [b["reason"] for b in (m.get("bets") or [])[:8]]
        reasons_text = (
            "\n".join(f"  • {r}" for r in sample_reasons)
            if sample_reasons
            else "  (no bets recorded yet)"
        )

        market_summaries.append(
            f"Metric: {m['metric_description']}\n"
            f"Predicted outcome if policy passes: {top_bucket['label']} "
            f"({top_bucket['probability'] * 100:.0f}% of personas)\n"
            f"Persona reasoning:\n{reasons_text}"
        )

    prompt = (
        f"Policy title: {policy_title}\n\n"
        f"Policy text:\n{policy_description}\n\n"
        f"---\n\n"
        f"Below are prediction market results showing what 30 citizen personas believe will "
        f"happen IF THIS POLICY PASSES. Each persona bet based on their own lived experience.\n\n"
        + "\n\n".join(market_summaries)
        + "\n\n---\n\n"
        f"Identify metrics where the predicted outcome falls short of the policy's stated goals "
        f"or represents harm. For each, synthesise the core citizen concern. Then return exact "
        f"find-and-replace hunks that improve the policy text. The 'original' field in each hunk "
        f"must be a verbatim substring of the policy text above."
    )

    response = await client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=4096,
        system=_SYSTEM,
        tools=[_TOOL],
        tool_choice={"type": "tool", "name": "suggest_improvements"},
        messages=[{"role": "user", "content": prompt}],
    )

    for block in response.content:
        if block.type == "tool_use" and block.name == "suggest_improvements":
            data = block.input
            return ImprovementResult(
                adverse_findings=[AdverseFinding(**f) for f in data["adverse_findings"]],
                policy_hunks=[PolicyHunk(**h) for h in data["policy_hunks"]],
            )

    raise ValueError("Model did not return improvements")
