import math
from typing import List, Tuple, Optional
from models.flight import Waypoint

EARTH_RADIUS_NM = 3440.065
EARTH_RADIUS_KM = 6371.0


def bearing(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    dlon = math.radians(lon2 - lon1)

    y = math.sin(dlon) * math.cos(lat2_rad)
    x = math.cos(lat1_rad) * math.sin(lat2_rad) - math.sin(lat1_rad) * math.cos(lat2_rad) * math.cos(dlon)

    bearing_rad = math.atan2(y, x)
    bearing_deg = math.degrees(bearing_rad)
    return (bearing_deg + 360) % 360


def haversine_nm(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)

    a = math.sin(dlat / 2) ** 2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlon / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    return EARTH_RADIUS_NM * c


def interpolate_position(waypoints: List[Waypoint], progress_fraction: float) -> Tuple[float, float]:
    if not waypoints or len(waypoints) < 2:
        if waypoints:
            return waypoints[0].lat, waypoints[0].lng
        return 0.0, 0.0

    total_segments = len(waypoints) - 1
    segment_progress = progress_fraction * total_segments
    segment_idx = int(segment_progress)
    segment_idx = min(segment_idx, total_segments - 1)
    local_progress = segment_progress - segment_idx

    wp1 = waypoints[segment_idx]
    wp2 = waypoints[segment_idx + 1]

    lat = wp1.lat + (wp2.lat - wp1.lat) * local_progress
    lng = wp1.lng + (wp2.lng - wp1.lng) * local_progress

    return lat, lng


def eta_at_waypoint(current_lat: float, current_lng: float, waypoint: Waypoint, speed_kts: float, current_T: int) -> int:
    if speed_kts <= 0:
        return current_T

    distance = haversine_nm(current_lat, current_lng, waypoint.lat, waypoint.lng)
    hours = distance / speed_kts
    seconds = int(hours * 3600)

    return current_T + seconds


def point_in_polygon(lat: float, lng: float, polygon_coords: List[List[float]]) -> bool:
    if not polygon_coords:
        return False

    n = len(polygon_coords)
    inside = False

    j = n - 1
    for i in range(n):
        # Validate coordinates are iterable pairs
        if not isinstance(polygon_coords[i], (list, tuple)) or len(polygon_coords[i]) < 2:
            continue
        if not isinstance(polygon_coords[j], (list, tuple)) or len(polygon_coords[j]) < 2:
            j = i
            continue
        xi, yi = polygon_coords[i]
        xj, yj = polygon_coords[j]

        if ((yi > lat) != (yj > lat)) and (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi):
            inside = not inside
        j = i

    return inside


def route_intersects_polygon(route_waypoints: List[Waypoint], polygon_coords: List[List[float]]) -> bool:
    if not route_waypoints or not polygon_coords:
        return False

    for wp in route_waypoints:
        if point_in_polygon(wp.lat, wp.lng, polygon_coords):
            return True

    for i in range(len(route_waypoints) - 1):
        wp1 = route_waypoints[i]
        wp2 = route_waypoints[i + 1]

        if _line_intersects_polygon(wp1.lat, wp1.lng, wp2.lat, wp2.lng, polygon_coords):
            return True

    return False


def _line_intersects_polygon(lat1: float, lng1: float, lat2: float, lng2: float, polygon_coords: List[List[float]]) -> bool:
    n = len(polygon_coords)
    for i in range(n):
        j = (i + 1) % n
        # Validate coordinates are iterable pairs
        if not isinstance(polygon_coords[i], (list, tuple)) or len(polygon_coords[i]) < 2:
            continue
        if not isinstance(polygon_coords[j], (list, tuple)) or len(polygon_coords[j]) < 2:
            continue
        if _lines_intersect(lat1, lng1, lat2, lng2, polygon_coords[i][1], polygon_coords[i][0], polygon_coords[j][1], polygon_coords[j][0]):
            return True
    return False


def _lines_intersect(x1: float, y1: float, x2: float, y2: float, x3: float, y3: float, x4: float, y4: float) -> bool:
    denom = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1)
    if denom == 0:
        return False

    ua = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / denom
    ub = ((x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3)) / denom

    return 0 <= ua <= 1 and 0 <= ub <= 1


def headwind_component(wind_speed_ms: float, wind_dir_deg: float, aircraft_heading_deg: float) -> float:
    relative_angle = math.radians(wind_dir_deg - aircraft_heading_deg)
    return wind_speed_ms * math.cos(relative_angle)
