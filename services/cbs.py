from __future__ import annotations

import asyncio
import logging
import random
from dataclasses import asdict, dataclass, field
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from models.db import Persona

logger = logging.getLogger(__name__)

# Dutch national averages — fallback when CBS data is unavailable or a field is missing.
# Sources: CBS StatLine 2023 national figures.
NATIONAL_DEFAULTS: dict[str, dict[str, float]] = {
    "age_bands": {
        "0-17": 0.170,
        "18-24": 0.090,
        "25-34": 0.140,
        "35-44": 0.130,
        "45-54": 0.130,
        "55-64": 0.130,
        "65+": 0.210,
    },
    "genders": {"male": 0.495, "female": 0.505},
    "income_quartiles": {"Q1": 0.25, "Q2": 0.25, "Q3": 0.25, "Q4": 0.25},
    "employment_statuses": {
        "employed": 0.540,
        "self_employed": 0.090,
        "unemployed": 0.040,
        "student": 0.070,
        "retired": 0.180,
        "other_inactive": 0.080,
    },
    "migration_backgrounds": {
        "dutch": 0.748,
        "western": 0.094,
        "non_western": 0.158,
    },
    "housing_types": {
        "owner": 0.570,
        "social_rent": 0.290,
        "private_rent": 0.140,
    },
}

# Maps distribution dimension names → Persona attribute names
DIMENSION_TO_ATTR: dict[str, str] = {
    "age_bands": "age_band",
    "genders": "gender",
    "income_quartiles": "income_quartile",
    "employment_statuses": "employment_status",
    "migration_backgrounds": "migration_background",
    "housing_types": "housing_type",
}


@dataclass
class PersonaProfile:
    age_band: str
    gender: str
    income_quartile: str
    employment_status: str
    migration_background: str
    housing_type: str


@dataclass
class DemographicDistribution:
    gemeente_code: str
    gemeente_name: str
    age_bands: dict[str, float] = field(default_factory=dict)
    genders: dict[str, float] = field(default_factory=dict)
    income_quartiles: dict[str, float] = field(default_factory=dict)
    employment_statuses: dict[str, float] = field(default_factory=dict)
    migration_backgrounds: dict[str, float] = field(default_factory=dict)
    housing_types: dict[str, float] = field(default_factory=dict)
    # Which dimensions were populated from CBS vs national defaults
    cbs_fields_found: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict) -> DemographicDistribution:
        return cls(**data)


# ---------------------------------------------------------------------------
# CBS parsing helpers
# ---------------------------------------------------------------------------

def _normalize(d: dict[str, float]) -> dict[str, float]:
    total = sum(v for v in d.values() if v is not None and v > 0)
    if total == 0:
        return d
    return {k: (v or 0.0) / total for k, v in d.items()}


def _find_value(row: dict, *substrings: str, exclude: str | None = None) -> float | None:
    """Return the first numeric value whose key contains all substrings (case-insensitive).

    The exclude parameter skips keys that contain a given substring — used to
    distinguish e.g. 'WesterseAllochtonen' from 'NietWesterseAllochtonen'.
    """
    for key, val in row.items():
        k = key.lower()
        if exclude and exclude.lower() in k:
            continue
        if all(s.lower() in k for s in substrings):
            if val is not None:
                try:
                    return float(val)
                except (ValueError, TypeError):
                    pass
    return None


def _parse_cbs_row(row: dict, gemeente_code: str) -> DemographicDistribution:
    """Map a raw CBS kerncijfers row to a DemographicDistribution.

    CBS 83765NED uses percentage columns for most demographics.  Column names
    follow the pattern <Description>_<TableColumnNumber> (e.g. k_0Tot15Jaar_12).
    We use partial key matching so minor version changes in the suffix don't break parsing.
    """
    name = row.get("Naam_2") or row.get("Naam_1") or gemeente_code
    dist = DemographicDistribution(gemeente_code=gemeente_code, gemeente_name=str(name))
    found: list[str] = []

    # -- Age ------------------------------------------------------------------
    # CBS bands: 0-15, 15-25, 25-45, 45-65, 65+  (stored as percentages)
    # We interpolate these into our finer bands.
    p0_15 = _find_value(row, "0Tot15")
    p15_25 = _find_value(row, "15Tot25")
    p25_45 = _find_value(row, "25Tot45")
    p45_65 = _find_value(row, "45Tot65")
    p65 = _find_value(row, "65Jaar") or _find_value(row, "65JaarEn")

    if all(v is not None for v in [p0_15, p15_25, p25_45, p45_65, p65]):
        dist.age_bands = _normalize({
            "0-17":  (p0_15 or 0) * 1.20,        # 0-15 → stretch to ~0-17
            "18-24": (p15_25 or 0) * 0.70,        # lower portion of 15-25
            "25-34": (p25_45 or 0) * 0.50,
            "35-44": (p25_45 or 0) * 0.50,
            "45-54": (p45_65 or 0) * 0.50,
            "55-64": (p45_65 or 0) * 0.50,
            "65+":   (p65 or 0),
        })
        found.append("age_bands")
    else:
        dist.age_bands = NATIONAL_DEFAULTS["age_bands"].copy()

    # -- Gender ---------------------------------------------------------------
    males = _find_value(row, "Mannen")
    females = _find_value(row, "Vrouwen")
    if males is not None and females is not None:
        dist.genders = _normalize({"male": males, "female": females})
        found.append("genders")
    else:
        dist.genders = NATIONAL_DEFAULTS["genders"].copy()

    # -- Migration background -------------------------------------------------
    # CBS distinguishes: Westers (Western) and NietWesters (non-Western).
    # Dutch-heritage share = 100 - western - non_western.
    western = _find_value(row, "Westers", exclude="NietWesters")
    non_western = _find_value(row, "NietWesters")
    if western is not None and non_western is not None:
        dutch = max(0.0, 100.0 - western - non_western)
        dist.migration_backgrounds = _normalize({
            "dutch": dutch,
            "western": western,
            "non_western": non_western,
        })
        found.append("migration_backgrounds")
    else:
        dist.migration_backgrounds = NATIONAL_DEFAULTS["migration_backgrounds"].copy()

    # -- Housing type ---------------------------------------------------------
    owner = _find_value(row, "Koopwoning")
    social_rent = _find_value(row, "Corporat") or _find_value(row, "SocialeHuur")
    private_rent = _find_value(row, "OverigHuur") or _find_value(row, "VrijeSector")
    if owner is not None:
        dist.housing_types = _normalize({
            "owner": owner or 0.0,
            "social_rent": social_rent or 0.0,
            "private_rent": private_rent or max(0.0, 100.0 - (owner or 0) - (social_rent or 0)),
        })
        found.append("housing_types")
    else:
        dist.housing_types = NATIONAL_DEFAULTS["housing_types"].copy()

    # -- Income & employment --------------------------------------------------
    # CBS 83765NED doesn't expose reliable gemeente-level income quartiles or
    # detailed employment breakdowns — use national defaults for both.
    dist.income_quartiles = NATIONAL_DEFAULTS["income_quartiles"].copy()
    dist.employment_statuses = NATIONAL_DEFAULTS["employment_statuses"].copy()

    dist.cbs_fields_found = found
    return dist


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

