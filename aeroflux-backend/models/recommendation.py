from typing import Optional
from pydantic import BaseModel


class RecommendationMetrics(BaseModel):
    turbulence_avoided_min: float
    fuel_impact_kg: float
    eta_impact_min: float
    ride_quality_improvement: str


class AgentResult(BaseModel):
    agent: str
    T: int
    finding: str
    severity: str
    data: dict


class Recommendation(BaseModel):
    id: str
    T: int
    sim_elapsed: str
    title: str
    description: str
    action_type: str
    action_params: dict
    metrics: RecommendationMetrics
    agent_results: list[AgentResult]
    confidence: float
    status: str
