import json
import logging
import uuid
from typing import List, Optional
from core.snapshot import SimSnapshot
from models.recommendation import AgentResult, Recommendation, RecommendationMetrics
from services.ollama import OllamaService
from config import settings

logger = logging.getLogger(__name__)


class SupervisorAgent:
    def __init__(self):
        self.name = "SUPERVISOR"
        self.ollama = OllamaService()

    async def arbitrate(self, results: List[AgentResult], snapshot: SimSnapshot) -> Optional[Recommendation]:
        """Arbitrate agent results using rule-based logic or LLM."""
        if settings.USE_LLM_AGENTS:
            try:
                llm_rec = await self._llm_arbitrate(results, snapshot)
                if llm_rec:
                    return llm_rec
            except Exception as e:
                logger.warning(f"LLM arbitration failed, using rule-based: {e}")

        return self._rule_based_arbitrate(results, snapshot)

    async def _llm_arbitrate(self, results: List[AgentResult], snapshot: SimSnapshot) -> Optional[Recommendation]:
        """Use Ollama LLM for final arbitration."""
        T = snapshot.T
        flight = snapshot.flight_state

        # Build agent results summary
        agent_summary = []
        for r in results:
            agent_summary.append({
                "agent": r.agent,
                "severity": r.severity,
                "finding": r.finding,
                "data": r.data
            })

        prompt = f"""You are a Flight Operations Supervisor AI making final routing decisions.

FLIGHT STATUS:
- Position: {flight.callsign} at FL{int(flight.altitude_ft/100)}
- Speed: {flight.speed_kts:.0f}kts
- T: {T}

AGENT ANALYSES:
{json.dumps(agent_summary, indent=2)}

TASK: Decide if any action is needed based on agent inputs. Consider:
- Weather hazards (turbulence severity from WEATHER agent)
- Fuel efficiency headwinds (from FUEL agent)
- ATC constraints (from ATC agent)
- Passenger comfort (from COMFORT agent)

Respond with JSON only:
{{
    "action_required": true|false,
    "action_type": "ROUTE_CHANGE|ALTITUDE_CHANGE|SPEED_CHANGE|NONE",
    "title": "Brief action title",
    "description": "Detailed explanation",
    "confidence": 0.0-1.0,
    "reasoning": "Why this decision was made"
}}

If no action needed, set action_required=false and action_type=NONE."""

        response = await self.ollama.generate_json(prompt, temperature=0.3)

        if not response or "action_required" not in response:
            return None

        if not response.get("action_required", False):
            return None

        action_type = response.get("action_type", "NONE")
        if action_type == "NONE":
            return None

        # Build metrics based on agent data
        weather_data = next((r.data for r in results if r.agent == "WEATHER"), {})
        fuel_data = next((r.data for r in results if r.agent == "FUEL"), {})
        comfort_data = next((r.data for r in results if r.agent == "COMFORT"), {})

        metrics = RecommendationMetrics(
            turbulence_avoided_min=15.0 if action_type == "ROUTE_CHANGE" else 0.0,
            fuel_impact_kg=fuel_data.get("alternate_fuel_delta_kg", 0),
            eta_impact_min=5.0 if action_type == "ROUTE_CHANGE" else -3.0,
            ride_quality_improvement="HIGH" if comfort_data.get("ride_quality") == "MODERATE" else "MEDIUM"
        )

        action_params = {}
        if action_type == "ROUTE_CHANGE":
            action_params = {"new_route": "ALTERNATE_1", "reason": response.get("reasoning", "llm_arbitration")}
        elif action_type == "ALTITUDE_CHANGE":
            action_params = {"new_altitude_ft": 38000, "reason": response.get("reasoning", "llm_arbitration")}

        return Recommendation(
            id=str(uuid.uuid4()),
            T=T,
            sim_elapsed=snapshot.sim_elapsed,
            title=response.get("title", "AI Recommended Action"),
            description=response.get("description", "Based on LLM analysis"),
            action_type=action_type,
            action_params=action_params,
            metrics=metrics,
            agent_results=results,
            confidence=response.get("confidence", 0.7),
            status="pending"
        )

    def _rule_based_arbitrate(self, results: List[AgentResult], snapshot: SimSnapshot) -> Optional[Recommendation]:
        """Original rule-based arbitration as fallback."""
        T = snapshot.T
        sim_elapsed = snapshot.sim_elapsed

        weather_result = next((r for r in results if r.agent == "WEATHER"), None)
        fuel_result = next((r for r in results if r.agent == "FUEL"), None)
        atc_result = next((r for r in results if r.agent == "ATC"), None)
        comfort_result = next((r for r in results if r.agent == "COMFORT"), None)

        turbulence_severity = weather_result.data.get("turbulence_severity", "NONE") if weather_result else "NONE"
        avg_headwind = fuel_result.data.get("avg_headwind_kts", 0) if fuel_result else 0
        current_alt = snapshot.flight_state.altitude_ft
        current_fl = int(current_alt / 100)
        altitude_blocked = atc_result.data.get("altitude_blocked", False) if atc_result else False
        ride_quality = comfort_result.data.get("ride_quality", "SMOOTH") if comfort_result else "SMOOTH"

        action_type = None
        action_params = {}
        title = ""
        description = ""
        confidence = 0.0
        agent_results_used = []

        if weather_result and turbulence_severity in ["MODERATE", "SEVERE"]:
            action_type = "ROUTE_CHANGE"
            title = "Weather Avoidance Recommended"
            description = f"{turbulence_severity} turbulence detected along route. Consider alternate route."
            action_params = {"new_route": "ALTERNATE_1", "reason": "turbulence_avoidance"}
            confidence = 0.85 if turbulence_severity == "SEVERE" else 0.70
            agent_results_used = [weather_result]

        elif fuel_result and avg_headwind > 30 and current_fl < 360:
            action_type = "ALTITUDE_CHANGE"
            title = "Altitude Change for Fuel Efficiency"
            description = f"Headwind {avg_headwind:.0f}kts at current altitude. Recommend climb to FL360+ for tailwind."
            action_params = {"new_altitude_ft": 38000, "reason": "fuel_optimization"}
            confidence = 0.75
            agent_results_used = [fuel_result]

        elif atc_result and altitude_blocked:
            action_type = "ALTITUDE_CHANGE"
            title = "ATC Altitude Deviation Required"
            available_corridors = atc_result.data.get("available_corridors", [])
            description = f"Current altitude blocked. Available: {available_corridors}"
            if available_corridors:
                action_params = {"new_altitude_ft": available_corridors[0]["fl_min"] * 100, "reason": "atc_constraint"}
            confidence = 0.90
            agent_results_used = [atc_result]

        elif comfort_result and ride_quality == "MODERATE":
            action_type = "ALTITUDE_CHANGE"
            title = "Comfort Improvement Recommended"
            description = "Moderate turbulence expected. Altitude change may improve ride quality."
            action_params = {"new_altitude_ft": current_alt + 2000, "reason": "comfort_improvement"}
            confidence = 0.60
            agent_results_used = [comfort_result]

        if action_type is None:
            return None

        metrics = RecommendationMetrics(
            turbulence_avoided_min=15.0 if action_type == "ROUTE_CHANGE" else 0.0,
            fuel_impact_kg=fuel_result.data.get("alternate_fuel_delta_kg", 0) if fuel_result else 0.0,
            eta_impact_min=5.0 if action_type == "ROUTE_CHANGE" else -3.0,
            ride_quality_improvement="HIGH" if ride_quality == "MODERATE" else "MEDIUM"
        )

        # Include all agent results
        for r in [weather_result, fuel_result, atc_result, comfort_result]:
            if r and r not in agent_results_used:
                agent_results_used.append(r)

        return Recommendation(
            id=str(uuid.uuid4()),
            T=T,
            sim_elapsed=sim_elapsed,
            title=title,
            description=description,
            action_type=action_type,
            action_params=action_params,
            metrics=metrics,
            agent_results=agent_results_used,
            confidence=confidence,
            status="pending"
        )
