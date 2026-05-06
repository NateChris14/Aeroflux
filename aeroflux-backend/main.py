import asyncio
import json
import logging
import uuid
from collections import deque
from contextlib import asynccontextmanager
from typing import Dict, List, Optional, Any

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from config import settings
from core.clock import SimClock
from core.data_cache import DataCache
from core.runner import AgentCycleRunner
from models.flight import Waypoint, FlightState, FuelState
from models.recommendation import AgentResult, Recommendation
from models.snapshot import SimSnapshot as SimSnapshotModel
from agents.weather_agent import WeatherAgent
from agents.fuel_agent import FuelAgent
from agents.atc_agent import ATCAgent
from agents.comfort_agent import ComfortAgent
from agents.supervisor_agent import SupervisorAgent
from services.opensky import OpenSkyService, FlightSimulator
from services.aviation_weather import AviationWeatherService
from services.open_meteo import OpenMeteoService

logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

PLANNED_ROUTE = [
    Waypoint(id="DEL", label="Delhi (VIDP)", lat=28.5562, lng=77.10),
    Waypoint(id="PETUS", label="PETUS", lat=27.2, lng=75.8),
    Waypoint(id="VAGAD", label="VAGAD", lat=25.5, lng=74.2),
    Waypoint(id="OPULA", label="OPULA", lat=23.8, lng=73.0),
    Waypoint(id="LOVIM", label="LOVIM", lat=22.4, lng=72.1),
    Waypoint(id="AKTIM", label="AKTIM", lat=21.2, lng=71.3),
    Waypoint(id="BOM", label="Mumbai (VABB)", lat=19.0896, lng=72.8656),
]

ALTERNATE_ROUTE = [
    Waypoint(id="DEL", label="Delhi (VIDP)", lat=28.5562, lng=77.10),
    Waypoint(id="BIKANER", label="BIKANER", lat=28.0, lng=73.3),
    Waypoint(id="JODHPUR", label="JODHPUR", lat=26.3, lng=73.0),
    Waypoint(id="UDAIPUR", label="UDAIPUR", lat=24.6, lng=73.7),
    Waypoint(id="SURAT", label="SURAT", lat=21.2, lng=72.8),
    Waypoint(id="BOM", label="Mumbai (VABB)", lat=19.0896, lng=72.8656),
]

app_state: Dict[str, Any] = {
    "clock": None,
    "cache": None,
    "runner": None,
    "agents": None,
    "supervisor": None,
    "opensky_service": None,
    "aviation_weather_service": None,
    "open_meteo_service": None,
    "flight_simulator": None,
    "active_route": PLANNED_ROUTE.copy(),
    "alternate_route": ALTERNATE_ROUTE.copy(),
    "fuel_state": FuelState(
        remaining_kg=18500.0,
        burn_rate_kg_per_min=204.0,
        projected_remaining_at_destination_kg=8500.0,
        burn_delta_vs_planned_kg=0.0
    ),
    "recommendation_store": {},
    "latest_recommendation": None,
    "message_store": deque(maxlen=200),
    "websocket_clients": [],
    "agent_cycle_task": None,
}

class InjectEventRequest(BaseModel):
    event_type: str

class AgentMessage(BaseModel):
    id: str
    T: int
    sim_elapsed: str
    agent: str
    message: str
    severity: str
    data: dict

async def broadcast_snapshot(snapshot: SimSnapshotModel):
    message = {"type": "snapshot", "data": snapshot.model_dump()}
    disconnected = []
    for ws in app_state["websocket_clients"]:
        try:
            await ws.send_json(message)
        except Exception:
            disconnected.append(ws)
    for ws in disconnected:
        if ws in app_state["websocket_clients"]:
            app_state["websocket_clients"].remove(ws)

async def broadcast_recommendation(rec: Recommendation):
    message = {"type": "recommendation", "data": rec.model_dump()}
    disconnected = []
    for ws in app_state["websocket_clients"]:
        try:
            await ws.send_json(message)
        except Exception:
            disconnected.append(ws)
    for ws in disconnected:
        if ws in app_state["websocket_clients"]:
            app_state["websocket_clients"].remove(ws)

