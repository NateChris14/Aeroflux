from dataclasses import dataclass
from typing import List, Dict
from models.flight import FlightState, FuelState, Waypoint


@dataclass
class SimSnapshot:
    T: int
    sim_elapsed: str
    wall_time: str
    tick_count: int

    flight_state: FlightState
    metar: dict
    sigmet_active: list
    pireps: list
    wind_at_waypoints: dict

    active_route: List[Waypoint]
    alternate_route: List[Waypoint]

    fuel_state: FuelState
