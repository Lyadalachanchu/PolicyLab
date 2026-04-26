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

def _persona_stance(persona) -> str:
    """Derive an explicit government-trust stance from demographic attributes.

    This injects genuine prior diversity: low-income social renters have been
    burned by housing promises; high-income owners are detached; self-employed
    people distrust bureaucracy; students are idealistic, etc.
    """
    lines = []

    # Housing situation → direct stake + track record
    if persona.housing_type == "social_rent":
        lines.append(
            "You live in social housing and have direct experience with how slowly "
            "the municipality moves on housing promises. You've heard these targets before."
        )
    elif persona.housing_type == "private_rent":
        lines.append(
            "You rent privately and are squeezed by the market. You desperately want "
            "more social housing but have learned to be sceptical of delivery timelines."
        )
    else:  # owner
        lines.append(
            "You own your home. Housing policy affects your neighbourhood and property "
            "value, but you're not personally dependent on social housing delivery."
        )

    # Income → trust in government institutions
    if persona.income_quartile == "Q1":
        lines.append(
            "On a low income, you've seen how underfunded programmes get watered down. "
            "You don't expect the full ambition to survive contact with reality."
        )
    elif persona.income_quartile == "Q4":
        lines.append(
            "You're comfortable financially. You follow policy debates at a distance "
            "and tend to trust that well-designed incentive structures work as advertised."
        )

    # Employment → specific insider knowledge
    if persona.employment_status == "self_employed":
        lines.append(
            "As a self-employed person you know how slow permit processes and "
            "bureaucratic incentives are to take effect in practice."
        )
    elif persona.employment_status == "unemployed":
        lines.append(
            "Unemployed, you're acutely aware of how institutional promises rarely "
            "reach the people who need them most."
        )
    elif persona.employment_status == "student":
        lines.append(
            "As a student you're idealistic about what bold policy can achieve, "
            "though you've never personally navigated a housing waitlist."
        )
    elif persona.employment_status == "retired":
        lines.append(
            "Retired, you've lived through decades of Amsterdam housing policy and "
            "have a long memory for promises versus outcomes."
        )

    # Age → length of lived experience
    if persona.age_band in ("55-64", "65+"):
        lines.append(
            "You've watched this city change over many decades and are deeply sceptical "
            "of ambitious targets set by administrations that won't be around to be held accountable."
        )
    elif persona.age_band in ("18-24", "25-34"):
        lines.append(
            "You're young and this policy matters enormously to your near-term housing "
            "situation, making you pay close attention to whether it can actually deliver."
        )

    return " ".join(lines)

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

    stance = _persona_stance(persona)

    persona_block = (
        f"You are a citizen of {gemeente_name}.\n\n"
        f"Your story:\n{persona.narrative}\n\n"
        f"Your profile: {persona.age_band}, {persona.gender}, {income_label}, "
        f"{persona.employment_status.replace('_', ' ')}, "
        f"{persona.migration_background.replace('_', ' ')} heritage, "
        f"{persona.housing_type.replace('_', ' ')} housing.\n\n"
        f"Your relationship to this kind of policy:\n{stance}"
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

    reasoning_prompt = (
        f"{persona_block}\n\n"
        f"{policy_block}\n\n"
        f"In 4-6 sentences, speak as this person: what is your gut reaction to this policy? "
        f"Do you believe the municipality will actually deliver on its promises, given your "
        f"personal experience? What specific parts make you hopeful or sceptical? "
        f"How does your own housing situation and income affect what this policy means for you? "
        f"Be concrete and personal — not a balanced analysis, but YOUR honest reaction."
    )

    # Call 1 (Haiku): generate genuine persona reasoning — no tool, no structure.
    # This produces actually different text for each persona based on their stance.
    reasoning_response = await client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=400,
        system=_SYSTEM_BETTING,
        messages=[{"role": "user", "content": reasoning_prompt}],
    )
    persona_reasoning = reasoning_response.content[0].text.strip()

    bet_prompt = (
        f"{persona_block}\n\n"
        f"{policy_block}\n\n"
        f"Markets to bet on:\n\n{markets_block}"
    )

    # Call 2 (Sonnet): use the real reasoning as context, then force structured bets.
    # The reasoning primes Claude to stay in character for each market.
    messages = [
        {"role": "user", "content": bet_prompt},
        {"role": "assistant", "content": persona_reasoning},
        {
            "role": "user",
            "content": (
                "Staying in character with everything you just expressed, "
                "now submit your bets using the submit_bets tool. "
                "Your scepticism or optimism should be reflected in which buckets you choose."
            ),
        },
    ]

    message = await client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=4096,
        system=_SYSTEM_BETTING,
        tools=[_BET_TOOL],
        tool_choice={"type": "tool", "name": "submit_bets"},
        messages=messages,
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
