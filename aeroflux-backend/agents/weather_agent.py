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


class WeatherAgent(BaseAgent):
    def __init__(self):
        super().__init__("WEATHER")
        self.ollama = OllamaService()

    async def analyze(self, snapshot: SimSnapshot) -> AgentResult:
        rule_based_result = self._rule_based_analysis(snapshot)

        if not settings.USE_LLM_AGENTS:
            return rule_based_result

        try:
            llm_result = await self._llm_analysis(snapshot, rule_based_result.data)
            if llm_result:
                return llm_result
        except Exception as e:
            logger.warning(f"LLM analysis failed: {e}")

        return rule_based_result

    async def _llm_analysis(self, snapshot: SimSnapshot, rule_data: dict) -> AgentResult | None:
        active_route = snapshot.active_route
        sigmets = snapshot.sigmet_active
        pireps = snapshot.pireps

        route_str = ", ".join([f"{wp.id}({wp.lat},{wp.lng})" for wp in active_route[:3]])

        sigmet_str = "None"
        if sigmets:
            sigmet_str = "; ".join([
                f"SIGMET {s.get('id', 'unknown')}: {s.get('hazard', 'unknown')}"
                for s in sigmets[:2]
            ])

        pirep_str = "None"
        if pireps:
            pirep_str = "; ".join([
                f"PIREP turb={p.get('turbulence_intensity', 'none')}"
                for p in pireps[:2]
            ])

        prompt = f"""You are a flight meteorologist. Assess weather on the LHR→DEL route and quantify operational impact.

ROUTE (next 3 WPs): {route_str}
SIGMETs: {sigmet_str}
PIREPs: {pirep_str}
Rule-based turbulence: {rule_data.get('turbulence_severity', 'NONE')}

Consider: MODERATE turbulence requires route deviation (+8min, +400kg fuel). LIGHT turbulence is ride quality only — no divert needed. Clear air turbulence (CAT) is common over the Alps and Caucasus at FL350-FL390.

Respond with JSON only:
{{
    "finding": "Weather assessment with fuel/ETA impact (e.g. 'MODERATE CAT over FRA-VIE, divert adds 400kg')",
    "severity": "info|warning|critical",
    "turbulence_severity": "NONE|LIGHT|MODERATE|SEVERE",
    "reasoning": "Brief meteorological reasoning"
}}"""

        response = await self.ollama.generate_json(prompt, temperature=0.2)

        if not response or "finding" not in response:
            return None

        return AgentResult(
            agent=self.name,
            T=snapshot.T,
            finding=response.get("finding", "No weather data"),
            severity=response.get("severity", "info"),
            data={
                "turbulence_severity": response.get("turbulence_severity", rule_data.get("turbulence_severity", "NONE")),
                "affected_waypoints": rule_data.get("affected_waypoints", []),
                "sigmet_ids": rule_data.get("sigmet_ids", []),
                "llm_reasoning": response.get("reasoning", ""),
                "analysis_method": "llm"
            }
        )

    def _rule_based_analysis(self, snapshot: SimSnapshot) -> AgentResult:
        T = snapshot.T
        active_route = snapshot.active_route

        turbulence_severity = "NONE"
        affected_waypoints = []
        sigmet_ids = []

        for sigmet in snapshot.sigmet_active:
            coords = sigmet.get("geometry", {}).get("coordinates", [])
            if not coords:
                continue

            flat_coords = self._flatten_coords(coords)
            if not flat_coords:
                continue

            if route_intersects_polygon(active_route, flat_coords):
                turbulence_severity = max(turbulence_severity, "MODERATE", key=lambda x: ["NONE", "LIGHT", "MODERATE", "SEVERE"].index(x))
                sigmet_ids.append(sigmet.get("id", "unknown"))

                for wp in active_route:
                    for coord in flat_coords:
                        # Validate coord is iterable with at least 2 elements
                        if not isinstance(coord, (list, tuple)) or len(coord) < 2:
                            continue
                        if haversine_nm(wp.lat, wp.lng, coord[1], coord[0]) < NM_THRESHOLD:
                            if wp.id not in [w.id for w in affected_waypoints]:
                                affected_waypoints.append(wp)
                            break

        for pirep in snapshot.pireps:
            intensity = pirep.get("turbulence_intensity", "").upper()
            pirep_lat = pirep.get("latitude")
            pirep_lng = pirep.get("longitude")

            if pirep_lat is None or pirep_lng is None:
                continue

            for wp in active_route:
                if haversine_nm(wp.lat, wp.lng, pirep_lat, pirep_lng) < NM_THRESHOLD:
                    if intensity in ["LGT", "LIGHT"]:
                        turbulence_severity = max(turbulence_severity, "LIGHT", key=lambda x: ["NONE", "LIGHT", "MODERATE", "SEVERE"].index(x))
                    elif intensity in ["MOD", "MODERATE"]:
                        turbulence_severity = max(turbulence_severity, "MODERATE", key=lambda x: ["NONE", "LIGHT", "MODERATE", "SEVERE"].index(x))
                    elif intensity in ["SEV", "SEVERE", "HVY", "HEAVY"]:
                        turbulence_severity = max(turbulence_severity, "SEVERE", key=lambda x: ["NONE", "LIGHT", "MODERATE", "SEVERE"].index(x))

                    if wp.id not in [w.id for w in affected_waypoints]:
                        affected_waypoints.append(wp)
                    break

        severity_map = {
            "NONE": "info", "LIGHT": "info", "MODERATE": "warning", "SEVERE": "critical"
        }
        finding_map = {
            "NONE": "No significant weather hazards",
            "LIGHT": "Light turbulence possible",
            "MODERATE": "Moderate turbulence expected",
            "SEVERE": "Severe turbulence risk"
        }

        severity = severity_map[turbulence_severity]
        finding = finding_map[turbulence_severity]

        return AgentResult(
            agent=self.name, T=T, finding=finding,
            severity=severity,
            data={
                "turbulence_severity": turbulence_severity,
                "affected_waypoints": [wp.id for wp in affected_waypoints],
                "sigmet_ids": sigmet_ids,
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
