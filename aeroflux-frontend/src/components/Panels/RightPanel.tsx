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
    <aside className="w-[290px] min-w-[250px] max-w-[310px] bg-af-panel border-l border-white/[0.10] flex flex-col overflow-hidden shrink-0">
      {/* Active Recommendation */}
      <div className="p-4 border-b border-white/[0.10]">
        <p className="section-label mb-3">Recommendation</p>

        {activeRec ? (
          <RecommendationCard
            recommendation={activeRec}
            onAccept={() => acceptRecommendation(activeRec.id)}
            onDismiss={() => dismissRecommendation(activeRec.id)}
          />
        ) : (
          <div className="bg-af-card rounded-sm border border-white/[0.08] p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <span className="font-mono text-[11px] text-af-green tracking-widest">■</span>
              <span className="text-[12px] text-white/60 font-mono tracking-wide">ALL SYSTEMS NOMINAL</span>
            </div>
            <p className="text-[10px] text-white/25 font-mono mt-0.5">No active recommendations</p>
          </div>
        )}
      </div>

      {/* Decision Log */}
      <div className="p-4 border-b border-white/[0.10]">
        <p className="section-label mb-3">Decision Log</p>
        <div className="space-y-1.5">
          {decisions.length === 0 ? (
            <p className="text-[10px] text-white/25 font-mono">No decisions recorded</p>
          ) : (
            decisions.map(dec => (
              <div key={dec.id} className="font-mono text-[10px] text-white/40 flex items-center gap-1.5 leading-relaxed">
                <span className="tabular-nums text-white/25 shrink-0">
                  {new Date(dec.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                <span className="text-white/20">│</span>
                <span className={`font-semibold shrink-0 ${
                  dec.result === 'accepted'  ? 'text-af-green' :
                  dec.result === 'dismissed' ? 'text-af-red'   :
                  'text-af-yellow'
                }`}>
                  {dec.result.toUpperCase()}
                </span>
                <span className="text-white/20">│</span>
                <span className="text-white/45 truncate text-[10px] font-sans">{dec.summary}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Route Comparison */}
      <div className="flex-1 p-4 overflow-y-auto">
        <p className="section-label mb-3">Route Comparison</p>

        <div className="grid grid-cols-2 gap-2">
          {/* Planned Route */}
          <div className={`rounded-sm border p-2.5 ${
            !usingAlternateRoute
              ? 'bg-af-card border-af-cyan/20 border-l-2 border-l-af-cyan'
              : 'bg-af-card/40 border-white/[0.05] opacity-50'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                {!usingAlternateRoute && <span className="text-af-cyan text-[10px]">●</span>}
                <h4 className="text-[10px] font-mono text-white/55 tracking-widest uppercase">
                  {usingAlternateRoute ? 'ORIG' : 'ACTIVE'}
                </h4>
              </div>
              <span className="font-mono text-[9px] text-af-red/70 bg-af-red/8 px-1 rounded-sm border border-af-red/15">HW 32kt</span>
            </div>
            <div className="space-y-1.5">
              {[
                { label: 'REM', value: `${plannedRemainingNm.toLocaleString()} NM`, color: 'text-white' },
                { label: 'FUEL', value: `${plannedRemainingFuelKg.toLocaleString()} kg`, color: 'text-af-red' },
                { label: 'ETA', value: eta, color: 'text-white' },
                { label: 'TURB', value: plannedTurbLabel, color: plannedTurbColor },
              ].map(row => (
                <div key={row.label} className="flex justify-between items-baseline">
                  <span className="font-mono text-[9px] text-white/35 uppercase tracking-widest">{row.label}</span>
                  <span className={`font-mono text-[11px] tabular-nums font-semibold ${row.color}`}>{row.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Alternate Route */}
          <div className={`rounded-sm border p-2.5 ${
            usingAlternateRoute
              ? 'bg-af-card border-af-green/20 border-l-2 border-l-af-green'
              : activeRec?.action_type === 'ROUTE_CHANGE'
              ? 'bg-af-card border-af-yellow/20'
              : 'bg-af-card border-white/[0.08]'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                {usingAlternateRoute && <span className="text-af-green text-[10px]">●</span>}
                <h4 className="text-[10px] font-mono text-white/55 tracking-widest uppercase">
                  {usingAlternateRoute ? 'ACTIVE' : 'ALT S'}
                </h4>
              </div>
              <span className="font-mono text-[9px] text-af-green/70 bg-af-green/8 px-1 rounded-sm border border-af-green/15">TW 22kt</span>
            </div>
            <div className="space-y-1.5">
              {[
                { label: 'REM', value: `${alternateRemainingNm.toLocaleString()} NM`, color: 'text-white' },
                { label: 'FUEL', value: `${alternateRemainingFuelKg.toLocaleString()} kg`, color: 'text-af-green' },
                { label: 'ETA', value: `${etaDeltaMin >= 0 ? '+' : ''}${etaDeltaMin}m`, color: etaDeltaMin < 0 ? 'text-af-green' : usingAlternateRoute ? 'text-white' : 'text-af-yellow' },
                { label: 'TURB', value: 'LOW', color: 'text-af-green' },
              ].map(row => (
                <div key={row.label} className="flex justify-between items-baseline">
                  <span className="font-mono text-[9px] text-white/35 uppercase tracking-widest">{row.label}</span>
                  <span className={`font-mono text-[11px] tabular-nums font-semibold ${row.color}`}>{row.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Fuel savings banner */}
        {fuelSavingsKg > 0 && (
          <div className={`mt-2 px-3 py-2 rounded-sm border flex items-center justify-between ${
            usingAlternateRoute ? 'bg-af-green/8 border-af-green/15' : 'bg-af-yellow/5 border-af-yellow/12'
          }`}>
            <span className="font-mono text-[9px] text-white/35 uppercase tracking-widest">
              {usingAlternateRoute ? 'Saving' : 'Potential saving'}
            </span>
            <span className={`font-mono text-[12px] font-semibold tabular-nums ${usingAlternateRoute ? 'text-af-green' : 'text-af-yellow'}`}>
              ~{fuelSavingsKg.toLocaleString()} kg
            </span>
          </div>
        )}

        {/* Fuel Status */}
        <div className="mt-3 bg-af-card rounded-sm border border-white/[0.08] p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="section-label">Fuel Status</span>
            <span className="font-mono text-[12px] text-af-orange tabular-nums font-semibold">{fuelRemaining} kg</span>
          </div>
          <div className="relative w-full h-2 bg-white/[0.08] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-1000"
              style={{
                width: `${Math.max(0, Math.min(100, (fuelState.remaining_kg / 68500) * 100))}%`,
                background: fuelState.remaining_kg < 15000
                  ? 'linear-gradient(90deg, #ef4444, #f97316)'
                  : 'linear-gradient(90deg, #f97316, #f59e0b)',
              }}
            />
            {/* Tick marks */}
            {[25, 50, 75].map(pct => (
              <div key={pct} className="absolute top-0 bottom-0 w-px bg-white/10" style={{ left: `${pct}%` }} />
            ))}
          </div>
          <div className="flex justify-between mt-1">
            <span className="font-mono text-[9px] text-white/20">0</span>
            <span className="font-mono text-[9px] text-white/20">68,500 kg</span>
          </div>
        </div>

        {/* Impact Analysis */}
        {activeRec && (
          <div className="mt-3 space-y-1.5">
            <p className="section-label mb-2">Impact Analysis</p>
            {[
              { icon: Zap,    iconColor: 'text-af-cyan',   label: 'Turbulence avoided', value: `${activeRec.metrics.turbulence_avoided_min} min`, valueColor: 'text-af-green' },
              { icon: Fuel,   iconColor: 'text-af-orange', label: 'Fuel impact',         value: `${activeRec.metrics.fuel_impact_kg > 0 ? '+' : ''}${activeRec.metrics.fuel_impact_kg} kg`, valueColor: activeRec.metrics.fuel_impact_kg > 0 ? 'text-af-red' : 'text-af-green' },
              { icon: Clock,  iconColor: 'text-white/40',  label: 'ETA impact',          value: `${activeRec.metrics.eta_impact_min > 0 ? '+' : ''}${activeRec.metrics.eta_impact_min} min`, valueColor: activeRec.metrics.eta_impact_min > 0 ? 'text-af-yellow' : 'text-af-green' },
              { icon: Target, iconColor: 'text-af-cyan',   label: 'Confidence',          value: `${Math.round(activeRec.confidence * 100)}%`, valueColor: 'text-af-cyan' },
            ].map(({ icon: Icon, iconColor, label, value, valueColor }) => (
              <div key={label} className="flex items-center gap-2.5 bg-af-card rounded-sm p-2.5 border border-white/[0.07]">
                <Icon size={12} className={`${iconColor} shrink-0`} />
                <span className="text-[11px] text-white/45 font-sans flex-1">{label}</span>
                <span className={`font-mono text-[12px] tabular-nums font-semibold ${valueColor}`}>{value}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
