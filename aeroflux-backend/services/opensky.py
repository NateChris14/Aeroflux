import asyncio
import logging
import time
from typing import Optional
import httpx
from core.data_cache import DataCache
from core.clock import SimClock
from models.flight import FlightState
from config import settings

logger = logging.getLogger(__name__)

TOKEN_URL = "https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token"
STATES_URL = "https://opensky-network.org/api/states/all"


class OpenSkyService:
    def __init__(self, icao24: str, cache: DataCache, clock: SimClock):
        self.icao24 = icao24.lower()
        self.cache = cache
        self.clock = clock
        self.access_token: Optional[str] = None
        self._client: Optional[httpx.AsyncClient] = None
        self._last_fetch_all_time: float = 0
        self._fetch_all_cooldown: int = 60  # seconds between full state fetches
        self._discovered_icao: Optional[str] = None

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient()
        return self._client

    async def _fetch_token(self) -> str:
        if not settings.OPENSKY_CLIENT_ID or not settings.OPENSKY_CLIENT_SECRET:
            logger.warning("OpenSky credentials not configured")
            return ""

        client = await self._get_client()
        try:
            response = await client.post(
                TOKEN_URL,
                data={
                    "grant_type": "client_credentials",
                    "client_id": settings.OPENSKY_CLIENT_ID,
                    "client_secret": settings.OPENSKY_CLIENT_SECRET
                }
            )
            response.raise_for_status()
            data = response.json()
            return data.get("access_token", "")
        except Exception as e:
            logger.warning(f"Failed to fetch OpenSky token: {e}")
            return ""

    def _parse_state_vector(self, raw: list) -> FlightState:
        return FlightState(
            icao24=raw[0] if raw[0] else "",
            callsign=raw[1].strip() if raw[1] else "",
            lng=raw[5] if raw[5] else 0.0,
            lat=raw[6] if raw[6] else 0.0,
            altitude_ft=(raw[7] * 3.281) if raw[7] else 0.0,
            speed_kts=(raw[9] * 1.944) if raw[9] else 0.0,
            heading_deg=raw[10] if raw[10] else 0.0,
            vertical_rate_fpm=(raw[11] * 196.85) if raw[11] else 0.0,
            on_ground=bool(raw[8]) if raw[8] is not None else False,
            flight_phase="CRUISE",
            current_waypoint_idx=0,
            T=int(time.time())
        )

    async def _fetch_all_states(self, limit: int = 100) -> list:
        """Fetch all active aircraft states with rate limiting."""
        # Check cooldown to avoid 429 rate limit
        current_time = time.time()
        if current_time - self._last_fetch_all_time < self._fetch_all_cooldown:
            logger.debug(f"Fetch all states on cooldown, waiting {self._fetch_all_cooldown}s")
            return []

        self._last_fetch_all_time = current_time

        if not self.access_token:
            self.access_token = await self._fetch_token()

        client = await self._get_client()
        try:
            headers = {}
            if self.access_token:
                headers["Authorization"] = f"Bearer {self.access_token}"

            # Fetch states without ICAO24 filter to get all aircraft
            response = await client.get(
                STATES_URL,
                headers=headers,
                timeout=15.0
            )
            response.raise_for_status()
            data = response.json()

            states = data.get("states", [])
            if not states:
                return []

            # Filter for active aircraft (have position, altitude, and speed)
            active = []
            for state in states[:limit]:
                if (state[5] is not None and  # longitude
                    state[6] is not None and  # latitude
                    state[7] is not None and   # altitude
                    state[9] is not None and   # velocity
                    state[9] > 50):            # speed > 50 m/s (~100 kts)
                    active.append(state)

            return active

        except httpx.HTTPStatusError as e:
            if e.response.status_code == 429:
                logger.warning("OpenSky rate limit hit (429), backing off...")
                # Increase cooldown on rate limit
                self._fetch_all_cooldown = min(self._fetch_all_cooldown * 2, 300)
            else:
                logger.warning(f"OpenSky HTTP error: {e}")
            return []
        except Exception as e:
            logger.warning(f"OpenSky fetch all states error: {e}")
            return []

    async def _find_active_aircraft(self) -> Optional[str]:
        """Auto-discover an active aircraft with caching."""
        # Use cached discovery if available
        if self._discovered_icao:
            logger.debug(f"Using cached aircraft: {self._discovered_icao}")
            return self._discovered_icao

        states = await self._fetch_all_states(limit=200)

        if not states:
            logger.warning("No active aircraft found (rate limit or no flights)")
            return None

        # Pick first active aircraft
        selected = states[0]
        icao24 = selected[0]
        callsign = selected[1].strip() if selected[1] else "Unknown"
        lat = selected[6]
        lng = selected[5]
        alt = selected[7]
        speed = selected[9] * 1.944 if selected[9] else 0  # m/s to kts

        logger.info(f"Auto-selected aircraft: {icao24} ({callsign}) at ({lat:.2f}, {lng:.2f}), {alt}m, {speed:.0f}kts")

        self._discovered_icao = icao24.lower()
        self.icao24 = self._discovered_icao
        return self._discovered_icao

    async def _poll_once(self) -> Optional[FlightState]:
        # Auto-discover aircraft if not specified
        if not self.icao24 or self.icao24 == "auto":
            icao = await self._find_active_aircraft()
            if not icao:
                # Return None - poll_forever will retry next tick
                return None

        if not self.access_token:
            self.access_token = await self._fetch_token()

        client = await self._get_client()
        try:
            headers = {}
            if self.access_token:
                headers["Authorization"] = f"Bearer {self.access_token}"

            response = await client.get(
                STATES_URL,
                params={"icao24": self.icao24},
                headers=headers,
                timeout=10.0
            )
            response.raise_for_status()
            data = response.json()

            states = data.get("states", [])
            if not states:
                logger.debug(f"No state data for {self.icao24}")
                return None

            return self._parse_state_vector(states[0])

        except httpx.HTTPStatusError as e:
            if e.response.status_code == 401:
                self.access_token = await self._fetch_token()
            logger.warning(f"OpenSky API error: {e}")
            return None
        except Exception as e:
            logger.warning(f"OpenSky poll error: {e}")
            return None

    async def poll_forever(self, interval_s: int = 5):
        while True:
            try:
                state = await self._poll_once()
                if state:
                    await self.cache.update_flight_state(self.clock.T, state)
                else:
                    logger.debug("No flight state available, using last known")
            except Exception as e:
                logger.error(f"OpenSky poll loop error: {e}")

            await asyncio.sleep(interval_s)


