import asyncio
from typing import Dict, List, Optional
from datetime import datetime, timezone
from core.snapshot import SimSnapshot
from core.clock import SimClock
from models.flight import FlightState, FuelState, Waypoint


class DataCache:
    def __init__(self):
        self._lock = asyncio.Lock()
        self._flight_snapshots: Dict[int, FlightState] = {}
        self._metar_cache: Dict[int, dict] = {}
        self._wind_cache: Dict[int, dict] = {}
        self._sigmets: List[dict] = []
        self._pireps: List[dict] = []

    async def update_flight_state(self, T: int, state: FlightState) -> None:
        async with self._lock:
            self._flight_snapshots[T] = state

    async def update_metar(self, T: int, metar_data: dict) -> None:
        async with self._lock:
            self._metar_cache[T] = metar_data

    async def update_wind(self, T: int, wind_data: dict) -> None:
        async with self._lock:
            self._wind_cache[T] = wind_data

    async def update_sigmets(self, sigmets_list: List[dict]) -> None:
        async with self._lock:
            self._sigmets = sigmets_list

    async def update_pireps(self, pireps_list: List[dict]) -> None:
        async with self._lock:
            self._pireps = pireps_list

    def get_snapshot(
        self,
        T: int,
        clock: SimClock,
        active_route: List[Waypoint],
        alternate_route: List[Waypoint],
        fuel_state: FuelState
    ) -> SimSnapshot:
        metar_bucket = clock.metar_bucket()
        wind_bucket = clock.wind_bucket()

        metar = self._metar_cache.get(metar_bucket, {})
        if not metar and self._metar_cache:
            nearest_T = min(self._metar_cache.keys(), key=lambda x: abs(x - metar_bucket))
            metar = self._metar_cache[nearest_T]

        wind_data = self._wind_cache.get(wind_bucket, {})
        if not wind_data and self._wind_cache:
            nearest_T = min(self._wind_cache.keys(), key=lambda x: abs(x - wind_bucket))
            wind_data = self._wind_cache[nearest_T]

        sigmet_active = [
            s for s in self._sigmets
            if s.get("valid_from", 0) <= T <= s.get("valid_to", float("inf"))
        ]

        pireps_filtered = [
            p for p in self._pireps
            if abs(p.get("timestamp", T) - T) <= 1800
        ]

        flight_state = self._flight_snapshots.get(T)
        if not flight_state and self._flight_snapshots:
            nearest_T = max(t for t in self._flight_snapshots.keys())
            flight_state = self._flight_snapshots[nearest_T]

        if flight_state is None:
            flight_state = FlightState(
                icao24="",
                callsign="",
                lat=0.0,
                lng=0.0,
                altitude_ft=0.0,
                speed_kts=0.0,
                heading_deg=0.0,
                vertical_rate_fpm=0.0,
                on_ground=True,
                flight_phase="GROUND",
                current_waypoint_idx=0,
                T=T
            )

        return SimSnapshot(
            T=T,
            sim_elapsed=clock.sim_elapsed_label(),
            wall_time=clock.wall_time_utc(),
            tick_count=clock.tick_count,
            flight_state=flight_state,
            metar=metar,
            sigmet_active=sigmet_active,
            pireps=pireps_filtered,
            wind_at_waypoints=wind_data,
            active_route=active_route,
            alternate_route=alternate_route,
            fuel_state=fuel_state
        )