async def fetch_distribution(gemeente_code: str) -> DemographicDistribution:
    """Fetch a gemeente's demographic distribution from CBS Open Data (table 83765NED).

    Raises on any CBS error — the caller is responsible for handling failures.
    """
    import cbsodata  # sync library — run in thread

    code = gemeente_code if gemeente_code.startswith("GM") else f"GM{gemeente_code}"

    def _fetch() -> list[dict]:
        # 83765NED: Kerncijfers wijken en buurten.
        # CBS gemeente codes have trailing spaces — startswith handles this cleanly.
        return cbsodata.get_data(
            "83765NED",
            filters=f"startswith(WijkenEnBuurten, '{code}')",
        )

    rows: list[dict] = await asyncio.to_thread(_fetch)

    if not rows:
        raise ValueError(f"CBS returned no rows for gemeente code {gemeente_code!r}")

    # Prefer gemeente-level rows; CBS mixes wijken/buurten in the same table.
    gemeente_rows = [
        r for r in rows
        if str(r.get("SoortRegio_14", "")).strip().lower() == "gemeente"
    ]
    if not gemeente_rows:
        gemeente_rows = [r for r in rows if r.get("WijkenEnBuurten", "").strip() == code]
    if not gemeente_rows:
        gemeente_rows = rows

    # Take the most recent period (lexicographic sort works for CBS period codes).
    gemeente_rows.sort(key=lambda r: str(r.get("Perioden", "")), reverse=True)
    return _parse_cbs_row(gemeente_rows[0], gemeente_code)


# ---------------------------------------------------------------------------
# Sampling
# ---------------------------------------------------------------------------

def _weighted_choice(dist: dict[str, float]) -> str:
    keys, weights = zip(*dist.items())
    return random.choices(keys, weights=weights, k=1)[0]


def sample_profiles(distribution: DemographicDistribution, n: int) -> list[PersonaProfile]:
    """Sample n persona profiles from marginal CBS distributions.

    Dimensions are sampled independently (we don't have joint CBS data).
    """
    return [
        PersonaProfile(
            age_band=_weighted_choice(distribution.age_bands),
            gender=_weighted_choice(distribution.genders),
            income_quartile=_weighted_choice(distribution.income_quartiles),
            employment_status=_weighted_choice(distribution.employment_statuses),
            migration_background=_weighted_choice(distribution.migration_backgrounds),
            housing_type=_weighted_choice(distribution.housing_types),
        )
        for _ in range(n)
    ]


# ---------------------------------------------------------------------------
# Coverage
# ---------------------------------------------------------------------------

def compute_coverage(personas: list[Persona], distribution: DemographicDistribution) -> dict:
    """Compare the current persona set against the CBS distribution per dimension.

    Returns a nested dict: dimension → bucket → {cbs_pct, actual_pct, count, status}.
    Status is "ok", "under" (< 50% of target share), or "over" (> 200% of target share).
    """
    n = len(personas)
    coverage: dict = {}

    for dim, attr in DIMENSION_TO_ATTR.items():
        cbs_dist: dict[str, float] = getattr(distribution, dim)
        counts: dict[str, int] = {}
        for p in personas:
            val: str = getattr(p, attr)
            counts[val] = counts.get(val, 0) + 1

        all_buckets = set(cbs_dist.keys()) | set(counts.keys())
        coverage[dim] = {
            bucket: {
                "cbs_pct": round(cbs_dist.get(bucket, 0.0) * 100, 1),
                "actual_pct": round((counts.get(bucket, 0) / n * 100) if n > 0 else 0.0, 1),
                "count": counts.get(bucket, 0),
                "status": _coverage_status(
                    cbs_dist.get(bucket, 0.0),
                    counts.get(bucket, 0) / n if n > 0 else 0.0,
                ),
            }
            for bucket in all_buckets
        }

    return coverage


def _coverage_status(target: float, actual: float) -> str:
    if target == 0:
        return "ok"
    ratio = actual / target
    if ratio < 0.5:
        return "under"
    if ratio > 2.0:
        return "over"
    return "ok"
