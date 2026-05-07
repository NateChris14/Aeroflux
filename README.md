# AeroFlux AI

[![Python](https://img.shields.io/badge/Python-3.11+-blue.svg)](https://python.org)
[![React](https://img.shields.io/badge/React-18.3+-61DAFB.svg)](https://react.dev)
[![FastAPI](https://img.shields.io/badge/FastAPI-009688.svg)](https://fastapi.tiangolo.com)
[![Docker](https://img.shields.io/badge/Docker-2496ED.svg)](https://docker.com)

**AI-Powered Flight Decision Support System** — An intelligent multi-agent platform for real-time flight monitoring, weather analysis, fuel optimization, and automated decision recommendations.

![AeroFlux Dashboard](docs/dashboard-preview.png)

## Overview

AeroFlux AI simulates a next-generation Flight Operations Center, integrating multiple AI agents that monitor flight parameters, analyze weather conditions, optimize fuel consumption, ensure passenger comfort, and coordinate with ATC. The system supports both **live flight tracking** via OpenSky Network API and **synthetic flight simulation** for testing and demonstration.

### Key Features

- **Multi-Agent AI Architecture**: Specialized agents for weather, fuel, ATC, comfort, and supervisory control
- **Real-time Flight Tracking**: Live aircraft position updates via OpenSky Network
- **Interactive 3D Globe**: Mapbox GL JS-powered visualization with aircraft markers and route overlays
- **LHR → DEL Great-Circle Route**: Realistic 3,616 NM London Heathrow to New Delhi flight (BA008) with 9 waypoints
- **ATC Traffic Layer**: 10 secondary aircraft markers with data tags and proximity alerts (<150 km pulsing ring)
- **Live Weather Overlays**: 3 animated weather cell polygons with slow eastward drift; SIGMET over Eastern Europe (VIE–IST corridor)
- **Amber Route Overlay**: Recommended route shown as dashed amber arc before pilot accepts a route change
- **Altitude Animation**: Smooth cubic ease-in-out altitude transition over 3 seconds on ALTITUDE_CHANGE accept
- **ETA Countdown**: Dynamic estimated time of arrival updated every simulation tick
- **LLM-Powered Intelligence**: Supports Ollama (local), Groq, and OpenAI for agent reasoning
- **WebSocket Communication**: Real-time data streaming between backend and frontend
- **Docker Orchestration**: Complete containerized deployment with docker-compose

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              AeroFlux AI                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────┐      WebSocket      ┌─────────────────────┐        │
│  │   React Frontend    │ ◄─────────────────► │   FastAPI Backend   │        │
│  │   (Mapbox Globe)    │                     │   (Agent Runner)    │        │
│  └─────────────────────┘                     └──────────┬──────────┘        │
│                                                        │                     │
│                              ┌─────────────────────────┼─────────────────┐   │
│                              │                         │                 │   │
│                              ▼                         ▼                 ▼   │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                        Multi-Agent System                                ││
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐      ││
│  │  │   Weather   │ │    Fuel     │ │    ATC      │ │   Comfort   │      ││
│  │  │    Agent    │ │    Agent    │ │    Agent    │ │    Agent    │      ││
│  │  └──────┬──────┘ └──────┬──────┘ └──────┬──────┘ └──────┬──────┘      ││
│  │         │               │               │               │              ││
│  │         └───────────────┴───────────────┴───────────────┘              ││
│  │                                 │                                      ││
│  │                         ┌───────┴───────┐                              ││
│  │                         │  Supervisor   │                              ││
│  │                         │    Agent     │                              ││
│  │                         └───────────────┘                              ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                              │                                               │
│                              ▼                                               │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                        External Services                               ││
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐  ││
│  │  │   OpenSky    │ │  Aviation    │ │   OpenMeteo  │ │   Ollama/    │  ││
│  │  │   Network    │ │   Weather    │ │              │ │   Groq LLM   │  ││
│  │  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘  ││
│  └─────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────┘
```

## Quick Start

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) & Docker Compose
- [Git](https://git-scm.com/downloads)
- Mapbox API Token ([Get one free](https://mapbox.com))
- (Optional) OpenSky Network credentials for live tracking
- (Optional) Groq API key for cloud LLM inference

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/NateChris14/Aeroflux.git
   cd Aeroflux
   ```

2. **Configure environment**
   ```bash
   # Copy the example file and edit
   cp aeroflux-backend/.env.example aeroflux-backend/.env
   cp aeroflux-frontend/.env.example aeroflux-frontend/.env
   ```

3. **Set your API tokens**
   ```bash
   # Edit aeroflux-backend/.env
   VITE_MAPBOX_TOKEN=your_mapbox_token_here
   LLM_PROVIDER=ollama  # or "groq" for cloud
   
   # For live flight tracking (optional)
   OPENSKY_CLIENT_ID=your_opensky_id
   OPENSKY_CLIENT_SECRET=your_opensky_secret
   ```

4. **Launch with Docker**
   ```bash
   docker-compose up -d
   ```

5. **Access the dashboard**
   - Frontend: http://localhost
   - Backend API: http://localhost:8000
   - API Docs: http://localhost:8000/docs

## Agent System

### Agent Responsibilities

| Agent | Responsibility | Data Sources | LLM Prompting |
|-------|---------------|--------------|---------------|
| **Weather Agent** | Monitor SIGMETs, PIREPs, turbulence, route weather hazards | Aviation Weather API, OpenMeteo | Natural language analysis of weather patterns |
| **Fuel Agent** | Calculate burn rates, endurance, diversion fuel requirements | Breguet equations, wind components | Fuel optimization strategies |
| **ATC Agent** | Monitor airspace restrictions, NOTAMs, traffic conflicts | OpenSky Network, internal data | ATC coordination protocols |
| **Comfort Agent** | Track passenger comfort metrics, turbulence impact, cabin pressure | Simulated passenger data | Comfort vs efficiency trade-offs |
| **Supervisor Agent** | Orchestrate agent outputs, prioritize recommendations, final decisions | All agent outputs | Multi-criteria decision making |

### Decision Flow

1. **Snapshot Creation**: System aggregates flight state, weather, fuel, and route data
2. **Parallel Analysis**: All agents analyze the snapshot simultaneously
3. **Result Aggregation**: Agent outputs compiled with severity scoring
4. **Supervisor Review**: Prioritizes recommendations and generates final decision
5. **Recommendation Delivery**: WebSocket broadcast to frontend dashboard
6. **Pilot Action**: Accept/dismiss recommendations via UI

## Configuration

### Environment Variables

#### Backend (`aeroflux-backend/.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENSKY_MODE` | `simulation` | `simulation` or `live` for flight tracking |
| `OPENSKY_CLIENT_ID` | - | OpenSky Network API username |
| `OPENSKY_CLIENT_SECRET` | - | OpenSky Network API password |
| `OPENSKY_ICAO24` | `aa1234` | Target aircraft ICAO24 address |
| `LLM_PROVIDER` | `ollama` | LLM backend: `ollama`, `groq`, `openai` |
| `LLM_API_KEY` | - | API key for Groq/OpenAI |
| `LLM_MODEL` | `llama3.2` | Model name (provider-specific) |
| `TICK_INTERVAL_S` | `20` | Simulation tick interval in seconds |
| `LOG_LEVEL` | `INFO` | Logging verbosity |

#### Frontend (`aeroflux-frontend/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_MAPBOX_TOKEN` | Yes | Mapbox GL API access token |

### LLM Provider Setup

**Local (Ollama)**
```bash
# Install Ollama and pull model
ollama pull llama3.2

# Set provider
LLM_PROVIDER=ollama
LLM_MODEL=llama3.2
```

**Cloud (Groq)**
```bash
# Get API key from https://console.groq.com
LLM_PROVIDER=groq
LLM_API_KEY=gsk_...
LLM_MODEL=llama-3.1-8b-instant
```

## Development

### Project Structure

```
Aeroflux/
├── aeroflux-backend/           # FastAPI Python backend
│   ├── agents/                 # AI agent implementations
│   ├── core/                   # Simulation clock, data cache, runner
│   ├── models/                 # Pydantic data models
│   ├── services/               # External API integrations
│   └── utils/                  # Geo calculations, Breguet equations
├── aeroflux-frontend/          # React TypeScript frontend
│   ├── src/components/         # UI components (Globe, Panels)
│   ├── src/context/            # React state management
│   └── src/hooks/              # Backend sync, WebSocket hooks
├── docker-compose.yml          # Production orchestration
└── docker-compose.override.yml # Local development overrides
```

### Running Locally (without Docker)

**Backend**
```bash
cd aeroflux-backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
```

**Frontend**
```bash
cd aeroflux-frontend
npm install
npm run dev
```

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/state` | GET | Current simulation state |
| `/api/snapshot` | GET | Latest agent snapshot |
| `/api/recommendations` | GET/POST | List or accept recommendations |
| `/api/inject` | POST | Inject simulation events |
| `/ws` | WebSocket | Real-time state streaming |

## Flight Simulation

### London Heathrow → New Delhi (LHR → DEL)

The default simulation follows a realistic 3,616 NM great-circle commercial flight path (callsign **BA008**, Boeing 777-300ER):

| Phase | Sim Duration | Altitude Profile |
|-------|-------------|------------------|
| Ground | — | 0 ft |
| Climb | ~30 sim-min | 0 → FL360 |
| Cruise | ~6 sim-hours | FL360 |
| Descent | ~30 sim-min | FL360 → 15,000 ft |
| Approach | ~15 sim-min | 15,000 ft → touchdown |

Simulation runs at **10 sim-minutes per tick** (45 ticks = 7.5 sim-hours), with selectable speed multipliers (1×, 2×, 4×).

**Planned Route**: LHR → AMS → FRA → VIE → IST → TBS → THR → KHI → DEL

**Alternate Route** (southern, avoids Eastern Europe SIGMET): LHR → AMS → MUC → VCE → ATH → ANK → THR → KHI → DEL

**SIGMET**: Active severe turbulence zone over Eastern Europe (VIE–IST corridor)

### Live Tracking Mode

Switch to live aircraft tracking by overriding environment variables:

```bash
# docker-compose.override.yml
environment:
  - OPENSKY_MODE=live
  - OPENSKY_ICAO24=auto        # auto-discover or set a specific ICAO24 hex
  - LLM_PROVIDER=ollama        # override file switches to Ollama
```

## Technologies

**Backend**
- [FastAPI](https://fastapi.tiangolo.com/) - High-performance Python web framework
- [Pydantic](https://docs.pydantic.dev/) - Data validation and settings management
- [WebSockets](https://fastapi.tiangolo.com/advanced/websockets/) - Real-time communication
- [HTTPX](https://www.python-httpx.org/) - Async HTTP client for API calls

**Frontend**
- [React 18](https://react.dev/) - UI library with hooks and context
- [TypeScript](https://www.typescriptlang.org/) - Type-safe JavaScript
- [Mapbox GL JS](https://docs.mapbox.com/mapbox-gl-js/) - Interactive maps, 3D globe, and weather polygons
- [Three.js / react-three-fiber](https://docs.pmnd.rs/react-three-fiber/) - 3D rendering
- [Recharts](https://recharts.org/) - Altitude and fuel history charts
- [Framer Motion](https://www.framer.com/motion/) - Smooth UI animations
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first styling
- [Vite](https://vitejs.dev/) - Fast build tooling

**AI/ML**
- [LiteLLM](https://litellm.ai/) - Unified LLM interface (Ollama, Groq, OpenAI)
- Custom prompting framework for aviation domain expertise

**Infrastructure**
- [Docker](https://docker.com/) - Containerization
- [Docker Compose](https://docs.docker.com/compose/) - Multi-service orchestration

## Security Notes

- All `.env` files are `.gitignore` protected
- Never commit API keys or tokens
- Use Docker secrets for production deployments
- OpenSky credentials are optional (simulation mode works without them)

## License

MIT License - See [LICENSE](LICENSE) for details.

## Acknowledgments

- [OpenSky Network](https://opensky-network.org/) - Aircraft tracking data
- [Aviation Weather API](https://aviationweather.gov/) - SIGMET and weather data
- [Open-Meteo](https://open-meteo.com/) - Free weather forecast API
- [Mapbox](https://mapbox.com/) - Mapping platform

---

**Maintained by [NateChris14](https://github.com/NateChris14)**

For issues and feature requests, please use [GitHub Issues](https://github.com/NateChris14/Aeroflux/issues).
