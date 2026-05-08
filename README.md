# AeroFlux AI

[![Python](https://img.shields.io/badge/Python-3.11+-blue.svg)](https://python.org)
[![React](https://img.shields.io/badge/React-18.3+-61DAFB.svg)](https://react.dev)
[![FastAPI](https://img.shields.io/badge/FastAPI-009688.svg)](https://fastapi.tiangolo.com)
[![Docker](https://img.shields.io/badge/Docker-2496ED.svg)](https://docker.com)

**AI-Powered Flight Decision Support System** — A multi-agent platform for real-time flight monitoring, weather analysis, fuel optimization, and automated pilot recommendations.

**Live demo: [https://aeroflux.site](https://aeroflux.site)**

---

## Overview

AeroFlux simulates a next-generation Flight Operations Center. Five AI agents run in parallel each simulation tick, analyzing weather, fuel, ATC constraints, and passenger comfort before a Supervisor agent arbitrates and delivers a single prioritized recommendation to the pilot via the dashboard.

The system supports both **live flight tracking** via OpenSky Network and **synthetic simulation** for demonstration. The default simulation flies a realistic 3,616 NM London Heathrow → New Delhi great-circle route as British Airways flight BA008.

### Key Features

- **Multi-Agent AI** — Weather, Fuel, ATC, Comfort, and Supervisor agents run in parallel each tick via `asyncio.gather`
- **LLM-Powered Reasoning** — Each agent calls Groq or Ollama via LiteLLM for structured JSON analysis; rule-based fallback when LLM is unavailable
- **Real-Time WebSocket Feed** — Backend broadcasts snapshots, recommendations, and agent messages over `/ws/live`
- **Mapbox Globe** — Interactive 3D map with aircraft marker, great-circle route arcs, ATC traffic with proximity alerts, and animated weather cell polygons
- **Route Comparison** — Planned route (Eastern Europe headwind) vs. southern alternate (subtropical jet tailwind), with live fuel and ETA deltas
- **Event Injection** — Inject Turbulence, Headwind, ATC Hold, or Engine Alert mid-flight from the header
- **Selectable Sim Speed** — 1×, 2×, or 4× simulation speed multiplier
- **Amber Route Preview** — Recommended alternate route rendered as a dashed amber arc before the pilot accepts

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        AeroFlux AI                          │
│                                                             │
│  React Frontend (Mapbox GL)  ◄──WebSocket──►  FastAPI       │
│         (port 8080)                           (port 8000)   │
│                                                    │        │
│              ┌─────────────────────────────────────┘        │
│              ▼                                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                  Agent Cycle Runner                   │  │
│  │  WeatherAgent  FuelAgent  ATCAgent  ComfortAgent      │  │
│  │           └──────────────────┘                        │  │
│  │                     SupervisorAgent                   │  │
│  └───────────────────────────────────────────────────────┘  │
│              │                                              │
│   OpenSky Network · Aviation Weather API · Open-Meteo       │
│   Ollama / Groq (LiteLLM)                                   │
└─────────────────────────────────────────────────────────────┘
```

---

## Quick Start

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and Docker Compose
- [Mapbox API token](https://mapbox.com) (free tier)
- Groq API key ([free at console.groq.com](https://console.groq.com)) — or run Ollama locally

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/NateChris14/Aeroflux.git
   cd Aeroflux
   ```

2. **Create the root `.env` file**
   ```bash
   # .env (project root)
   GROQ_API_KEY=gsk_...
   LLM_PROVIDER=groq
   LLM_API_KEY=gsk_...
   LLM_MODEL=llama-3.1-8b-instant
   LLM_URL=https://api.groq.com/openai/v1

   VITE_MAPBOX_TOKEN=pk.eyJ1...
   VITE_BACKEND_URL=http://localhost:8000

   OPENSKY_MODE=simulation
   ```

3. **Build and launch**
   ```bash
   docker compose -f docker-compose.yml up --build -d
   ```

4. **Open the dashboard**
   - Dashboard: [http://localhost:8080](http://localhost:8080)
   - Backend API: [http://localhost:8000](http://localhost:8000)
   - API docs: [http://localhost:8000/docs](http://localhost:8000/docs)

> **Note:** `VITE_BACKEND_URL` is baked into the frontend bundle at build time. If you change it, rebuild the frontend image.

---

## Agent System

### Agent Responsibilities

| Agent | Role | Reasoning |
|-------|------|-----------|
| **WeatherAgent** | Analyzes SIGMETs and PIREPs for turbulence risk along the route | LLM + haversine distance checks to hazard zones |
| **FuelAgent** | Projects remaining fuel, compares headwind/tailwind routes, flags diversions | Breguet equation + LLM optimization |
| **ATCAgent** | Enforces altitude blocks, speed restrictions, and holding patterns | Hard-coded constraint table + LLM corridor selection |
| **ComfortAgent** | Estimates ride quality (EDR) from SIGMETs and terrain-induced turbulence | LLM + terrain lookup (Alps, Balkans, Caucasus) |
| **SupervisorAgent** | Arbitrates across all agent outputs, emits one recommendation per cycle | Priority: ALTITUDE_CHANGE > SPEED_CHANGE > ROUTE_CHANGE; 5-tick cooldown per type |

### Tick Cycle

```
1. SimClock.advance() — increment simulation time T
2. DataCache.get_snapshot() — assemble current FlightState + weather data
3. AgentCycleRunner.run_cycle()
   a. Four agents analyze in parallel (asyncio.gather)
   b. SupervisorAgent arbitrates and generates a Recommendation
4. WebSocket broadcast — snapshot / recommendation / agent_message
5. Sleep TICK_INTERVAL_S (default 20 s, configurable)
```

---

## Configuration

### Environment Variables

All variables live in a single `.env` at the project root.

| Variable | Default | Description |
|----------|---------|-------------|
| `LLM_PROVIDER` | `groq` | LLM backend: `groq`, `ollama`, `openai` |
| `LLM_API_KEY` | — | API key for Groq or OpenAI |
| `LLM_MODEL` | `llama-3.1-8b-instant` | Model name (provider-specific) |
| `LLM_URL` | `https://api.groq.com/openai/v1` | LLM base URL |
| `TICK_INTERVAL_S` | `20` | Seconds between simulation ticks |
| `OPENSKY_MODE` | `simulation` | `simulation` or `live` |
| `OPENSKY_CLIENT_ID` | — | OpenSky Network username |
| `OPENSKY_CLIENT_SECRET` | — | OpenSky Network password |
| `OPENSKY_ICAO24` | — | Target aircraft ICAO24 hex (live mode) |
| `VITE_MAPBOX_TOKEN` | — | Mapbox GL API token (build-time) |
| `VITE_BACKEND_URL` | `http://localhost:8000` | Backend URL baked into frontend bundle |

### LLM Providers

**Groq (cloud, recommended)**
```bash
LLM_PROVIDER=groq
LLM_API_KEY=gsk_...
LLM_MODEL=llama-3.1-8b-instant
LLM_URL=https://api.groq.com/openai/v1
```

**Ollama (local)**
```bash
# docker-compose.override.yml is pre-configured for Ollama
# Run with:
docker compose up --build -d   # loads override automatically
```
The `docker-compose.override.yml` sets `LLM_MODEL=gemma3:4b` and `LLM_URL=http://host.docker.internal:11434`. Pull the model first with `ollama pull gemma3:4b`.

> **Production note:** Always deploy with `-f docker-compose.yml` to skip the Ollama override.

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Service status and current tick count |
| `GET` | `/api/snapshot` | Current `SimSnapshot` (flight state + agent data) |
| `POST` | `/api/tick` | Manually advance one simulation tick |
| `GET` | `/api/recommendation/latest` | Most recent `Recommendation` object |
| `POST` | `/api/recommendation/{id}/accept` | Mark recommendation as accepted |
| `POST` | `/api/recommendation/{id}/dismiss` | Mark recommendation as dismissed |
| `GET` | `/api/messages` | Last 50 agent messages (filterable by `since_t`) |
| `POST` | `/api/inject-event` | Inject a flight event (body: `{"event_type": "Turbulence"}`) |
| `GET` | `/api/routes` | Planned and alternate route waypoints |
| `WS` | `/ws/live` | WebSocket — streams `snapshot`, `recommendation`, `agent_message` |

Valid `inject-event` types: `Turbulence`, `Headwind`, `ATC Hold`, `Engine Alert`

---

## Flight Simulation

### Route: LHR → DEL (BA008, Boeing 777-300ER)

| Phase | Ticks | Altitude |
|-------|-------|----------|
| Ground | 0 | 0 ft |
| Climb | 1–4 | 0 → FL360 |
| Cruise | 5–36 | FL360 |
| Descent | 37–45 | FL360 → 0 ft |

Each tick advances 10 simulated minutes. Full route = 45 ticks (7.5 sim-hours). Sim speed multipliers (1×, 2×, 4×) scale the UI tick rate without changing backend tick interval.

**Planned route:** LHR → AMS → FRA → VIE → IST → TBS → THR → KHI → DEL
_(Eastern Europe jet stream, −32 kt headwind component)_

**Alternate route:** LHR → AMS → MUC → VCE → ATH → ANK → THR → KHI → DEL
_(Southern path, +22 kt subtropical tailwind)_

**Active SIGMET:** Severe turbulence zone over Eastern Europe (VIE–IST corridor), displayed as an animated red polygon on the map.

### Live Tracking Mode

```bash
OPENSKY_MODE=live
OPENSKY_CLIENT_ID=your_username
OPENSKY_CLIENT_SECRET=your_password
OPENSKY_ICAO24=A8C5C7   # ICAO24 hex of target aircraft
```

---

## Project Structure

```
Aeroflux/
├── .env                            # Root config (single file for both services)
├── docker-compose.yml              # Production orchestration
├── docker-compose.override.yml     # Local dev overrides (Ollama defaults)
│
├── aeroflux-backend/
│   ├── main.py                     # FastAPI app entry point
│   ├── config.py                   # Pydantic settings
│   ├── agents/
│   │   ├── weather_agent.py
│   │   ├── fuel_agent.py
│   │   ├── atc_agent.py
│   │   ├── comfort_agent.py
│   │   └── supervisor_agent.py
│   ├── core/
│   │   ├── runner.py               # AgentCycleRunner (asyncio.gather)
│   │   ├── snapshot.py             # SimSnapshot dataclass
│   │   ├── clock.py                # SimClock
│   │   └── data_cache.py           # Weather/wind data cache
│   ├── services/
│   │   ├── ollama.py               # LiteLLM wrapper (Groq/Ollama/OpenAI)
│   │   ├── aviation_weather.py     # METAR, SIGMET, PIREP
│   │   ├── open_meteo.py           # Wind forecasts
│   │   └── opensky.py              # ADS-B live tracking
│   ├── models/                     # Pydantic data models
│   └── utils/
│       ├── breguet.py              # Fuel burn equations
│       └── geo.py                  # Haversine, great-circle helpers
│
└── aeroflux-frontend/
    ├── nginx.conf                  # SPA routing + /api/ and /ws/ proxy to backend
    ├── tailwind.config.js
    └── src/
        ├── App.tsx
        ├── components/
        │   ├── Header.tsx          # Controls, flight identity, inject dropdown
        │   ├── RecommendationCard.tsx
        │   ├── Globe/
        │   │   ├── MapboxGlobe.tsx # Main map: routes, weather, ATC traffic
        │   │   ├── AircraftModel.tsx
        │   │   ├── RouteOverlay.tsx
        │   │   ├── WaypointMarkers.tsx
        │   │   └── HazardZone.tsx
        │   └── Panels/
        │       ├── LeftPanel.tsx   # Telemetry, sparklines, agent log
        │       ├── RightPanel.tsx  # Recommendations, route comparison, fuel
        │       ├── AgentFeed.tsx   # Live agent message stream
        │       └── Sparkline.tsx
        ├── context/
        │   └── SimulationContext.tsx  # Central state + local tick engine
        ├── hooks/
        │   └── useBackendSync.ts     # WebSocket listener + REST calls
        ├── types/
        │   └── flight.ts             # FlightState, FuelState, Recommendation, etc.
        └── utils/
            ├── simulation-data.ts    # PLANNED_ROUTE, ALTERNATE_ROUTE, WEATHER_CELLS
            └── geo.ts
```

---

## Technologies

**Backend**
- [FastAPI](https://fastapi.tiangolo.com/) + [Uvicorn](https://www.uvicorn.org/) — async Python web server
- [LiteLLM](https://litellm.ai/) — unified LLM provider abstraction (Groq / Ollama / OpenAI)
- [Pydantic v2](https://docs.pydantic.dev/) — data validation and settings
- [HTTPX](https://www.python-httpx.org/) — async HTTP client for external APIs

**Frontend**
- [React 18](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) + [Vite](https://vitejs.dev/)
- [Mapbox GL JS](https://docs.mapbox.com/mapbox-gl-js/) — interactive globe, route arcs, weather polygons
- [Three.js](https://threejs.org/) / [react-three-fiber](https://docs.pmnd.rs/react-three-fiber/) — 3D aircraft model
- [Framer Motion](https://www.framer.com/motion/) — agent feed animations
- [Tailwind CSS](https://tailwindcss.com/) — ATC terminal design system

**Infrastructure**
- [Docker](https://docker.com/) + Docker Compose — containerized build and orchestration
- Nginx — SPA serving, `/api/` and `/ws/` reverse proxy to backend
- [Let's Encrypt](https://letsencrypt.org/) — automatic HTTPS via Certbot

---

## Development

**Backend (without Docker)**
```bash
cd aeroflux-backend
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
```

**Frontend (without Docker)**
```bash
cd aeroflux-frontend
npm install
VITE_MAPBOX_TOKEN=pk.eyJ1... VITE_BACKEND_URL=http://localhost:8000 npm run dev
```

---

## License

MIT License — see [LICENSE](LICENSE) for details.

---

**Maintained by [NateChris14](https://github.com/NateChris14)**  
Issues and feature requests: [GitHub Issues](https://github.com/NateChris14/Aeroflux/issues)
