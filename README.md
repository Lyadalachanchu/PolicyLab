# PolicyLab

Simulate a futarchy with AI-generated citizen personas to help policy makers stress-test policies before launch — surfacing who gets left behind and how to fix it before real people are affected.

Personas bet on prediction markets tied to policy metrics. Their reasons for betting surface the qualitative "why" behind the numbers, which the policy maker can use to iterate.

---

## Quickstart

### Prerequisites

- Python 3.11+ and [uv](https://docs.astral.sh/uv/)
- Node.js 18+
- Redis ([Homebrew](https://brew.sh): `brew install redis`)

### 1. Clone and install

```bash
# Python dependencies
uv sync

# Frontend dependencies
cd frontend && npm install && cd ..
```

### 2. Configure environment

```bash
cp .env.example .env
```

Open `.env` and set your Anthropic API key:

```
ANTHROPIC_API_KEY=sk-ant-...
```

### 3. Start Redis

```bash
brew services start redis
# or, to run in the foreground:
redis-server
```

### 4. Run the application

You need **three terminals** running simultaneously:

```bash
# Terminal 1 — FastAPI backend (http://localhost:8000)
uv run uvicorn api.main:app --reload

# Terminal 2 — ARQ background worker (persona generation + simulation jobs)
uv run arq workers.settings.WorkerSettings

# Terminal 3 — Vite frontend (http://localhost:5173)
cd frontend && npm run dev
```

Open **http://localhost:5173** in your browser.

### Stopping Redis when done

```bash
brew services stop redis
```

---

## Architecture

| Component | What it does |
|-----------|-------------|
| **FastAPI** (`api/`) | REST API, serves the frontend proxy |
| **ARQ worker** (`workers/`) | Runs persona generation and simulation jobs in the background via Redis queue |
| **Vite + React** (`frontend/`) | Single-page app — the policy maker UI |
| **SQLite** (`policylab.db`) | Stores personas, policies, simulations, markets, bets |
| **Redis** | Job queue between FastAPI and the ARQ worker |

---

## How it works

1. **Municipality** — enter a CBS gemeente code (e.g. `GM0363` for Amsterdam)
2. **Personas** — generate 50 CBS-anchored synthetic residents; each gets a lived-experience narrative from Claude
3. **Policy** — write the policy text to simulate
4. **Metrics** — Claude suggests citizen-experience outcome questions (e.g. "Will it become easier to find affordable housing?"); select and customise
5. **Results** — run the simulation; each persona bets on prediction markets based on their personal perspective; results show who predicts what and where groups diverge
6. **Improve** — Claude reviews adverse outcomes and suggests targeted policy text changes ranked by impact; accept selected changes and re-run

---

## API docs

With the backend running: **http://localhost:8000/docs**
