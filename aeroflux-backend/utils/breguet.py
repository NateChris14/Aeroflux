from typing import List, Dict, Tuple
from models.flight import Waypoint
from utils.geo import haversine_nm

BASE_BURN_KG_PER_HOUR = 2450.0
OPTIMAL_ALTITUDE_MIN = 35000
OPTIMAL_ALTITUDE_MAX = 39000
OPTIMAL_SPEED_KTS = 460.0
HEADWIND_PENALTY_PER_10KT = 0.008


def fuel_burn_segment(
    distance_nm: float,
    altitude_ft: float,
    speed_kts: float,
    headwind_kts: float,
    aircraft_type: str = "B737"
) -> float:
    if aircraft_type != "B737":
        aircraft_type = "B737"

    hours = distance_nm / speed_kts if speed_kts > 0 else 0

    altitude_factor = 1.0
    if OPTIMAL_ALTITUDE_MIN <= altitude_ft <= OPTIMAL_ALTITUDE_MAX:
        altitude_factor = 0.95
    elif altitude_ft < 30000:
        altitude_factor = 1.15
    elif altitude_ft < OPTIMAL_ALTITUDE_MIN:
        altitude_factor = 1.08

    speed_factor = 1.0 + abs(speed_kts - OPTIMAL_SPEED_KTS) / 100.0 * 0.05

    headwind_penalty = max(0.85, 1.0 + (headwind_kts / 10.0) * HEADWIND_PENALTY_PER_10KT)

    base_fuel = BASE_BURN_KG_PER_HOUR * hours
    adjusted_fuel = base_fuel * altitude_factor * speed_factor * headwind_penalty

    return max(0, adjusted_fuel)


def total_route_fuel(
    waypoints: List[Waypoint],
    wind_components: Dict[str, Dict],
    current_altitude_ft: float,
    speed_kts: float,
    start_idx: int = 0
) -> float:
    total_fuel = 0.0

    for i in range(start_idx, len(waypoints) - 1):
        wp1 = waypoints[i]
        wp2 = waypoints[i + 1]

        distance = haversine_nm(wp1.lat, wp1.lng, wp2.lat, wp2.lng)

        headwind_kts = 0.0
        if wp2.id in wind_components:
            wind = wind_components[wp2.id]
            headwind_kts = wind.get("headwind_kts", 0.0)

        segment_fuel = fuel_burn_segment(distance, current_altitude_ft, speed_kts, headwind_kts)
        total_fuel += segment_fuel

    return total_fuel


def compare_routes(
    route_a: List[Waypoint],
    route_b: List[Waypoint],
    wind_grid: Dict[str, Dict],
    altitude_ft: float,
    speed_kts: float,
    current_waypoint_idx: int = 0
) -> Dict:
    fuel_a = total_route_fuel(route_a, wind_grid, altitude_ft, speed_kts, current_waypoint_idx)
    fuel_b = total_route_fuel(route_b, wind_grid, altitude_ft, speed_kts, current_waypoint_idx)

    delta_kg = fuel_b - fuel_a
    delta_pct = (delta_kg / fuel_a * 100) if fuel_a > 0 else 0.0

    return {
        "route_a_kg": round(fuel_a, 1),
        "route_b_kg": round(fuel_b, 1),
        "delta_kg": round(delta_kg, 1),
        "delta_pct": round(delta_pct, 2)
    }
