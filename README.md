# PolicyLab

Simulate a futarchy with AI-generated citizen personas to help policy makers iterate quickly on policies before they affect real people.

## Progress

- [x] Persona creation
- [ ] Metric creation
- [ ] UX
- [ ] Creating the two markets
- [ ] Betting mechanism
- [ ] Persona reasons for bet choice
- [ ] Suggested changes based on persona reasons + market metric outcomes
- [ ] Simulation per persona per metric

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
uv run arq workers.persona_job.WorkerSettings
```

API docs available at `http://localhost:8000/docs`.

## Persona generation flow

1. `POST /municipalities/{cbs_code}/personas/generate` — kicks off a background job
2. The worker fetches demographic distribution from CBS Open Data (table 83765NED)
3. Profiles are sampled from the distribution to match the gemeente's census breakdown
4. Claude generates a 2–3 sentence lived-experience narrative per profile
5. Poll `GET /municipalities/{cbs_code}/personas` to check status and see coverage gaps
6. `POST /municipalities/{cbs_code}/personas` — add manual personas to fill underrepresented groups

CBS codes follow the format `GM0363` (Amsterdam). Find your gemeente's code at [opendata.cbs.nl](https://opendata.cbs.nl).