async def broadcast_agent_message(msg: AgentMessage):
    message = {"type": "agent_message", "data": msg.model_dump()}
    disconnected = []
    for ws in app_state["websocket_clients"]:
        try:
            await ws.send_json(message)
        except Exception:
            disconnected.append(ws)
    for ws in disconnected:
        if ws in app_state["websocket_clients"]:
            app_state["websocket_clients"].remove(ws)

async def run_agent_cycle():
    clock = app_state["clock"]
    cache = app_state["cache"]
    runner = app_state["runner"]

    while True:
        try:
            clock.advance()
            T = clock.T

            snapshot = cache.get_snapshot(
                T,
                clock,
                app_state["active_route"],
                app_state["alternate_route"],
                app_state["fuel_state"]
            )

            results, recommendation = await runner.run_cycle(snapshot)

            for result in results:
                msg = AgentMessage(
                    id=str(uuid.uuid4()),
                    T=T,
                    sim_elapsed=snapshot.sim_elapsed,
                    agent=result.agent,
                    message=result.finding,
                    severity=result.severity,
                    data=result.data
                )
                app_state["message_store"].append(msg)
                await broadcast_agent_message(msg)

            if recommendation:
                app_state["recommendation_store"][recommendation.id] = recommendation
                app_state["latest_recommendation"] = recommendation
                await broadcast_recommendation(recommendation)

            snapshot_model = SimSnapshotModel(
                T=snapshot.T,
                sim_elapsed=snapshot.sim_elapsed,
                wall_time=snapshot.wall_time,
                tick_count=snapshot.tick_count,
                flight_state=snapshot.flight_state,
                metar=snapshot.metar,
                sigmet_active=snapshot.sigmet_active,
                pireps=snapshot.pireps,
                wind_at_waypoints=snapshot.wind_at_waypoints,
                active_route=snapshot.active_route,
                alternate_route=snapshot.alternate_route,
                fuel_state=snapshot.fuel_state
            )
            await broadcast_snapshot(snapshot_model)

            weather_sev = next((r.severity for r in results if r.agent == "WEATHER"), "info")
            fuel_data = next((r.data for r in results if r.agent == "FUEL"), {})
            atc_data = next((r.data for r in results if r.agent == "ATC"), {})
            comfort_data = next((r.data for r in results if r.agent == "COMFORT"), {})

            fuel_headwind = fuel_data.get("avg_headwind_kts", 0)
            atc_blocked = "blocked" if atc_data.get("altitude_blocked") else "clear"
            comfort_score = comfort_data.get("comfort_score", 100)
            rec_status = recommendation.action_type if recommendation else "none"

            logger.info(
                f"Tick {clock.tick_count} | T={T} | "
                f"WeatherAgent: {weather_sev.upper()} | "
                f"FuelAgent: {fuel_headwind:+.0f}kts | "
                f"ATCAgent: {atc_blocked} | "
                f"ComfortAgent: {comfort_score}/100 | "
                f"Supervisor: {rec_status}"
            )

        except Exception as e:
            logger.error(f"Agent cycle error: {e}")

        await asyncio.sleep(settings.TICK_INTERVAL_S)

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting AeroFlux AI backend...")

    app_state["clock"] = SimClock(tick_interval_s=settings.TICK_INTERVAL_S, mode=settings.OPENSKY_MODE)
    app_state["cache"] = DataCache()

    weather_agent = WeatherAgent()
    fuel_agent = FuelAgent()
    atc_agent = ATCAgent()
    comfort_agent = ComfortAgent()
    supervisor = SupervisorAgent()

    app_state["agents"] = [weather_agent, fuel_agent, atc_agent, comfort_agent]
    app_state["supervisor"] = supervisor
    app_state["runner"] = AgentCycleRunner(app_state["agents"], supervisor)

    app_state["aviation_weather_service"] = AviationWeatherService(app_state["cache"])
    app_state["open_meteo_service"] = OpenMeteoService(app_state["cache"])

    if settings.OPENSKY_MODE == "simulation":
        app_state["flight_simulator"] = FlightSimulator(app_state["cache"], app_state["clock"])
        asyncio.create_task(app_state["flight_simulator"].run_forever(settings.TICK_INTERVAL_S))
        logger.info("Started flight simulator (simulation mode)")
    else:
        app_state["opensky_service"] = OpenSkyService(
            settings.OPENSKY_ICAO24,
            app_state["cache"],
            app_state["clock"]
        )
        asyncio.create_task(app_state["opensky_service"].poll_forever(5))
        logger.info("Started OpenSky polling (live mode)")

    asyncio.create_task(app_state["aviation_weather_service"].poll_metar(["VIDP", "VABB"], 60))
    asyncio.create_task(app_state["aviation_weather_service"].poll_sigmets(60))
    asyncio.create_task(app_state["aviation_weather_service"].poll_pireps(60))
    asyncio.create_task(app_state["open_meteo_service"].poll_waypoints(PLANNED_ROUTE, 3600))

    app_state["agent_cycle_task"] = asyncio.create_task(run_agent_cycle())

    logger.info("AeroFlux AI backend ready")
    yield

    logger.info("Shutting down AeroFlux AI backend...")
    if app_state["agent_cycle_task"]:
        app_state["agent_cycle_task"].cancel()

