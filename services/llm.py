from __future__ import annotations

from typing import TYPE_CHECKING

import anthropic

from services.cbs import PersonaProfile

if TYPE_CHECKING:
    from models.db import Market, Persona, Policy

_SYSTEM_PERSONA = (
    "You generate realistic, grounded citizen personas for PolicyLab, "
    "a Dutch municipal policy simulation tool. "
    "Write only the persona description — no preamble, no commentary."
)

_SYSTEM_BETTING = (
    "You are a Dutch citizen participating in a policy simulation. "
    "Bet on prediction markets based solely on your lived experience and perspective."
)

_INCOME_LABELS = {
    "Q1": "low income (bottom 25%)",
    "Q2": "lower-middle income",
    "Q3": "upper-middle income",
    "Q4": "high income (top 25%)",
}

_BET_TOOL: dict = {
    "name": "submit_bets",
    "description": "Submit your bets for all prediction markets listed.",
    "input_schema": {
        "type": "object",
        "properties": {
            "bets": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "market_id": {
                            "type": "integer",
                            "description": "The market ID to bet on.",
                        },
                        "bucket_index": {
                            "type": "integer",
                            "description": "Zero-based index of your chosen bucket.",
                        },
                        "reason": {
                            "type": "string",
                            "description": (
                                "2-3 sentences explaining why you chose this outcome, "
                                "from your personal lived perspective."
                            ),
                        },
                    },
                    "required": ["market_id", "bucket_index", "reason"],
                },
            }
        },
        "required": ["bets"],
    },
}


async def generate_persona_narrative(
    profile: PersonaProfile,
    gemeente_name: str,
    client: anthropic.AsyncAnthropic,
) -> str:
    """Generate a 2-3 sentence lived-experience narrative for a demographic profile.

    The demographic profile is fully determined before this call — the LLM only
    adds texture, it does not decide who exists.
    """
    income_label = _INCOME_LABELS.get(profile.income_quartile, profile.income_quartile)

    prompt = (
        f"Municipality: {gemeente_name}, Netherlands\n\n"
        f"Demographic profile:\n"
        f"- Age group: {profile.age_band}\n"
        f"- Gender: {profile.gender}\n"
        f"- Income: {income_label}\n"
        f"- Employment: {profile.employment_status.replace('_', ' ')}\n"
        f"- Migration background: {profile.migration_background.replace('_', ' ')}\n"
        f"- Housing: {profile.housing_type.replace('_', ' ')}\n\n"
        f"Write 2-3 sentences describing this person's lived experience in {gemeente_name}. "
        f"Include their daily concerns, what they value, and their relationship with "
        f"local government and community. "
        f"Third person. Specific and grounded, not generic. No name."
    )

    message = await client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=300,
        system=_SYSTEM_PERSONA,
        messages=[{"role": "user", "content": prompt}],
    )
    return message.content[0].text.strip()


async def generate_bets(
    persona: Persona,
    policy: Policy,
    markets: list[Market],
    gemeente_name: str,
    client: anthropic.AsyncAnthropic,
) -> list[dict]:
    """Generate bets for all markets for a single persona in one LLM call.

    Returns a list of dicts: [{market_id, bucket_index, reason}, ...].
    Raises if the model doesn't return bets for every expected market.
    """
    income_label = _INCOME_LABELS.get(persona.income_quartile, persona.income_quartile)

    persona_block = (
        f"You are a citizen of {gemeente_name}.\n\n"
        f"About you:\n{persona.narrative}\n\n"
        f"Profile: {persona.age_band}, {persona.gender}, {income_label}, "
        f"{persona.employment_status.replace('_', ' ')}, "
        f"{persona.migration_background.replace('_', ' ')} heritage, "
        f"{persona.housing_type.replace('_', ' ')} housing."
    )

    policy_block = f"Policy being evaluated:\n**{policy.title}**\n{policy.description}"

    markets_block_parts = []
    for market in markets:
        condition_label = "IF POLICY PASSES" if market.condition == "passes" else "IF POLICY FAILS"
        buckets_text = "\n".join(
            f"  {i}: {label}" for i, label in enumerate(market.bucket_labels)
        )
        markets_block_parts.append(
            f"Market {market.id} [{condition_label}]\n"
            f"Metric: {market.metric_description}\n"
            f"Buckets:\n{buckets_text}"
        )

    markets_block = "\n\n".join(markets_block_parts)

    prompt = (
        f"{persona_block}\n\n"
        f"{policy_block}\n\n"
        f"You have 100 points to bet on each market below. "
        f"For each market, choose the bucket you think is most likely "
        f"and explain your reasoning from your personal perspective.\n\n"
        f"{markets_block}"
    )

    message = await client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1500,
        system=_SYSTEM_BETTING,
        tools=[_BET_TOOL],
        tool_choice={"type": "tool", "name": "submit_bets"},
        messages=[{"role": "user", "content": prompt}],
    )

    bets: list[dict] = []
    for block in message.content:
        if block.type == "tool_use" and block.name == "submit_bets":
            bets = block.input["bets"]
            break
    else:
        raise ValueError(
            f"Model did not call submit_bets for persona {persona.id}"
        )

    # Validate all expected markets are covered
    expected_ids = {m.id for m in markets}
    returned_ids = {bet["market_id"] for bet in bets}
    if expected_ids != returned_ids:
        missing = expected_ids - returned_ids
        extra = returned_ids - expected_ids
        raise ValueError(
            f"Bet coverage mismatch for persona {persona.id}: "
            f"missing={missing}, extra={extra}"
        )

    # Validate bucket indices
    market_bucket_counts = {m.id: len(m.bucket_labels) for m in markets}
    for bet in bets:
        n = market_bucket_counts[bet["market_id"]]
        if not (0 <= bet["bucket_index"] < n):
            raise ValueError(
                f"Persona {persona.id} bet bucket_index={bet['bucket_index']} "
                f"on market {bet['market_id']} which only has {n} buckets"
            )

    return bets
