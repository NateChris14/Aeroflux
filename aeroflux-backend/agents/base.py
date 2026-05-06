from abc import ABC, abstractmethod
from core.snapshot import SimSnapshot
from models.recommendation import AgentResult


class BaseAgent(ABC):
    def __init__(self, name: str):
        self.name = name

    @abstractmethod
    async def analyze(self, snapshot: SimSnapshot) -> AgentResult:
        pass
