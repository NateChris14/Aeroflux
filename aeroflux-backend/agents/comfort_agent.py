import json
import logging
from core.snapshot import SimSnapshot
from models.recommendation import AgentResult
from agents.base import BaseAgent
from utils.geo import route_intersects_polygon, haversine_nm
from services.ollama import OllamaService
from config import settings

logger = logging.getLogger(__name__)

NM_THRESHOLD = 50.0
EDR_SMOOTH = 0.05
EDR_LIGHT = 0.10


class ComfortAgent(BaseAgent):
    def __init__(self):
        super().__init__("COMFORT")
        self.ollama = OllamaService()

    async def analyze(self, snapshot: SimSnapshot) -> AgentResult:
        rule_based = self._rule_based_analysis(snapshot)

        if not settings.USE_LLM_AGENTS:
            return rule_based

        try:
            llm_result = await self._llm_analysis(snapshot, rule_based.data)
            if llm_result:
                return llm_result
        except Exception as e:
            logger.warning(f"LLM analysis failed: {e}")

        return rule_based

    async def _llm_analysis(self, snapshot: SimSnapshot, rule_data: dict) -> AgentResult | None:
        """Use Ollama LLM for comfort analysis."""
        flight = snapshot.flight_state
        data = rule_data

        sigmet_str = "\n".join([
            f"- {s.get('hazard', 'unknown')}"
            for s in snapshot.sigmet_active[:2]
        ]) if snapshot.sigmet_active else "No SIGMETs"

        pirep_str = "\n".join([
            f"- Turbulence: {p.get('turbulence_intensity', 'none')}"
            for p in snapshot.pireps[:2]
        ]) if snapshot.pireps else "No PIREPs"

        prompt = f"""You are a passenger comfort expert AI analyzing flight ride quality.

FLIGHT STATUS:
- Altitude: {flight.altitude_ft:.0f}ft
- Vertical Rate: {flight.vertical_rate_fpm:+.0f}fpm
- Route Position: WP {flight.current_waypoint_idx}

WEATHER IMPACT:
SIGMETs:
{sigmet_str}

PIREPs:
{pirep_str}

RULE-BASED ANALYSIS:
- Ride Quality: {data.get('ride_quality', 'SMOOTH')}
- Comfort Score: {data.get('comfort_score', 100)}/100
- EDR Estimate: {data.get('edr_estimate', 0)}
- Affected Segment: {data.get('affected_segment', 'None')}

Respond with JSON only:
{{
    "finding": "Concise passenger comfort assessment",
    "severity": "info|warning|critical",
    "reasoning": "Brief comfort analysis",
    "passenger_advice": "What passengers can expect"
}}"""

        response = await self.ollama.generate_json(prompt, temperature=0.2)

        if not response or "finding" not in response:
            return None

        return AgentResult(
            agent=self.name,
            T=snapshot.T,
            finding=response.get("finding", rule_data.get('finding', 'No data')),
            severity=response.get("severity", rule_data.get('severity', 'info')),
            data={
                **data,
                "llm_reasoning": response.get("reasoning", ""),
                "llm_passenger_advice": response.get("passenger_advice", ""),
                "analysis_method": "llm"
            }
        )

    def _rule_based_analysis(self, snapshot: SimSnapshot) -> AgentResult:
        """Rule-based comfort analysis."""
        T = snapshot.T
        active_route = snapshot.active_route

        max_edr = 0.0
        ride_quality = "SMOOTH"
        affected_segment = None

        for sigmet in snapshot.sigmet_active:
            coords = sigmet.get("geometry", {}).get("coordinates", [])
            if not coords:
                continue

            flat_coords = self._flatten_coords(coords)
            if not flat_coords:
                continue

            if route_intersects_polygon(active_route, flat_coords):
                hazard = sigmet.get("hazard", "").upper()
                if "TURB" in hazard or "TB" in hazard:
                    max_edr = max(max_edr, 0.15)
                    affected_segment = self._find_affected_segment(active_route, flat_coords)

        for pirep in snapshot.pireps:
            intensity = pirep.get("turbulence_intensity", "").upper()
            pirep_lat = pirep.get("latitude")
            pirep_lng = pirep.get("longitude")

            if pirep_lat is None or pirep_lng is None:
                continue

            for i, wp in enumerate(active_route):
                if haversine_nm(wp.lat, wp.lng, pirep_lat, pirep_lng) < NM_THRESHOLD:
                    if intensity in ["LGT", "LIGHT"]:
                        max_edr = max(max_edr, 0.08)
                    elif intensity in ["MOD", "MODERATE"]:
                        max_edr = max(max_edr, 0.15)
                    elif intensity in ["SEV", "SEVERE", "HVY", "HEAVY"]:
                        max_edr = max(max_edr, 0.35)

                    if affected_segment is None and i < len(active_route) - 1:
                        affected_segment = f"{wp.id}-{active_route[i+1].id}"
                    break

        if max_edr < EDR_SMOOTH:
            ride_quality = "SMOOTH"
        elif max_edr < EDR_LIGHT:
            ride_quality = "LIGHT CHOP"
        else:
            ride_quality = "MODERATE"

        comfort_score = max(0, min(100, int(100 - (max_edr * 200))))

        severity_map = {
            "SMOOTH": "info",
            "LIGHT CHOP": "info",
            "MODERATE": "warning"
        }

        finding_map = {
            "SMOOTH": f"Comfortable ride expected - score {comfort_score}/100",
            "LIGHT CHOP": f"Light chop possible - score {comfort_score}/100",
            "MODERATE": f"Moderate turbulence expected - score {comfort_score}/100"
        }

        severity = severity_map[ride_quality]
        finding = finding_map[ride_quality]

        return AgentResult(
            agent=self.name,
            T=T,
            finding=finding,
            severity=severity,
            data={
                "ride_quality": ride_quality,
                "edr_estimate": round(max_edr, 3),
                "affected_segment": affected_segment,
                "comfort_score": comfort_score,
                "severity": severity,
                "finding": finding,
                "analysis_method": "rule_based"
            }
        )

    def _flatten_coords(self, coords):
        if not coords:
            return []
        if isinstance(coords[0], (int, float)):
            return [coords]
        if coords[0] and isinstance(coords[0], list) and isinstance(coords[0][0], (int, float)):
            return coords
        if coords[0] and isinstance(coords[0], list) and coords[0][0] and isinstance(coords[0][0], list):
            result = []
            for ring in coords[0]:
                result.extend(ring)
            return result
        return []

    def _find_affected_segment(self, route, polygon_coords):
        for i in range(len(route) - 1):
            for coord in polygon_coords:
                # Validate coord is iterable with at least 2 elements
                if not isinstance(coord, (list, tuple)) or len(coord) < 2:
                    continue
                if haversine_nm(route[i].lat, route[i].lng, coord[1], coord[0]) < NM_THRESHOLD:
                    return f"{route[i].id}-{route[i+1].id}"
        return None