class FlightSimulator:
    def __init__(self, cache: DataCache, clock: SimClock):
        self.cache = cache
        self.clock = clock
        self.tick_count = 0

        self.waypoints = [
            {"id": "DEL", "label": "Delhi (VIDP)", "lat": 28.5562, "lng": 77.10},
            {"id": "PETUS", "label": "PETUS", "lat": 27.2, "lng": 75.8},
            {"id": "VAGAD", "label": "VAGAD", "lat": 25.5, "lng": 74.2},
            {"id": "OPULA", "label": "OPULA", "lat": 23.8, "lng": 73.0},
            {"id": "LOVIM", "label": "LOVIM", "lat": 22.4, "lng": 72.1},
            {"id": "AKTIM", "label": "AKTIM", "lat": 21.2, "lng": 71.3},
            {"id": "BOM", "label": "Mumbai (VABB)", "lat": 19.0896, "lng": 72.8656},
        ]

        self.fuel_kg = 18500.0
        self.callsign = "AIC101"
        self.icao24 = "8003c2"

    async def simulate_tick(self):
        self.tick_count += 1
        T = self.clock.T

        # Slower progression: 12 ticks per waypoint (4 minutes at 20s ticks)
        ticks_per_wp = 12
        wp_idx = min(self.tick_count // ticks_per_wp, len(self.waypoints) - 1)
        next_wp_idx = min(wp_idx + 1, len(self.waypoints) - 1)

        wp = self.waypoints[wp_idx]
        next_wp = self.waypoints[next_wp_idx]

        progress = (self.tick_count % ticks_per_wp) / ticks_per_wp
        lat = wp["lat"] + (next_wp["lat"] - wp["lat"]) * progress
        lng = wp["lng"] + (next_wp["lng"] - wp["lng"]) * progress

        # Extended altitude profile for slower flight
        if self.tick_count < 6:  # Initial climb to FL280
            altitude_ft = 0 + (28000 - 0) * (self.tick_count / 6)
            phase = "CLIMB"
        elif self.tick_count < 12:  # Climb to FL360
            altitude_ft = 28000 + (36000 - 28000) * ((self.tick_count - 6) / 6)
            phase = "CLIMB"
        elif self.tick_count < 60:  # Extended cruise (48 ticks = ~16 minutes)
            altitude_ft = 36000
            phase = "CRUISE"
        elif self.tick_count < 72:  # Gradual descent
            altitude_ft = max(15000, 36000 - (self.tick_count - 60) * 1750)
            phase = "DESCENT"
        else:  # Final approach
            altitude_ft = max(0, 15000 - (self.tick_count - 72) * 2500)
            phase = "APPROACH" if altitude_ft > 500 else "LANDED"

        speed_kts = 420 + ((self.tick_count * 7) % 40)
        heading = self._bearing(lat, lng, next_wp["lat"], next_wp["lng"])

        burn = self._fuel_burn(altitude_ft, speed_kts)
        self.fuel_kg = max(0, self.fuel_kg - burn)

        state = FlightState(
            icao24=self.icao24,
            callsign=self.callsign,
            lat=round(lat, 4),
            lng=round(lng, 4),
            altitude_ft=round(altitude_ft, 0),
            speed_kts=round(speed_kts, 1),
            heading_deg=round(heading, 1),
            vertical_rate_fpm=500 if phase == "CLIMB" else (-800 if phase == "DESCENT" else 0),
            on_ground=False,
            flight_phase=phase,
            current_waypoint_idx=wp_idx,
            T=T
        )

        await self.cache.update_flight_state(T, state)
        logger.debug(f"Simulated tick {self.tick_count}: {state.lat}, {state.lng} @ {state.altitude_ft}ft")

    def _bearing(self, lat1, lon1, lat2, lon2):
        import math
        lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])
        dlon = lon2 - lon1
        x = math.sin(dlon) * math.cos(lat2)
        y = math.cos(lat1) * math.sin(lat2) - math.sin(lat1) * math.cos(lat2) * math.cos(dlon)
        return (math.degrees(math.atan2(x, y)) + 360) % 360

    def _fuel_burn(self, altitude_ft, speed_kts):
        base_burn = 2450 / 12
        alt_factor = 0.95 if 35000 <= altitude_ft <= 39000 else 1.0
        return base_burn * alt_factor

    async def run_forever(self, interval_s: int = 5):
        while True:
            await self.simulate_tick()
            await asyncio.sleep(interval_s)
