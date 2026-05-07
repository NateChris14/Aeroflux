import { useMemo } from 'react';
import { useSimulation } from '../../context/SimulationContext';
import { useBackendSync } from '../../hooks/useBackendSync';
import { RecommendationCard } from '../RecommendationCard';
import { Zap, Fuel, Clock, Target, Route } from 'lucide-react';
import { PLANNED_ROUTE, ALTERNATE_ROUTE } from '../../utils/simulation-data';
import type { Waypoint } from '../../types/flight';

// Haversine distance in nautical miles
function haversineNm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3440.065; // Earth radius in NM
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function routeDistanceNm(route: Waypoint[]): number {
  let total = 0;
  for (let i = 0; i < route.length - 1; i++) {
    total += haversineNm(route[i].lat, route[i].lng, route[i + 1].lat, route[i + 1].lng);
  }
  return Math.round(total);
}

export function RightPanel() {
  const { recommendations, decisions, usingAlternateRoute, eta, fuelState, flightState, agentMessages, tickCount } = useSimulation();
  const { acceptRecommendation, dismissRecommendation } = useBackendSync();

  const pendingRecs = recommendations.filter(r => r.status === 'pending');
  const activeRec   = pendingRecs[pendingRecs.length - 1];

  const fuelRemaining = Math.round(fuelState.remaining_kg).toLocaleString();

  // Total route distances (static reference)
  const plannedTotalNm   = useMemo(() => routeDistanceNm(PLANNED_ROUTE),   []);
  const alternateTotalNm = useMemo(() => routeDistanceNm(ALTERNATE_ROUTE), []);

  // Wind component: planned route faces headwind through Eastern Europe jet stream band;
  // alternate route (southern path) captures tailwind from the subtropical jet
  const PLANNED_WIND_KTS   = -32; // headwind penalty on planned route
  const ALTERNATE_WIND_KTS = +22; // tailwind benefit on alternate southern path

  // Remaining distances shrink tick-by-tick so the panel stays live
  const progress             = Math.min(1, tickCount / 45);
  const plannedRemainingNm   = Math.round(plannedTotalNm   * (1 - progress));
  const alternateRemainingNm = Math.round(alternateTotalNm * (1 - progress));

  const baseSpeed         = Math.max(300, flightState.speed_kts || 490);
  const plannedEffSpeed   = Math.max(300, baseSpeed + PLANNED_WIND_KTS);
  const alternateEffSpeed = Math.max(300, baseSpeed + ALTERNATE_WIND_KTS);
  const burnRate          = fuelState.burn_rate_kg_per_min || 100;

  // Remaining fuel needed for each route from current position
  const plannedRemainingFuelKg   = Math.round((plannedRemainingNm   / plannedEffSpeed) * 60 * burnRate);
  const alternateRemainingFuelKg = Math.round((alternateRemainingNm / alternateEffSpeed) * 60 * burnRate);
  const fuelSavingsKg            = Math.max(0, plannedRemainingFuelKg - alternateRemainingFuelKg);

  // Negative = alternate arrives earlier (based on remaining distances)
  const etaDeltaMin = Math.round(
    ((alternateRemainingNm / alternateEffSpeed) - (plannedRemainingNm / plannedEffSpeed)) * 60
  );

  // Turbulence risk from last WEATHER agent message
  const lastWeatherMsg = [...agentMessages].reverse().find(m => m.agent === 'WEATHER');
  const plannedTurbLabel = lastWeatherMsg?.severity === 'critical' ? 'SEVERE'
    : lastWeatherMsg?.severity === 'warning' ? 'MODERATE'
    : 'LOW';
  const plannedTurbColor = lastWeatherMsg?.severity === 'critical' ? 'text-af-red'
    : lastWeatherMsg?.severity === 'warning' ? 'text-af-yellow'
    : 'text-af-green';

  return (
    <aside className="w-[290px] min-w-[250px] max-w-[310px] bg-af-panel border-l border-white/[0.06] flex flex-col overflow-hidden shrink-0">
      {/* Active Recommendation */}
      <div className="p-4 border-b border-white/[0.06]">
        <p className="font-mono text-[10px] text-white/35 uppercase tracking-widest mb-3">Active Recommendation</p>

        {activeRec ? (
          <RecommendationCard
            recommendation={activeRec}
            onAccept={() => acceptRecommendation(activeRec.id)}
            onDismiss={() => dismissRecommendation(activeRec.id)}
          />
        ) : (
          <div className="bg-af-card rounded-lg border border-white/[0.06] p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-1.5">
              <div className="w-2 h-2 rounded-full bg-af-green animate-pulse" />
              <span className="text-[13px] text-white/70 font-sans">All Systems Nominal</span>
            </div>
            <p className="text-[11px] text-white/35 font-mono">No active recommendations</p>
          </div>
        )}
      </div>

      {/* Decision Log */}
      <div className="p-4 border-b border-white/[0.06]">
        <p className="font-mono text-[10px] text-white/35 uppercase tracking-widest mb-3">Decision Log</p>
        <div className="space-y-2">
          {decisions.length === 0 ? (
            <p className="text-[11px] text-white/30 italic font-mono">No decisions recorded</p>
          ) : (
            decisions.map(dec => (
              <div key={dec.id} className="flex items-center gap-2">
                <span className="font-mono text-[11px] text-white/30 tabular-nums shrink-0">
                  {new Date(dec.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold shrink-0 ${
                  dec.result === 'accepted'  ? 'bg-af-green/15 text-af-green' :
                  dec.result === 'dismissed' ? 'bg-af-red/15   text-af-red'  :
                  'bg-af-yellow/15 text-af-yellow'
                }`}>
                  {dec.result.toUpperCase()}
                </span>
                <span className="text-[12px] text-white/55 font-sans truncate flex-1">{dec.summary}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Route Comparison */}
      <div className="flex-1 p-4 overflow-y-auto">
        <div className="flex items-center gap-2 mb-3">
          <Route size={12} className="text-white/35" />
          <p className="font-mono text-[10px] text-white/35 uppercase tracking-widest">Route Comparison</p>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          {/* Planned Route */}
          <div className={`rounded-lg border p-3 ${
            !usingAlternateRoute
              ? 'bg-af-card border-af-cyan/25'
              : 'bg-af-card/40 border-white/[0.04] opacity-55'
          }`}>
            <div className="flex items-center justify-between mb-2.5">
              <h4 className="text-[11px] font-semibold font-mono text-white/65 tracking-wide">
                {usingAlternateRoute ? 'ORIG. ROUTE' : '✓ ACTIVE'}
              </h4>
              <span className="font-mono text-[10px] text-af-red/70 bg-af-red/8 px-1 rounded">HW 32kt</span>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-baseline">
                <span className="text-[10px] text-white/40 font-mono">REM</span>
                <span className="text-[12px] text-white font-mono tabular-nums font-semibold">{plannedRemainingNm.toLocaleString()} NM</span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="text-[10px] text-white/40 font-mono">FUEL</span>
                <span className="text-[12px] text-af-red font-mono tabular-nums font-semibold">{plannedRemainingFuelKg.toLocaleString()} kg</span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="text-[10px] text-white/40 font-mono">ETA</span>
                <span className="text-[12px] text-white font-mono tabular-nums font-semibold">{eta}</span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="text-[10px] text-white/40 font-mono">TURB</span>
                <span className={`text-[11px] font-mono font-semibold ${plannedTurbColor}`}>{plannedTurbLabel}</span>
              </div>
            </div>
          </div>

          {/* Alternate Route */}
          <div className={`rounded-lg border p-3 ${
            usingAlternateRoute
              ? 'bg-af-green/5 border-af-green/30'
              : activeRec?.action_type === 'ROUTE_CHANGE'
              ? 'bg-af-yellow/5 border-af-yellow/25'
              : 'bg-af-card border-white/[0.06]'
          }`}>
            <div className="flex items-center justify-between mb-2.5">
              <h4 className="text-[11px] font-semibold font-mono text-white/65 tracking-wide">
                {usingAlternateRoute ? '✓ ACTIVE' : 'ALT SOUTH'}
              </h4>
              <span className="font-mono text-[10px] text-af-green/70 bg-af-green/8 px-1 rounded">TW 22kt</span>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-baseline">
                <span className="text-[10px] text-white/40 font-mono">REM</span>
                <span className="text-[12px] text-white font-mono tabular-nums font-semibold">{alternateRemainingNm.toLocaleString()} NM</span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="text-[10px] text-white/40 font-mono">FUEL</span>
                <span className="text-[12px] text-af-green font-mono tabular-nums font-semibold">{alternateRemainingFuelKg.toLocaleString()} kg</span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="text-[10px] text-white/40 font-mono">ETA</span>
                <span className={`text-[12px] font-mono tabular-nums font-semibold ${etaDeltaMin < 0 ? 'text-af-green' : usingAlternateRoute ? 'text-white' : 'text-af-yellow'}`}>
                  {etaDeltaMin >= 0 ? '+' : ''}{etaDeltaMin} min
                </span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="text-[10px] text-white/40 font-mono">TURB</span>
                <span className="text-[11px] font-mono font-semibold text-af-green">LOW</span>
              </div>
            </div>
          </div>
        </div>

        {/* Live fuel-savings banner */}
        {fuelSavingsKg > 0 && (
          <div className={`mt-2 p-2 rounded-lg border flex items-center justify-between ${
            usingAlternateRoute
              ? 'bg-af-green/10 border-af-green/20'
              : 'bg-af-yellow/8 border-af-yellow/15'
          }`}>
            <span className="font-mono text-[10px] text-white/40 uppercase tracking-widest">
              {usingAlternateRoute ? 'Saving' : 'Potential saving'}
            </span>
            <span className={`font-mono text-[12px] font-semibold tabular-nums ${
              usingAlternateRoute ? 'text-af-green' : 'text-af-yellow'
            }`}>
              ~{fuelSavingsKg.toLocaleString()} kg
            </span>
          </div>
        )}

        {/* Fuel remaining indicator */}
        <div className="mt-3 bg-af-card rounded-lg border border-white/[0.06] p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="font-mono text-[10px] text-white/35 uppercase tracking-widest">Fuel Remaining</span>
            <span className="font-mono text-[12px] text-af-orange tabular-nums font-semibold">{fuelRemaining} kg</span>
          </div>
          <div className="w-full h-2 bg-white/[0.08] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-1000"
              style={{
                width:      `${Math.max(0, Math.min(100, (fuelState.remaining_kg / 68500) * 100))}%`,
                background: fuelState.remaining_kg < 15000
                  ? 'linear-gradient(90deg, #ef4444, #f97316)'
                  : 'linear-gradient(90deg, #f97316, #eab308)',
              }}
            />
          </div>
          <div className="flex justify-between mt-1">
            <span className="font-mono text-[10px] text-white/25">0 kg</span>
            <span className="font-mono text-[10px] text-white/25">68,500 kg</span>
          </div>
        </div>

        {/* Impact analysis (when active recommendation exists) */}
        {activeRec && (
          <div className="mt-3 space-y-1.5">
            <p className="font-mono text-[10px] text-white/35 uppercase tracking-widest mb-2">Impact Analysis</p>

            <div className="flex items-center gap-3 bg-af-card rounded-lg p-2.5 border border-white/[0.06]">
              <Zap size={13} className="text-af-cyan shrink-0" />
              <span className="text-[12px] text-white/55 font-sans flex-1">Turbulence avoided</span>
              <span className="font-mono text-[13px] text-af-green tabular-nums font-semibold">{activeRec.metrics.turbulence_avoided_min} min</span>
            </div>

            <div className="flex items-center gap-3 bg-af-card rounded-lg p-2.5 border border-white/[0.06]">
              <Fuel size={13} className="text-af-orange shrink-0" />
              <span className="text-[12px] text-white/55 font-sans flex-1">Fuel impact</span>
              <span className={`font-mono text-[13px] tabular-nums font-semibold ${activeRec.metrics.fuel_impact_kg > 0 ? 'text-af-red' : 'text-af-green'}`}>
                {activeRec.metrics.fuel_impact_kg > 0 ? '+' : ''}{activeRec.metrics.fuel_impact_kg} kg
              </span>
            </div>

            <div className="flex items-center gap-3 bg-af-card rounded-lg p-2.5 border border-white/[0.06]">
              <Clock size={13} className="text-white/45 shrink-0" />
              <span className="text-[12px] text-white/55 font-sans flex-1">ETA impact</span>
              <span className={`font-mono text-[13px] tabular-nums font-semibold ${activeRec.metrics.eta_impact_min > 0 ? 'text-af-yellow' : 'text-af-green'}`}>
                {activeRec.metrics.eta_impact_min > 0 ? '+' : ''}{activeRec.metrics.eta_impact_min} min
              </span>
            </div>

            <div className="flex items-center gap-3 bg-af-card rounded-lg p-2.5 border border-white/[0.06]">
              <Target size={13} className="text-af-purple shrink-0" />
              <span className="text-[12px] text-white/55 font-sans flex-1">Confidence</span>
              <div className="flex items-center gap-2">
                <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-af-yellow rounded-full transition-all duration-700"
                    style={{ width: `${activeRec.confidence * 100}%` }}
                  />
                </div>
                <span className="font-mono text-[12px] text-white/55 tabular-nums">{Math.round(activeRec.confidence * 100)}%</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
