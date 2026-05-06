from typing import Optional
from pydantic import BaseModel


class Waypoint(BaseModel):
    id: str
    label: str
    lat: float
    lng: float
    eta_T: Optional[int] = None


class FlightState(BaseModel):
    icao24: str
    callsign: str
    lat: float
    lng: float
    altitude_ft: float
    speed_kts: float
    heading_deg: float
    vertical_rate_fpm: float
    on_ground: bool
    flight_phase: str
    current_waypoint_idx: int
    T: int


class FuelState(BaseModel):
    remaining_kg: float
    burn_rate_kg_per_min: float
    projected_remaining_at_destination_kg: float
    burn_delta_vs_planned_kg: float