app = FastAPI(title="AeroFlux AI", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
async def health():
    clock = app_state.get("clock")
    return {
        "status": "ok",
        "T": clock.T if clock else 0,
        "tick_count": clock.tick_count if clock else 0
    }

@app.get("/api/snapshot")
async def get_snapshot():
    clock = app_state["clock"]
    cache = app_state["cache"]

    snapshot = cache.get_snapshot(
        clock.T,
        clock,
        app_state["active_route"],
        app_state["alternate_route"],
        app_state["fuel_state"]
    )

    return SimSnapshotModel(
        T=snapshot.T,
        sim_elapsed=snapshot.sim_elapsed,
        wall_time=snapshot.wall_time,
        tick_count=snapshot.tick_count,
        flight_state=snapshot.flight_state,
        metar=snapshot.metar,
        sigmet_active=snapshot.sigmet_active,
        pireps=snapshot.pireps,
        wind_at_waypoints=snapshot.wind_at_waypoints,
        active_route=snapshot.active_route,
        alternate_route=snapshot.alternate_route,
        fuel_state=snapshot.fuel_state
    )

@app.post("/api/tick")
async def manual_tick():
    clock = app_state["clock"]
    cache = app_state["cache"]
    runner = app_state["runner"]

    clock.advance()
    T = clock.T

    if app_state.get("flight_simulator"):
        await app_state["flight_simulator"].simulate_tick()

    snapshot = cache.get_snapshot(
        T,
        clock,
        app_state["active_route"],
        app_state["alternate_route"],
        app_state["fuel_state"]
    )

    results, recommendation = await runner.run_cycle(snapshot)

    for result in results:
        msg = AgentMessage(
            id=str(uuid.uuid4()),
            T=T,
            sim_elapsed=snapshot.sim_elapsed,
            agent=result.agent,
            message=result.finding,
            severity=result.severity,
            data=result.data
        )
        app_state["message_store"].append(msg)
        await broadcast_agent_message(msg)

    if recommendation:
        app_state["recommendation_store"][recommendation.id] = recommendation
        app_state["latest_recommendation"] = recommendation
        await broadcast_recommendation(recommendation)

    snapshot_model = SimSnapshotModel(
        T=snapshot.T,
        sim_elapsed=snapshot.sim_elapsed,
        wall_time=snapshot.wall_time,
        tick_count=snapshot.tick_count,
        flight_state=snapshot.flight_state,
        metar=snapshot.metar,
        sigmet_active=snapshot.sigmet_active,
        pireps=snapshot.pireps,
        wind_at_waypoints=snapshot.wind_at_waypoints,
        active_route=snapshot.active_route,
        alternate_route=snapshot.alternate_route,
        fuel_state=snapshot.fuel_state
    )
    await broadcast_snapshot(snapshot_model)

    return {
        "snapshot": snapshot_model.model_dump(),
        "recommendation": recommendation.model_dump() if recommendation else None
    }

@app.get("/api/recommendation/latest")
async def get_latest_recommendation():
    rec = app_state.get("latest_recommendation")
    return rec.model_dump() if rec else None

@app.post("/api/recommendation/{rec_id}/accept")
async def accept_recommendation(rec_id: str):
    rec = app_state["recommendation_store"].get(rec_id)
    if not rec:
        raise HTTPException(status_code=404, detail="Recommendation not found")

    rec.status = "accepted"

    if rec.action_params.get("new_route") == "ALTERNATE_1":
        app_state["active_route"] = app_state["alternate_route"].copy()

    app_state["latest_recommendation"] = rec
    return rec.model_dump()

@app.post("/api/recommendation/{rec_id}/dismiss")
async def dismiss_recommendation(rec_id: str):
    rec = app_state["recommendation_store"].get(rec_id)
    if not rec:
        raise HTTPException(status_code=404, detail="Recommendation not found")

    rec.status = "dismissed"
    app_state["latest_recommendation"] = rec
    return rec.model_dump()

@app.get("/api/messages")
async def get_messages(since_T: Optional[int] = None):
    messages = list(app_state["message_store"])
    if since_T is not None:
        messages = [m for m in messages if m.T > since_T]
    return [m.model_dump() for m in messages[-50:]]

@app.post("/api/inject-event")
async def inject_event(request: InjectEventRequest):
    clock = app_state["clock"]
    cache = app_state["cache"]
    runner = app_state["runner"]

    T = clock.T

    if request.event_type == "TURBULENCE":
        await cache.update_pireps([{
            "id": "injected",
            "latitude": 25.0,
            "longitude": 74.0,
            "turbulence_intensity": "MOD",
            "timestamp": T
        }])
    elif request.event_type == "HEADWIND":
        await cache.update_wind(clock.wind_bucket(), {
            "VAGAD": {"speed_ms": 25, "direction_deg": 270}
        })
    elif request.event_type == "ATC_HOLD":
        pass
    elif request.event_type == "ENGINE_ALERT":
        pass

    snapshot = cache.get_snapshot(
        T,
        clock,
        app_state["active_route"],
        app_state["alternate_route"],
        app_state["fuel_state"]
    )

    results, recommendation = await runner.run_cycle(snapshot)

    for result in results:
        msg = AgentMessage(
            id=str(uuid.uuid4()),
            T=T,
            sim_elapsed=snapshot.sim_elapsed,
            agent=result.agent,
            message=result.finding,
            severity=result.severity,
            data=result.data
        )
        app_state["message_store"].append(msg)

    if recommendation:
        app_state["recommendation_store"][recommendation.id] = recommendation
        app_state["latest_recommendation"] = recommendation

    return {
        "messages": [m.model_dump() for m in app_state["message_store"][-10:]],
        "recommendation": recommendation.model_dump() if recommendation else None
    }

@app.get("/api/routes")
async def get_routes():
    return {
        "planned_route": [wp.model_dump() for wp in PLANNED_ROUTE],
        "alternate_route": [wp.model_dump() for wp in ALTERNATE_ROUTE]
    }

@app.websocket("/ws/live")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    app_state["websocket_clients"].append(websocket)

    try:
        while True:
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
                if msg.get("action") == "ping":
                    await websocket.send_json({"type": "pong"})
            except json.JSONDecodeError:
                pass
    except WebSocketDisconnect:
        if websocket in app_state["websocket_clients"]:
            app_state["websocket_clients"].remove(websocket)
    except Exception as e:
        logger.warning(f"WebSocket error: {e}")
        if websocket in app_state["websocket_clients"]:
            app_state["websocket_clients"].remove(websocket)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
