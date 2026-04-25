# PolicyLab

Simulate a futarchy with AI-generated citizen personas to help policy makers stress-test policies before launch — surfacing who gets left behind and how to fix it before real people are affected.

Personas bet on prediction markets tied to policy metrics. Their reasons for betting surface the qualitative "why" behind the numbers, which the policy maker can use to iterate.

## Progress

- [x] Persona creation
- [x] Creating the two markets
- [x] Betting mechanism
- [x] Persona reasons for bet choice
- [ ] Metric creation
- [ ] Suggested changes based on persona reasons + market metric outcomes
- [ ] Simulation per persona per metric
- [ ] UX

## Setup

**Prerequisites:** Python 3.11+, [uv](https://docs.astral.sh/uv/), Redis

```bash
# 1. Install dependencies
uv sync

# 2. Configure environment
cp .env.example .env
# Fill in ANTHROPIC_API_KEY in .env

# 3. Start Redis
docker run -d -p 6379:6379 redis
```

## Running

Open two terminals:

```bash
# Terminal 1 — API server
uv run uvicorn api.main:app --reload

# Terminal 2 — background worker
uv run arq workers.settings.WorkerSettings
```

API docs at `http://localhost:8000/docs`.

---

## Step 1 — Persona generation

Personas are anchored to a gemeente's real demographic distribution via CBS Open Data, so the simulation reflects who actually lives there.

```
POST /municipalities/{cbs_code}/personas/generate
Body: { "n": 50 }
```

- Fetches demographic distribution from CBS (table 83765NED) for the gemeente
- Samples `n` profiles weighted to match the census breakdown (age, gender, income, migration background, housing type)
- Claude generates a 2–3 sentence lived-experience narrative per profile
- Returns immediately; poll for status:

```
GET /municipalities/{cbs_code}/personas
```

Response includes a coverage breakdown per demographic dimension — CBS % vs actual % in the generated set — so you can see which groups are underrepresented.

To fill gaps manually:

```
POST /municipalities/{cbs_code}/personas
Body: {
  "age_band": "65+",
  "gender": "female",
  "income_quartile": "Q1",
  "employment_status": "retired",
  "migration_background": "non_western",
  "housing_type": "social_rent",
  "narrative": "..."
}
```

CBS codes follow the format `GM0363` (Amsterdam). Find yours at [opendata.cbs.nl](https://opendata.cbs.nl).

---

## Step 2 — Create a policy

```
POST /policies
Body: {
  "gemeente_code": "GM0363",
  "title": "Bicycle Infrastructure Expansion",
  "description": "..."
}
```

---

## Step 3 — Create a simulation

A simulation defines the metrics to evaluate and their prediction market buckets.

```
POST /policies/{id}/simulations
Body: {
  "metrics": [
    {
      "metric_id": "jobs_created",
      "description": "Number of new jobs created in the municipality within 2 years of implementation",
      "buckets": ["0–500", "501–1000", "1001–2000", "2001–5000", "5000+"]
    },
    {
      "metric_id": "co2_reduction",
      "description": "Reduction in CO₂ emissions (tonnes/year) within 2 years",
      "buckets": ["No reduction", "1–500 tonnes", "501–2000 tonnes", "2000+ tonnes"]
    }
  ]
}
```

Each metric automatically gets **two markets**:
- `passes` — predicted outcome if the policy is adopted
- `fails` — predicted outcome if the policy is not adopted

Markets start with a uniform probability distribution across all buckets.

---

## Step 4 — Run the simulation

```
POST /simulations/{id}/run
```

Returns immediately with a job ID. The worker:

1. Loads all personas for the gemeente
2. Sends each persona the policy description and all market bucket options
3. Claude, acting as the persona, picks a bucket for each market and gives a reason grounded in their lived context
4. Bets are processed in batches of 10 — decisions are made in parallel, then applied to the LMSR sequentially in random order within each batch
5. Each persona spends 100 points per market; the LMSR converts this to shares and updates the probability distribution

---

## Step 5 — Read the results

**All markets for a simulation:**
```
GET /simulations/{id}/markets
```

**Single market with full bet detail:**
```
GET /markets/{id}
```

Response includes per-bucket probabilities and every persona's reason for their bet:

```json
{
  "metric_description": "Number of new jobs created within 2 years",
  "condition": "passes",
  "buckets": [
    { "label": "0–500",      "probability": 0.08 },
    { "label": "501–1000",   "probability": 0.21 },
    { "label": "1001–2000",  "probability": 0.38 },
    { "label": "2001–5000",  "probability": 0.27 },
    { "label": "5000+",      "probability": 0.06 }
  ],
  "bets": [
    {
      "bucket_label": "501–1000",
      "reason": "As a part-time warehouse worker in Nieuw-West, I've seen these kinds of infrastructure schemes come and go. They create construction jobs but rarely anything permanent for people like me."
    },
    ...
  ]
}
```

**Just the bets:**
```
GET /markets/{id}/bets
```

---

## Market mechanics

Markets use the **Logarithmic Market Scoring Rule (LMSR)**. Key properties:

- Prices represent probabilities and always sum to 1 across buckets
- Each bet shifts the probability toward the chosen bucket; the magnitude depends on `b`
- `b` is calibrated per market: `b = (n_personas × 100) / (2 × log(n_buckets))`
- With 50 personas: a single bet moves a bucket by ~3–5 percentage points; full consensus reaches ~97%
- Bets within a batch are shuffled before being applied, so no persona systematically gets first-mover advantage
