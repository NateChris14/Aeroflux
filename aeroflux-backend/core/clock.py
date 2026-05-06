import time
from datetime import datetime, timezone


class SimClock:
    def __init__(self, tick_interval_s: int = 5, mode: str = "live"):
        self.tick_interval_s = tick_interval_s
        self.mode = mode

        if mode == "live":
            self.T = int(time.time())
        else:
            self.T = int(time.time())

        self.start_T = self.T
        self.tick_count = 0

    def advance(self) -> int:
        self.T += self.tick_interval_s
        self.tick_count += 1
        return self.T

    def metar_bucket(self) -> int:
        return (self.T // 60) * 60

    def wind_bucket(self) -> int:
        return (self.T // 3600) * 3600

    def sim_elapsed_label(self) -> str:
        elapsed_seconds = self.T - self.start_T
        hours = elapsed_seconds // 3600
        minutes = (elapsed_seconds % 3600) // 60
        seconds = elapsed_seconds % 60
        return f"T+{hours:02d}:{minutes:02d}:{seconds:02d}"

    def wall_time_utc(self) -> str:
        dt = datetime.fromtimestamp(self.T, tz=timezone.utc)
        return dt.strftime("%Y-%m-%dT%H:%M:%SZ")
