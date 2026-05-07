import json
import logging
from core.snapshot import SimSnapshot
from models.recommendation import AgentResult
from agents.base import BaseAgent
from services.ollama import OllamaService
from config import settings

logger = logging.getLogger(__name__)

ATC_CONSTRAINTS = [
    {"type": "ALTITUDE_BLOCK", "fl_min": 350, "fl_max": 390, "valid_ticks": [10, 16], "description": "Altitude block FL350-FL390 active over European airspace"},
    {"type": "SPEED_RESTRICTION", "max_kts": 440, "valid_ticks": [20, 23], "description": "Speed restriction max 440kts due to traffic over Turkey"},
    {"type": "HOLD", "waypoint": "AKTIM", "valid_ticks": [25, 27], "description": "HOLD at AKTIM, expect 2 tick delay"},
]


class ATCAgent(BaseAgent):
    def __init__(self):
        super().__init__("ATC")
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
        """Use Ollama LLM for ATC analysis."""
        flight = snapshot.flight_state
        constraints = rule_data.get("active_constraints", [])

        constraints_str = "\n".join([
            f"- {c.get('type')}: {c.get('description', '')}"
            for c in constraints
        ]) if constraints else "No active constraints"

        prompt = f"""You are an Air Traffic Control expert AI. Goal: ensure compliance AND find efficient routing opportunities.

FLIGHT STATUS:
- {flight.callsign} at FL{int(flight.altitude_ft/100)}, {flight.speed_kts:.0f}kts, tick {snapshot.tick_count}

ACTIVE CONSTRAINTS:
{constraints_str}

RULE-BASED:
- Altitude Blocked: {rule_data.get('altitude_blocked', False)}
- Available Corridors: {rule_data.get('available_corridors', [])}
- Finding: {rule_data.get('finding', 'No data')}

Consider: If altitude is blocked, identify the most fuel-efficient available corridor. FL380-FL400 typically gives better winds than FL350. Even if no constraints are active, flag if a step-climb clearance to FL380+ would be beneficial.

Respond with JSON only:
{{
    "finding": "ATC status + efficiency opportunity if any",
    "severity": "info|warning|critical",
    "reasoning": "ATC and efficiency reasoning",
    "clearance_recommendation": "Specific FL and reason (e.g., 'Request FL390 for tailwind advantage')"
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
                "llm_clearance_recommendation": response.get("clearance_recommendation", ""),
                "analysis_method": "llm"
            }
        )

    def _rule_based_analysis(self, snapshot: SimSnapshot) -> AgentResult:
        """Rule-based ATC analysis."""
        T = snapshot.T
        tick_count = snapshot.tick_count
        current_alt = snapshot.flight_state.altitude_ft
        current_fl = int(current_alt / 100)

        active_constraints = []
        available_corridors = []

        for constraint in ATC_CONSTRAINTS:
            valid_ticks = constraint.get("valid_ticks", [])
            if tick_count >= valid_ticks[0] and tick_count <= valid_ticks[1]:
                active_constraints.append(constraint)

        severity = "info"
        finding = "No active ATC constraints"

        altitude_blocked = False
        speed_restricted = False

        for constraint in active_constraints:
            if constraint["type"] == "ALTITUDE_BLOCK":
                fl_min = constraint.get("fl_min", 0)
                fl_max = constraint.get("fl_max", 999)
                if fl_min <= current_fl <= fl_max:
                    altitude_blocked = True
                    available_corridors = [
                        {"fl_min": fl_max + 1, "fl_max": 450},
                        {"fl_min": 180, "fl_max": fl_min - 1}
                    ]
            elif constraint["type"] == "SPEED_RESTRICTION":
                speed_restricted = True

        if altitude_blocked:
            severity = "warning"
            finding = f"Altitude FL{current_fl} blocked - available: {available_corridors}"
        elif speed_restricted:
            severity = "info"
            finding = "Speed restriction active - max 440kts"
        elif active_constraints:
            severity = "info"
            finding = f"{len(active_constraints)} ATC constraint(s) active"

        return AgentResult(
            agent=self.name,
            T=T,
            finding=finding,
            severity=severity,
            data={
                "active_constraints": active_constraints,
                "available_corridors": available_corridors,
                "current_fl": current_fl,
                "altitude_blocked": altitude_blocked,
                "severity": severity,
                "finding": finding,
                "analysis_method": "rule_based"
            }
        )
