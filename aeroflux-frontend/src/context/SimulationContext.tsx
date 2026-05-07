import React, { createContext, useContext, useState, useRef } from 'react';
import type {
  FlightState, FuelState, Waypoint, AgentMessage,
  Recommendation, Decision, SigmetData, ATCTraffic,
} from '../types/flight';
import {
  INITIAL_FLIGHT_STATE, INITIAL_FUEL_STATE,
  PLANNED_ROUTE, ALTERNATE_ROUTE,
  MOCK_SIGMET, SIMULATION_EVENTS, MOCK_RECOMMENDATION,
  ATC_TRAFFIC_INITIAL,
} from '../utils/simulation-data';

// ─── Constants ────────────────────────────────────────────────────────────────
const SIM_MINUTES_PER_TICK = 10; // 10 sim-minutes per wall-clock tick
const TOTAL_TICKS = 45;          // LHR→DEL at 900 km/h ≈ 7.5 sim-hours
const HAS_BACKEND = !!import.meta.env.VITE_BACKEND_URL; // suppress mock recs when backend is live

// ─── Types ────────────────────────────────────────────────────────────────────
interface SimulationState {
  flightState:          FlightState;
  fuelState:            FuelState;
  activeRoute:          Waypoint[];
  alternateRoute:       Waypoint[];
  recommendedRoute:     Waypoint[] | null;  // pre-accept amber overlay
  isRunning:            boolean;
  tickCount:            number;
  simSpeed:             1 | 2 | 4;
  simElapsed:           number;
  agentMessages:        AgentMessage[];
  recommendations:      Recommendation[];
  decisions:            Decision[];
  sigmetActive:         SigmetData[];
  usingAlternateRoute:  boolean;
  altitudeHistory:      number[];
  fuelRateHistory:      number[];
  atcTraffic:           ATCTraffic[];
  eta:                  string;
}

interface SimulationContextType extends SimulationState {
  startSimulation:          () => void;
  pauseSimulation:          () => void;
  resetSimulation:          () => void;
  setSimSpeed:              (speed: 1 | 2 | 4) => void;
  acceptRecommendation:     (id: string) => void;
  dismissRecommendation:    (id: string) => void;
  injectEvent:              (eventType: string) => void;
  addAgentMessage:          (message: Omit<AgentMessage, 'id' | 'timestamp'>) => void;
  addBackendRecommendation: (rec: Recommendation) => void;
}

const SimulationContext = createContext<SimulationContextType | undefined>(undefined);

let messageIdCounter = 0;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function moveAtcAircraft(ac: ATCTraffic, simMinutes: number): ATCTraffic {
  const nmMoved   = ac.speed_kts * simMinutes / 60;
  const headRad   = ac.heading_deg * Math.PI / 180;
  const latRad    = ac.lat * Math.PI / 180;
  const dlat      = (nmMoved * Math.cos(headRad)) / 60;
  const dlng      = (nmMoved * Math.sin(headRad)) / (60 * Math.max(0.05, Math.cos(latRad)));
  return { ...ac, lat: ac.lat + dlat, lng: ac.lng + dlng };
}

// Great-circle interpolated position between two waypoints
function gcInterpolate(
  wp1: Waypoint, wp2: Waypoint, t: number
): { lat: number; lng: number } {
  const lat1 = wp1.lat * Math.PI / 180;
  const lng1 = wp1.lng * Math.PI / 180;
  const lat2 = wp2.lat * Math.PI / 180;
  const lng2 = wp2.lng * Math.PI / 180;

  const cosD = Math.sin(lat1) * Math.sin(lat2) + Math.cos(lat1) * Math.cos(lat2) * Math.cos(lng2 - lng1);
  const d    = Math.acos(Math.max(-1, Math.min(1, cosD)));

  if (d < 0.0001) return { lat: wp1.lat, lng: wp1.lng };

  const A  = Math.sin((1 - t) * d) / Math.sin(d);
  const B  = Math.sin(t * d) / Math.sin(d);
  const x  = A * Math.cos(lat1) * Math.cos(lng1) + B * Math.cos(lat2) * Math.cos(lng2);
  const y  = A * Math.cos(lat1) * Math.sin(lng1) + B * Math.cos(lat2) * Math.sin(lng2);
  const z  = A * Math.sin(lat1) + B * Math.sin(lat2);
  return {
    lat: Math.atan2(z, Math.sqrt(x * x + y * y)) * 180 / Math.PI,
    lng: Math.atan2(y, x) * 180 / Math.PI,
  };
}

