import { useSimulation } from '../../context/SimulationContext';
import { useBackendSync } from '../../hooks/useBackendSync';
import { RecommendationCard } from '../RecommendationCard';
import { Zap, Fuel, Clock, Target } from 'lucide-react';

export function RightPanel() {
  const { recommendations, decisions, usingAlternateRoute, eta, fuelState } = useSimulation();
  const { acceptRecommendation, dismissRecommendation } = useBackendSync();

  const pendingRecs = recommendations.filter(r => r.status === 'pending');
  const activeRec   = pendingRecs[pendingRecs.length - 1];

  // Fuel remaining formatted
  const fuelRemaining = Math.round(fuelState.remaining_kg).toLocaleString();

  return (
    <aside className="w-[280px] min-w-[240px] max-w-[300px] bg-af-panel border-l border-white/[0.06] flex flex-col overflow-hidden shrink-0">
      {/* Active Recommendation */}
      <div className="p-4 border-b border-white/[0.06]">
        <h3 className="font-mono text-[10px] text-white/40 uppercase mb-3">Active Recommendation</h3>

        {activeRec ? (
          <RecommendationCard
            recommendation={activeRec}
            onAccept={() => acceptRecommendation(activeRec.id)}
            onDismiss={() => dismissRecommendation(activeRec.id)}
          />
        ) : (
          <div className="bg-af-card rounded-lg border border-white/[0.06] p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-af-green animate-pulse" />
              <span className="text-sm text-white/70">All Systems Nominal</span>
            </div>
            <p className="text-xs text-white/40">No active recommendations</p>
          </div>
        )}
      </div>

      {/* Decision Log */}
      <div className="p-4 border-b border-white/[0.06]">
        <h3 className="font-mono text-[10px] text-white/40 uppercase mb-3">Decision Log</h3>
        <div className="space-y-2">
          {decisions.length === 0 ? (
            <p className="text-xs text-white/30 italic">No decisions yet</p>
          ) : (
            decisions.map(dec => (
              <div key={dec.id} className="flex items-center gap-2 text-xs">
                <span className="font-mono text-white/30">
                  {new Date(dec.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                  dec.result === 'accepted'  ? 'bg-af-green/20 text-af-green' :
                  dec.result === 'dismissed' ? 'bg-af-red/20   text-af-red'  :
                  'bg-af-yellow/20 text-af-yellow'
                }`}>
                  {dec.result.toUpperCase()}
                </span>
                <span className="text-white/60 truncate flex-1">{dec.summary}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Route Comparison */}
      <div className="flex-1 p-4 overflow-y-auto">
        <h3 className="font-mono text-[10px] text-white/40 uppercase mb-3">Route Comparison</h3>

        <div className="grid grid-cols-2 gap-3">
          {/* Planned Route */}
          <div className={`rounded-lg border p-3 ${
            !usingAlternateRoute
              ? 'bg-af-card border-white/[0.06]'
              : 'bg-af-card/50 border-white/[0.04] opacity-60'
          }`}>
            <h4 className="text-xs font-semibold text-white/70 mb-2">
              {usingAlternateRoute ? 'Planned (orig.)' : '✓ Active Route'}
            </h4>
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-white/40">Distance</span>
                <span className="text-white font-mono">3,616 NM</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-white/40">Est. Fuel</span>
                <span className="text-white font-mono">45,000 kg</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-white/40">ETA</span>
                <span className="text-white font-mono">{eta}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-white/40">Turb Risk</span>
                <span className="text-af-yellow font-mono">MODERATE</span>
              </div>
            </div>
          </div>

          {/* Alternate Route */}
          <div className={`rounded-lg border p-3 ${
            usingAlternateRoute
              ? 'bg-af-green/5 border-af-green/30'
              : activeRec?.action_type === 'ROUTE_CHANGE'
              ? 'bg-af-yellow/5 border-af-yellow/30'
              : 'bg-af-card border-white/[0.06]'
          }`}>
            <h4 className="text-xs font-semibold text-white/70 mb-2">
              {usingAlternateRoute ? '✓ Active (South.)' : 'Southern Alt.'}
            </h4>
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-white/40">Distance</span>
                <span className="text-white font-mono">3,710 NM</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-white/40">Est. Fuel</span>
                <span className="text-white font-mono">45,240 kg</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-white/40">ETA</span>
                <span className={usingAlternateRoute ? 'text-white font-mono' : 'text-af-yellow font-mono'}>
                  +4 min
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-white/40">Turb Risk</span>
                <span className="text-af-green font-mono">LOW</span>
              </div>
            </div>
          </div>
        </div>

        {/* Fuel remaining indicator */}
        <div className="mt-3 bg-af-card rounded-lg border border-white/[0.06] p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="font-mono text-[10px] text-white/40 uppercase">Fuel Remaining</span>
            <span className="font-mono text-xs text-af-orange">{fuelRemaining} kg</span>
          </div>
          <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
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
        </div>

        {/* Impact analysis (when active recommendation exists) */}
        {activeRec && (
          <div className="mt-3 space-y-2">
            <h4 className="text-xs text-white/60 mb-2">Impact Analysis</h4>

            <div className="flex items-center gap-3 bg-af-card rounded-lg p-2 border border-white/[0.06]">
              <Zap size={14} className="text-af-cyan" />
              <span className="text-xs text-white/60 flex-1">Turbulence avoided</span>
              <span className="font-mono text-sm text-af-green">{activeRec.metrics.turbulence_avoided_min} min</span>
            </div>

            <div className="flex items-center gap-3 bg-af-card rounded-lg p-2 border border-white/[0.06]">
              <Fuel size={14} className="text-af-orange" />
              <span className="text-xs text-white/60 flex-1">Fuel impact</span>
              <span className={`font-mono text-sm ${activeRec.metrics.fuel_impact_kg > 0 ? 'text-af-red' : 'text-af-green'}`}>
                {activeRec.metrics.fuel_impact_kg > 0 ? '+' : ''}{activeRec.metrics.fuel_impact_kg} kg
              </span>
            </div>

            <div className="flex items-center gap-3 bg-af-card rounded-lg p-2 border border-white/[0.06]">
              <Clock size={14} className="text-white/60" />
              <span className="text-xs text-white/60 flex-1">ETA impact</span>
              <span className={`font-mono text-sm ${activeRec.metrics.eta_impact_min > 0 ? 'text-af-yellow' : 'text-af-green'}`}>
                {activeRec.metrics.eta_impact_min > 0 ? '+' : ''}{activeRec.metrics.eta_impact_min} min
              </span>
            </div>

            <div className="flex items-center gap-3 bg-af-card rounded-lg p-2 border border-white/[0.06]">
              <Target size={14} className="text-af-purple" />
              <span className="text-xs text-white/60 flex-1">Confidence</span>
              <div className="flex items-center gap-2">
                <div className="w-20 h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-af-yellow rounded-full transition-all duration-700"
                    style={{ width: `${activeRec.confidence * 100}%` }}
                  />
                </div>
                <span className="font-mono text-xs text-white/60">{Math.round(activeRec.confidence * 100)}%</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
