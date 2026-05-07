import asyncio
import logging
from datetime import datetime, timezone
from typing import Optional
import httpx
from core.data_cache import DataCache

logger = logging.getLogger(__name__)

BASE_URL = "https://aviationweather.gov/api/data"


class AviationWeatherService:
    def __init__(self, cache: DataCache):
        self.cache = cache
        self._client: Optional[httpx.AsyncClient] = None

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient()
        return self._client

    def _iso_to_timestamp(self, iso_str: str) -> int:
        try:
            dt = datetime.fromisoformat(iso_str.replace("Z", "+00:00"))
            return int(dt.timestamp())
        except Exception:
            return 0

    async def poll_metar(self, station_ids: list[str], interval_s: int = 60):
        while True:
            try:
                client = await self._get_client()
                ids_param = ",".join(station_ids)
                url = f"{BASE_URL}/metar?ids={ids_param}&format=json"

                response = await client.get(url, timeout=15.0)
                response.raise_for_status()
                data = response.json()

                T = int(datetime.now(timezone.utc).timestamp())
                metar_bucket = (T // 60) * 60

                await self.cache.update_metar(metar_bucket, {"stations": data, "timestamp": T})
                logger.debug(f"Updated METAR for {len(data)} stations")

            except Exception as e:
                logger.warning(f"METAR poll error: {e}")

            await asyncio.sleep(interval_s)

    async def poll_sigmets(self, interval_s: int = 60):
        while True:
            try:
                client = await self._get_client()
                url = f"{BASE_URL}/airsigmet?format=geojson"

                response = await client.get(url, timeout=15.0)
                response.raise_for_status()
                data = response.json()

                features = data.get("features", [])
                sigmets = []

                for feature in features:
                    props = feature.get("properties", {})
                    geometry = feature.get("geometry", {})

                    valid_from = self._iso_to_timestamp(props.get("validTimeFrom", ""))
                    valid_to = self._iso_to_timestamp(props.get("validTimeTo", ""))

                    sigmet = {
                        "id": props.get("id", "unknown"),
                        "hazard": props.get("hazard", ""),
                        "severity": props.get("severity", ""),
                        "altitude_low": props.get("altitudeLow1"),
                        "altitude_high": props.get("altitudeHi1"),
                        "valid_from": valid_from,
                        "valid_to": valid_to,
                        "geometry": geometry
                    }
                    sigmets.append(sigmet)

                await self.cache.update_sigmets(sigmets)
                logger.debug(f"Updated {len(sigmets)} SIGMETs")

            except Exception as e:
                logger.warning(f"SIGMET poll error: {e}")

            await asyncio.sleep(interval_s)

    async def poll_pireps(self, interval_s: int = 60):
        while True:
            try:
                client = await self._get_client()
                # bbox covers LHR→DEL corridor; age=2 fetches last 2 hours of reports
                # New AWC API requires bbox or id — bare ?hours= is no longer valid
                url = f"{BASE_URL}/pirep?bbox=10,-10,60,90&age=2&format=json"

                response = await client.get(url, timeout=15.0)
                response.raise_for_status()
                data = response.json()

                pireps = []
                for item in data if isinstance(data, list) else []:
                    # New AWC field names first, old names as fallback
                    pirep = {
                        "id":                   item.get("pirepId")           or item.get("reportId", "unknown"),
                        "latitude":             item.get("lat")               or item.get("latitude"),
                        "longitude":            item.get("lon")               or item.get("longitude"),
                        "altitude":             item.get("fltLvl")            or item.get("altitude"),
                        "aircraft_type":        item.get("acType")            or item.get("aircraftType", ""),
                        "turbulence_intensity": item.get("tbInt1")            or item.get("turbulenceIntensity", ""),
                        "turbulence_type":      item.get("tbType1")           or item.get("turbulenceType", ""),
                        "icing_intensity":      item.get("icgInt1")           or item.get("icingIntensity", ""),
                        "report":               item.get("rawOb")             or item.get("report", ""),
                        "timestamp":            self._iso_to_timestamp(
                                                    item.get("obsTime") or item.get("reportTime", "")
                                                ),
                    }
                    pireps.append(pirep)

                await self.cache.update_pireps(pireps)
                logger.debug(f"Updated {len(pireps)} PIREPs")

            except Exception as e:
                logger.warning(f"PIREP poll error: {e}")

            await asyncio.sleep(interval_s)
