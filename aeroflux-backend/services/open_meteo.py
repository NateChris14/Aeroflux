import asyncio
import logging
from datetime import datetime, timezone
import httpx
from core.data_cache import DataCache
from models.flight import Waypoint

logger = logging.getLogger(__name__)

BASE_URL = "https://api.open-meteo.com/v1/forecast"


class OpenMeteoService:
    def __init__(self, cache: DataCache):
        self.cache = cache
        self._client: Optional[httpx.AsyncClient] = None

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient()
        return self._client

    async def poll_waypoints(self, waypoints: list[Waypoint], interval_s: int = 3600):
        while True:
            try:
                T = int(datetime.now(timezone.utc).timestamp())
                wind_hour_bucket = (T // 3600) * 3600

                wind_data = {}
                client = await self._get_client()

                for wp in waypoints:
                    try:
                        url = (
                            f"{BASE_URL}?"
                            f"latitude={wp.lat}&"
                            f"longitude={wp.lng}&"
                            f"hourly=windspeed_80m,winddirection_80m,windspeed_180m,winddirection_180m&"
                            f"wind_speed_unit=ms&"
                            f"forecast_days=1"
                        )

                        response = await client.get(url, timeout=15.0)
                        response.raise_for_status()
                        data = response.json()

                        hourly = data.get("hourly", {})
                        times = hourly.get("time", [])

                        if times:
                            wind_data[wp.id] = {
                                "speed_ms": hourly.get("windspeed_180m", [0])[0] or hourly.get("windspeed_80m", [0])[0] or 0,
                                "direction_deg": hourly.get("winddirection_180m", [0])[0] or hourly.get("winddirection_80m", [0])[0] or 0,
                                "timestamp": T
                            }

                    except Exception as e:
                        logger.warning(f"Open-Meteo error for waypoint {wp.id}: {e}")
                        wind_data[wp.id] = {"speed_ms": 0, "direction_deg": 0, "timestamp": T}

                await self.cache.update_wind(wind_hour_bucket, wind_data)
                logger.debug(f"Updated wind data for {len(wind_data)} waypoints")

            except Exception as e:
                logger.warning(f"Open-Meteo poll error: {e}")

            await asyncio.sleep(interval_s)


from typing import Optional
