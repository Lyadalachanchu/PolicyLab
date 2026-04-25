from __future__ import annotations

import anthropic

from services.cbs import PersonaProfile

_SYSTEM = (
    "You generate realistic, grounded citizen personas for PolicyLab, "
    "a Dutch municipal policy simulation tool. "
    "Write only the persona description — no preamble, no commentary."
)

_INCOME_LABELS = {
    "Q1": "low income (bottom 25%)",
    "Q2": "lower-middle income",
    "Q3": "upper-middle income",
    "Q4": "high income (top 25%)",
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
    employment = profile.employment_status.replace("_", " ")
    migration = profile.migration_background.replace("_", " ")
    housing = profile.housing_type.replace("_", " ")

    prompt = (
        f"Municipality: {gemeente_name}, Netherlands\n\n"
        f"Demographic profile:\n"
        f"- Age group: {profile.age_band}\n"
        f"- Gender: {profile.gender}\n"
        f"- Income: {income_label}\n"
        f"- Employment: {employment}\n"
        f"- Migration background: {migration}\n"
        f"- Housing: {housing}\n\n"
        f"Write 2-3 sentences describing this person's lived experience in {gemeente_name}. "
        f"Include their daily concerns, what they value, and their relationship with "
        f"local government and community. "
        f"Third person. Specific and grounded, not generic. No name."
    )

    message = await client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=300,
        system=_SYSTEM,
        messages=[{"role": "user", "content": prompt}],
    )
    return message.content[0].text.strip()
