from typing import Optional
from pydantic import BaseModel
from models.flight import FlightState, FuelState, Waypoint


class SimSnapshot(BaseModel):
    T: int
    sim_elapsed: str
    wall_time: str
    tick_count: int

    flight_state: FlightState
    metar: dict
    sigmet_active: list[dict]
    pireps: list[dict]
    wind_at_waypoints: dict[str, dict]

    active_route: list[Waypoint]
    alternate_route: list[Waypoint]

    fuel_state: FuelState