// ─── Provider ─────────────────────────────────────────────────────────────────
export function SimulationProvider({ children }: { children: React.ReactNode }) {
  // Core flight data
  const [flightState,   setFlightState]  = useState<FlightState>(INITIAL_FLIGHT_STATE);
  const [fuelState,     setFuelState]    = useState<FuelState>(INITIAL_FUEL_STATE);
  const [activeRoute,   setActiveRouteState] = useState<Waypoint[]>(PLANNED_ROUTE);
  const [alternateRoute]                 = useState<Waypoint[]>(ALTERNATE_ROUTE);
  const [recommendedRoute, setRecommendedRoute] = useState<Waypoint[] | null>(null);

  // Sim control
  const [isRunning,  setIsRunning]  = useState(false);
  const [tickCount,  setTickCount]  = useState(0);
  const [simSpeed,   setSimSpeedState] = useState<1 | 2 | 4>(1);
  const [simElapsed, setSimElapsed] = useState(0);
  const [eta,        setEta]        = useState('07:30');

  // Agent data
  const [agentMessages,    setAgentMessages]    = useState<AgentMessage[]>([]);
  const [recommendations,  setRecommendations]  = useState<Recommendation[]>([]);
  const [decisions,        setDecisions]        = useState<Decision[]>([]);
  const [sigmetActive,     setSigmetActive]     = useState<SigmetData[]>([]);
  const [usingAlternateRoute, setUsingAlternateRoute] = useState(false);

  // Telemetry history
  const [altitudeHistory,  setAltitudeHistory]  = useState<number[]>([]);
  const [fuelRateHistory,  setFuelRateHistory]  = useState<number[]>([]);

  // ATC traffic
  const [atcTraffic, setAtcTraffic] = useState<ATCTraffic[]>(ATC_TRAFFIC_INITIAL);

  // Internal refs
  const intervalRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickRef          = useRef(0);
  const activeRouteRef   = useRef<Waypoint[]>(PLANNED_ROUTE);
  const simSpeedRef      = useRef<1 | 2 | 4>(1);
  const simulateTickRef  = useRef<() => void>(() => {});

  // Route transition — smooth blend from old position to new route over N ticks
  const TRANSITION_TICKS            = 8;
  const routeTransitionFromRef      = useRef<{ lat: number; lng: number } | null>(null);
  const routeTransitionStartTickRef = useRef<number>(0);

  // Speed override set by accepted SPEED_CHANGE recommendations (null = use tick default)
  const speedOverrideRef = useRef<number | null>(null);

  // Animation interval refs — cleared on reset so mid-animation resets don't leave ghost intervals
  const altAnimRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const spdAnimRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Keep activeRoute ref in sync (so tick always reads latest)
  const setActiveRoute = (route: Waypoint[]) => {
    activeRouteRef.current = route;
    setActiveRouteState(route);
  };

  const setSimSpeed = (speed: 1 | 2 | 4) => {
    simSpeedRef.current = speed;
    setSimSpeedState(speed);
  };

  // ── Internal message adder ──────────────────────────────────────────────────
  const addAgentMessageInternal = (
    msg: Omit<AgentMessage, 'id' | 'timestamp' | 'sim_elapsed'> & { sim_elapsed?: string }
  ) => {
    const tick = tickRef.current;
    const simSec = tick * SIM_MINUTES_PER_TICK * 60;
    const h = Math.floor(simSec / 3600).toString().padStart(2, '0');
    const m = Math.floor((simSec % 3600) / 60).toString().padStart(2, '0');
    const s = (simSec % 60).toString().padStart(2, '0');

    const newMessage: AgentMessage = {
      ...msg,
      id:          `msg-${++messageIdCounter}`,
      timestamp:   Date.now(),
      sim_elapsed: msg.sim_elapsed || `T+${h}:${m}:${s}`,
    };
    setAgentMessages(prev => [...prev.slice(-19), newMessage]);
  };

  // ── Simulation tick ─────────────────────────────────────────────────────────
  // Defined as a plain function every render so simulateTickRef.current always
  // has fresh closures (avoids stale-state bugs without complex deps arrays).
  const simulateTick = () => {
    tickRef.current += 1;
    const tick  = tickRef.current;
    const route = activeRouteRef.current;

    // Compute route-transition blend factor OUTSIDE setFlightState (refs are safe here)
    let transitionBlend: { from: { lat: number; lng: number }; t: number } | null = null;
    if (routeTransitionFromRef.current) {
      const elapsed = tick - routeTransitionStartTickRef.current;
      if (elapsed < TRANSITION_TICKS) {
        const rawT  = elapsed / TRANSITION_TICKS;
        const eased = rawT < 0.5 ? 2 * rawT * rawT : -1 + (4 - 2 * rawT) * rawT;
        transitionBlend = { from: routeTransitionFromRef.current, t: eased };
      } else {
        routeTransitionFromRef.current = null; // transition complete
      }
    }

    setTickCount(tick);
    // 10 sim-minutes = 600 sim-seconds per tick
    setSimElapsed(t => t + SIM_MINUTES_PER_TICK * 60);

    // ETA countdown
    const remainingMin = Math.max(0, (TOTAL_TICKS - tick) * SIM_MINUTES_PER_TICK);
    const etaH = Math.floor(remainingMin / 60);
    const etaM = remainingMin % 60;
    setEta(`${etaH.toString().padStart(2, '0')}:${etaM.toString().padStart(2, '0')}`);

    // ── Altitude / phase profile ──────────────────────────────────────────────
    setFlightState(prev => {
      let newAlt    = prev.altitude_ft;
      let newPhase  = prev.phase;
      let newVSpeed = prev.vertical_rate_fpm;
      let newSpeed  = prev.speed_kts;

      if (tick <= 4) {
        // Climb: 5,000 → 37,000 ft over 4 ticks; first tick lifts off from ground
        newAlt    = Math.min(37000, 5000 + (tick - 1) * 8000);
        newPhase  = 'CLIMB';
        newVSpeed = 2200;
        newSpeed  = Math.min(490, 200 + tick * 72);
      } else if (tick <= 36) {
        // Cruise at ~FL370 with gentle undulation (unless overridden by altitude change)
        if (prev.phase !== 'CLIMB' && prev.phase !== 'DESCENT') {
          newAlt = prev.altitude_ft + (Math.sin(tick * 0.4) * 50);
        }
        if (prev.phase !== 'DEVIATION') newPhase = 'CRUISE';
        newVSpeed = 0;
        newSpeed  = speedOverrideRef.current ?? 490;
      } else if (tick < TOTAL_TICKS) {
        // Descent: 37 000 → ~2 000 ft
        const dt  = tick - 36;
        newAlt    = Math.max(2000, 37000 - dt * 4200);
        newPhase  = 'DESCENT';
        newVSpeed = -1800;
        newSpeed  = Math.max(180, 490 - dt * 38);
      } else {
        // Arrived — taxi to gate
        newAlt    = 0;
        newPhase  = 'GROUND';
        newVSpeed = 0;
        newSpeed  = 0;
      }

      // ── Position along route (great-circle SLERP) ──────────────────────────
      const progress    = Math.min(1, tick / TOTAL_TICKS);
      const totalSegs   = route.length - 1;
      const wpIdxRaw    = progress * totalSegs;
      const wpIdx       = Math.min(Math.floor(wpIdxRaw), totalSegs - 1);
      const segProgress = wpIdxRaw - wpIdx;

      const cwp = route[wpIdx];
      const nwp = route[Math.min(wpIdx + 1, totalSegs)];
      let { lat: newLat, lng: newLng } = gcInterpolate(cwp, nwp, segProgress);

      // Apply smooth transition blend from old route position to new route position
      if (transitionBlend) {
        newLat = transitionBlend.from.lat + (newLat - transitionBlend.from.lat) * transitionBlend.t;
        newLng = transitionBlend.from.lng + (newLng - transitionBlend.from.lng) * transitionBlend.t;
      }

      // Heading: bearing from current pos → next waypoint
      const dLon   = (nwp.lng - newLng) * Math.PI / 180;
      const latR   = newLat * Math.PI / 180;
      const lat2R  = nwp.lat * Math.PI / 180;
      const yH     = Math.sin(dLon) * Math.cos(lat2R);
      const xH     = Math.cos(latR) * Math.sin(lat2R) - Math.sin(latR) * Math.cos(lat2R) * Math.cos(dLon);
      const newHdg = newPhase === 'GROUND'
        ? prev.heading_deg
        : (Math.atan2(yH, xH) * 180 / Math.PI + 360) % 360;

      return {
        ...prev,
        altitude_ft:          Math.round(newAlt),
        phase:                newPhase,
        vertical_rate_fpm:    newVSpeed,
        speed_kts:            Math.round(newSpeed),
        current_waypoint_idx: wpIdx,
        lat:                  newLat,
        lng:                  newLng,
        heading_deg:          Math.round(newHdg),
      };
    });

    // ── Fuel burn ─────────────────────────────────────────────────────────────
    setFuelState(prev => {
      const burnPerTick = prev.burn_rate_kg_per_min * SIM_MINUTES_PER_TICK;
      const newRemaining = Math.max(0, prev.remaining_kg - burnPerTick);
      return {
        ...prev,
        remaining_kg:           newRemaining,
        projected_remaining_kg: Math.max(0, newRemaining - 20000),
      };
    });

    // ── ATC traffic drift ─────────────────────────────────────────────────────
    setAtcTraffic(prev => prev.map(ac => moveAtcAircraft(ac, SIM_MINUTES_PER_TICK)));

    // ── Telemetry history (1 tick behind is acceptable for sparklines) ─────────
    setAltitudeHistory(prev => [...prev.slice(-11), flightState.altitude_ft]);
    setFuelRateHistory(prev => [...prev.slice(-11), fuelState.burn_rate_kg_per_min]);

    // ── Events ────────────────────────────────────────────────────────────────
    const event = SIMULATION_EVENTS[tick]?.();
    if (event) addAgentMessageInternal(event);

    // SIGMET window: ticks 5-12
    if (tick === 5)  setSigmetActive([MOCK_SIGMET]);
    if (tick === 14) setSigmetActive([]);

    // Dismiss stale recommendations when descent begins
    if (tick === 37) {
      speedOverrideRef.current = null;
      setRecommendations(prev =>
        prev.map(r => r.status === 'pending' ? { ...r, status: 'dismissed' } : r)
      );
      setRecommendedRoute(null);
    }

    // ── Recommendations ───────────────────────────────────────────────────────
    // Only fire mock recommendations when no backend is connected, and only during cruise
    const isCruise = tick > 4 && tick < 37;
    if (!HAS_BACKEND && isCruise) {
      const rec = MOCK_RECOMMENDATION(tick);
      if (rec) {
        setRecommendations(prev => [...prev, rec]);
        if (rec.action_type === 'ROUTE_CHANGE') {
          setRecommendedRoute(ALTERNATE_ROUTE);
        }
      }
    }

    // ── Stop on arrival ───────────────────────────────────────────────────────
    if (tick >= TOTAL_TICKS) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setIsRunning(false);
    }
  };

  // Keep ref updated each render so the interval always calls the latest version
  simulateTickRef.current = simulateTick;

  // ── Simulation control ──────────────────────────────────────────────────────
  const startSimulation = () => {
    if (intervalRef.current) return;
    setIsRunning(true);
    intervalRef.current = setInterval(
      () => simulateTickRef.current(),
      3000 / simSpeedRef.current,
    );
  };

  const pauseSimulation = () => {
    setIsRunning(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const resetSimulation = () => {
    pauseSimulation();
    if (altAnimRef.current) { clearInterval(altAnimRef.current); altAnimRef.current = null; }
    if (spdAnimRef.current) { clearInterval(spdAnimRef.current); spdAnimRef.current = null; }
    tickRef.current = 0;
    speedOverrideRef.current = null;
    setTickCount(0);
    setSimElapsed(0);
    setEta('07:30');
    setFlightState(INITIAL_FLIGHT_STATE);
    setFuelState(INITIAL_FUEL_STATE);
    setActiveRoute(PLANNED_ROUTE);
    setAgentMessages([]);
    setRecommendations([]);
    setDecisions([]);
    setSigmetActive([]);
    setUsingAlternateRoute(false);
    setAltitudeHistory([]);
    setFuelRateHistory([]);
    setAtcTraffic(ATC_TRAFFIC_INITIAL);
    setRecommendedRoute(null);
    messageIdCounter = 0;
  };

  const handleSetSimSpeed = (speed: 1 | 2 | 4) => {
    setSimSpeed(speed);
    if (isRunning && intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = setInterval(() => simulateTickRef.current(), 3000 / speed);
    }
  };

  // ── Accept recommendation ───────────────────────────────────────────────────
  const acceptRecommendation = (id: string) => {
    const rec = recommendations.find(r => r.id === id);

    setRecommendations(prev =>
      prev.map(r => r.id === id ? { ...r, status: 'accepted' } : r)
    );

    if (rec?.action_type === 'ROUTE_CHANGE') {
      // Capture current position so simulateTick can blend to the new route gradually
      routeTransitionFromRef.current      = { lat: flightState.lat, lng: flightState.lng };
      routeTransitionStartTickRef.current = tickRef.current;
      setActiveRoute(ALTERNATE_ROUTE);
      setUsingAlternateRoute(true);
      setRecommendedRoute(null);
      setFlightState(prev => ({ ...prev, phase: 'DEVIATION' }));
    }

    if (rec?.action_type === 'ALTITUDE_CHANGE') {
      const targetAlt = rec.action_params.new_altitude_ft as number;
      const startAlt  = flightState.altitude_ft;
      const isClimb   = targetAlt > startAlt;
      let step = 0;
      const totalSteps = 60; // 3 s at 50 ms

      if (altAnimRef.current) clearInterval(altAnimRef.current);
      altAnimRef.current = setInterval(() => {
        step++;
        const t      = Math.min(1, step / totalSteps);
        const eased  = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

        setFlightState(prev => ({
          ...prev,
          altitude_ft:       Math.round(startAlt + (targetAlt - startAlt) * eased),
          vertical_rate_fpm: t < 1 ? (isClimb ? 2200 : -1800) : 0,
          phase:             t < 1 ? (isClimb ? 'CLIMB' : 'DESCENT') : 'CRUISE',
        }));

        if (step >= totalSteps) { clearInterval(altAnimRef.current!); altAnimRef.current = null; }
      }, 50);
    }

    if (rec?.action_type === 'SPEED_CHANGE') {
      const targetSpeed = (rec.action_params.new_speed_kts as number) || 460;
      speedOverrideRef.current = targetSpeed;
      const startSpeed  = flightState.speed_kts;
      let step = 0;
      const totalSteps = 40; // 2 s at 50 ms

      if (spdAnimRef.current) clearInterval(spdAnimRef.current);
      spdAnimRef.current = setInterval(() => {
        step++;
        const t     = Math.min(1, step / totalSteps);
        const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

        setFlightState(prev => ({
          ...prev,
          speed_kts: Math.round(startSpeed + (targetSpeed - startSpeed) * eased),
        }));

        if (step >= totalSteps) { clearInterval(spdAnimRef.current!); spdAnimRef.current = null; }
      }, 50);
    }

    setDecisions(prev => [{
      id:          `dec-${Date.now()}`,
      timestamp:   Date.now(),
      action_type: rec?.action_type || 'UNKNOWN',
      result:      'accepted',
      summary:     rec?.title || 'Recommendation accepted',
    } as Decision, ...prev].slice(0, 5));
  };

  // ── Dismiss recommendation ──────────────────────────────────────────────────
  const dismissRecommendation = (id: string) => {
    const rec = recommendations.find(r => r.id === id);

    setRecommendations(prev =>
      prev.map(r => r.id === id ? { ...r, status: 'dismissed' } : r)
    );

    // Remove the recommended path overlay if it was for this recommendation
    if (rec?.action_type === 'ROUTE_CHANGE') {
      setRecommendedRoute(null);
    }

    setDecisions(prev => [{
      id:          `dec-${Date.now()}`,
      timestamp:   Date.now(),
      action_type: rec?.action_type || 'UNKNOWN',
      result:      'dismissed',
      summary:     rec?.title || 'Recommendation dismissed',
    } as Decision, ...prev].slice(0, 5));
  };

  // ── Inject event ────────────────────────────────────────────────────────────
  const injectEvent = (eventType: string) => {
    const eventMessages: Record<
      string,
      Omit<AgentMessage, 'id' | 'timestamp' | 'sim_elapsed'> & { sim_elapsed?: string }
    > = {
      'Turbulence': {
        agent: 'WEATHER', severity: 'warning',
        message: 'Injected: Severe turbulence detected ahead',
        finding: 'Immediate course correction advised',
      },
      'Headwind': {
        agent: 'FUEL', severity: 'warning',
        message: 'Injected: Strong headwind component +35 kts',
        finding: 'Fuel burn increased by 14%',
      },
      'ATC Hold': {
        agent: 'ATC', severity: 'critical',
        message: 'Injected: ATC holding pattern assigned — KHI sector',
        finding: 'Expect 18 min delay at Karachi FIR boundary',
      },
      'Engine Alert': {
        agent: 'SUPERVISOR', severity: 'critical',
        message: 'Injected: Engine performance anomaly — ENG2',
        finding: 'Check engine parameters immediately',
      },
    };
    const msg = eventMessages[eventType];
    if (msg) addAgentMessageInternal(msg);
  };

  const addAgentMessage = (msg: Omit<AgentMessage, 'id' | 'timestamp'>) =>
    addAgentMessageInternal(msg);

  const addBackendRecommendation = (rec: Recommendation) => {
    if (tickRef.current >= 37) return; // descent starts at tick 37; ref is always current

    // Skip if this action would have no observable effect
    if (rec.action_type === 'ROUTE_CHANGE' && usingAlternateRoute) return;
    if (rec.action_type === 'ALTITUDE_CHANGE') {
      const targetAlt = rec.action_params.new_altitude_ft as number;
      if (!isNaN(targetAlt) && Math.abs(flightState.altitude_ft - targetAlt) < 500) return;
    }
    if (rec.action_type === 'SPEED_CHANGE') {
      const targetSpd = rec.action_params.new_speed_kts as number;
      const currentSpd = speedOverrideRef.current ?? flightState.speed_kts;
      if (!isNaN(targetSpd) && Math.abs(currentSpd - targetSpd) < 15) return;
    }

    setRecommendations(prev => {
      if (prev.some(r => r.id === rec.id)) return prev;
      // Don't pile up multiple pending recommendations of the same type
      if (prev.some(r => r.status === 'pending' && r.action_type === rec.action_type)) return prev;
      return [...prev, rec];
    });

    if (rec.action_type === 'ROUTE_CHANGE') {
      setRecommendedRoute(ALTERNATE_ROUTE);
    }
  };

  return (
    <SimulationContext.Provider value={{
      flightState,
      fuelState,
      activeRoute,
      alternateRoute,
      recommendedRoute,
      isRunning,
      tickCount,
      simSpeed,
      simElapsed,
      agentMessages,
      recommendations,
      decisions,
      sigmetActive,
      usingAlternateRoute,
      altitudeHistory,
      fuelRateHistory,
      atcTraffic,
      eta,
      startSimulation,
      pauseSimulation,
      resetSimulation,
      setSimSpeed:           handleSetSimSpeed,
      acceptRecommendation,
      dismissRecommendation,
      injectEvent,
      addAgentMessage,
      addBackendRecommendation,
    }}>
      {children}
    </SimulationContext.Provider>
  );
}

export function useSimulation() {
  const context = useContext(SimulationContext);
  if (!context) throw new Error('useSimulation must be used within SimulationProvider');
  return context;
}
