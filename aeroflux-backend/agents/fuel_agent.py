import json
import logging
import math
from core.snapshot import SimSnapshot
from models.recommendation import AgentResult
from agents.base import BaseAgent
from utils.geo import haversine_nm, headwind_component
from utils.breguet import total_route_fuel
from services.ollama import OllamaService
from config import settings

logger = logging.getLogger(__name__)


class FuelAgent(BaseAgent):
    def __init__(self):
        super().__init__("FUEL")
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
        """Use Ollama LLM for fuel analysis."""
        flight = snapshot.flight_state
        fuel = snapshot.fuel_state
        wind = snapshot.wind_at_waypoints

        wind_str = "\n".join([
            f"- {wp_id}: {w.get('speed_ms', 0)}m/s from {w.get('direction_deg', 0)}deg"
            for wp_id, w in list(wind.items())[:3]
        ]) if wind else "No wind data"

        prompt = f"""You are a fuel optimization expert AI. PRIMARY GOAL: find actions that reduce fuel burn with minimal ETA impact.

FLIGHT STATUS:
- FL{int(flight.altitude_ft/100)}, {flight.speed_kts:.0f}kts, WP index {flight.current_waypoint_idx}

FUEL STATE:
- Remaining: {fuel.remaining_kg:.0f}kg (burn rate {fuel.burn_rate_kg_per_min:.1f}kg/min)
- Projected at destination: {rule_data.get('projected_remaining_kg', 0):.0f}kg
- Optimal reserve target: 12000kg

WIND DATA:
{wind_str}

RULE-BASED:
- Avg Headwind: {rule_data.get('avg_headwind_kts', 0):.1f}kts
- Finding: {rule_data.get('finding', 'No data')}

OPTIMIZATION GUIDANCE:
- Headwind > 15kts: recommend climbing to FL380-FL400 where winds are often more favorable (saves ~300-600kg)
- Speed 490kts in headwind: reducing to 460kts saves ~150kg/hr at cost of ~4min ETA
- Projected remaining < 15000kg: flag as warning, suggest speed reduction

Respond with JSON only:
{{
    "finding": "Fuel status + specific optimization opportunity if any",
    "severity": "info|warning|critical",
    "reasoning": "Quantified fuel analysis (e.g. '18kt headwind costing ~200kg extra')",
    "recommendation": "Specific action: altitude, speed, or route change with estimated saving"
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
                **rule_data,
                "llm_reasoning": response.get("reasoning", ""),
                "llm_recommendation": response.get("recommendation", ""),
                "analysis_method": "llm"
            }
        )

    def _rule_based_analysis(self, snapshot: SimSnapshot) -> AgentResult:
        """Rule-based fuel analysis."""
        T = snapshot.T
        wind_data = snapshot.wind_at_waypoints
        active_route = snapshot.active_route
        alternate_route = snapshot.alternate_route
        fuel_state = snapshot.fuel_state
        current_alt = snapshot.flight_state.altitude_ft
        speed_kts = snapshot.flight_state.speed_kts
        current_wp_idx = snapshot.flight_state.current_waypoint_idx

        wind_components = {}
        total_headwind = 0.0
        headwind_count = 0

        for wp in active_route:
            wp_wind = wind_data.get(wp.id, {})
            if wp_wind:
                wind_speed_ms = wp_wind.get("speed_ms", 0)
                wind_dir_deg = wp_wind.get("direction_deg", 0)

                heading_to_next = self._heading_to_waypoint(wp, active_route)
                headwind_kts = headwind_component(wind_speed_ms, wind_dir_deg, heading_to_next) * 1.944

                wind_components[wp.id] = {
                    "headwind_kts": round(headwind_kts, 1),
                    "wind_speed_ms": wind_speed_ms,
                    "wind_direction_deg": wind_dir_deg
                }

                if headwind_kts > 0:
                    total_headwind += headwind_kts
                    headwind_count += 1

        avg_headwind = total_headwind / headwind_count if headwind_count > 0 else 0.0

        remaining_fuel_active = total_route_fuel(
            active_route, wind_components, current_alt, speed_kts, current_wp_idx
        )

        alternate_fuel_delta = 0.0
        if alternate_route and len(alternate_route) > 0:
            remaining_fuel_alternate = total_route_fuel(
                alternate_route, wind_components, current_alt, speed_kts, current_wp_idx
            )
            alternate_fuel_delta = remaining_fuel_alternate - remaining_fuel_active

        current_burn_rate = fuel_state.burn_rate_kg_per_min if fuel_state else 0.0
        projected_remaining = fuel_state.remaining_kg - remaining_fuel_active if fuel_state else 0.0

        burn_delta = fuel_state.burn_delta_vs_planned_kg if fuel_state else 0.0

        if avg_headwind > 15:
            severity = "warning"
            finding = f"Significant headwind ({avg_headwind:.0f}kts) increasing fuel burn"
        elif projected_remaining < 2000:
            severity = "critical"
            finding = f"Low fuel projection: {projected_remaining:.0f}kg remaining at destination"
        elif burn_delta > 500:
            severity = "warning"
            finding = f"Higher than planned fuel burn: +{burn_delta:.0f}kg"
        else:
            severity = "info"
            finding = f"Fuel OK - {projected_remaining:.0f}kg projected remaining"

        return AgentResult(
            agent=self.name,
            T=T,
            finding=finding,
            severity=severity,
            data={
                "current_burn_rate_kg_per_min": round(current_burn_rate, 1),
                "projected_remaining_kg": round(projected_remaining, 1),
                "alternate_fuel_delta_kg": round(alternate_fuel_delta, 1),
                "wind_components": wind_components,
                "avg_headwind_kts": round(avg_headwind, 1),
                "severity": severity,
                "finding": finding,
                "analysis_method": "rule_based"
            }
        )

    def _heading_to_waypoint(self, wp, route):
        idx = None
        for i, w in enumerate(route):
            if w.id == wp.id:
                idx = i
                break

        if idx is None or idx >= len(route) - 1:
            return 0.0

        next_wp = route[idx + 1]
        lat1, lon1 = math.radians(wp.lat), math.radians(wp.lng)
        lat2, lon2 = math.radians(next_wp.lat), math.radians(next_wp.lng)

        dlon = lon2 - lon1
        x = math.sin(dlon) * math.cos(lat2)
        y = math.cos(lat1) * math.sin(lat2) - math.sin(lat1) * math.cos(lat2) * math.cos(dlon)

        bearing = math.atan2(x, y)
        return (math.degrees(bearing) + 360) % 360
