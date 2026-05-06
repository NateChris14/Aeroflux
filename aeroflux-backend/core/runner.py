import asyncio
import logging
from typing import List
from core.snapshot import SimSnapshot
from agents.base import BaseAgent
from agents.supervisor_agent import SupervisorAgent
from models.recommendation import AgentResult, Recommendation

logger = logging.getLogger(__name__)


class AgentCycleRunner:
    def __init__(self, agents: List[BaseAgent], supervisor: SupervisorAgent):
        self.agents = agents
        self.supervisor = supervisor

    async def run_cycle(self, snapshot: SimSnapshot) -> tuple[List[AgentResult], Recommendation | None]:
        tasks = [agent.analyze(snapshot) for agent in self.agents]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        agent_results: List[AgentResult] = []
        for result in results:
            if isinstance(result, Exception):
                logger.error(f"Agent error: {result}")
                continue
            agent_results.append(result)

        recommendation = await self.supervisor.arbitrate(agent_results, snapshot)

        return agent_results, recommendation
