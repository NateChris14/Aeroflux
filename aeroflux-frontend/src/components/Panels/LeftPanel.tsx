import { useSimulation } from '../../context/SimulationContext';
import { Sparkline } from './Sparkline';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export function LeftPanel() {
  const {
    flightState,
    fuelState,
    agentMessages,
    altitudeHistory,
    fuelRateHistory,
    activeRoute,
    eta,
  } = useSimulation();

  const origin      = activeRoute[0];
  const destination = activeRoute[activeRoute.length - 1];
  const flightLevel = Math.floor(flightState.altitude_ft / 100);

  const telemetry = [
    {
      label: 'ALT',
      value: flightState.altitude_ft,
      unit: 'ft',
      color: 'text-af-cyan',
      delta: flightState.vertical_rate_fpm,
      badge: `FL${flightLevel.toString().padStart(3, '0')}`,
    },
    { label: 'SPD',  value: flightState.speed_kts,                       unit: 'kts', color: 'text-white',     delta: 0 },
    { label: 'HDG',  value: Math.round(flightState.heading_deg),          unit: '°',   color: 'text-white',     delta: 0 },
    {
      label: 'FUEL',
      value: Math.round(fuelState.remaining_kg),
      unit: 'kg',
      color: fuelState.remaining_kg < 15000 ? 'text-af-red' : 'text-af-orange',
      delta: -Math.round(fuelState.burn_rate_kg_per_min),
    },
    { label: 'ETA',  value: eta,                                           unit: '',    color: 'text-white',     delta: 0 },
    {
      label: 'RIDE',
      value: flightState.phase === 'CRUISE'    ? 'SMOOTH'
           : flightState.phase === 'DEVIATION' ? 'MODERATE'
           : flightState.phase === 'CLIMB'     ? 'LIGHT'
           : 'LIGHT',
      unit: '',
      color: flightState.phase === 'CRUISE' ? 'text-af-green' : 'text-af-yellow',
      delta: 0,
    },
  ] as const;

  type TelemetryItem = (typeof telemetry)[number];

  const getDeltaIcon = (delta: number) => {
    if (delta > 0) return <TrendingUp  size={10} className="text-af-green" />;
    if (delta < 0) return <TrendingDown size={10} className="text-af-red"  />;
    return <Minus size={10} className="text-white/30" />;
  };

  const agentColors: Record<string, string> = {
    WEATHER:    'text-af-cyan   bg-af-cyan/10   border-af-cyan/30',
    FUEL:       'text-af-orange bg-af-orange/10 border-af-orange/30',
    ATC:        'text-af-purple bg-af-purple/10 border-af-purple/30',
    COMFORT:    'text-af-green  bg-af-green/10  border-af-green/30',
    SUPERVISOR: 'text-white/70  bg-white/5      border-white/20',
  };
  const severityDot: Record<string, string> = {
    info:     'bg-af-green',
    warning:  'bg-af-yellow',
    critical: 'bg-af-red',
  };

  const latestMessages = agentMessages.slice(-4);

  return (
    <aside className="w-[260px] min-w-[220px] max-w-[280px] bg-af-panel border-r border-white/[0.06] flex flex-col overflow-hidden shrink-0">
      {/* Flight Identity */}
      <div className="p-4 border-b border-white/[0.06]">
        <h1 className="font-sans font-bold text-xl text-white">{flightState.callsign}</h1>
        <div className="flex items-center gap-2 mt-1 text-sm text-white/60 flex-wrap">
          <span>{origin?.label} ({origin?.id})</span>
          <span>→</span>
          <span>{destination?.label} ({destination?.id})</span>
        </div>
        <div className="mt-2 inline-flex items-center px-2 py-1 bg-af-card rounded text-xs text-white/50">
          {flightState.aircraft_type}
        </div>
      </div>

      {/* Telemetry Grid */}
      <div className="p-4 pb-2">
        <div className="grid grid-cols-2 gap-1.5">
          {telemetry.map((item: TelemetryItem) => (
            <div key={item.label} className="bg-af-card rounded-lg p-2 border border-white/[0.06]">
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono text-[10px] text-white/40 uppercase">{item.label}</span>
                {/* For ALT, show FL badge; otherwise show trend icon */}
                {'badge' in item && item.badge ? (
                  <span className="font-mono text-[10px] text-af-cyan/70">{item.badge}</span>
                ) : (
                  getDeltaIcon(item.delta)
                )}
              </div>
              <div className="flex items-baseline gap-1">
                <span className={`font-mono font-bold text-base ${item.color}`}>
                  {typeof item.value === 'number' ? item.value.toLocaleString() : item.value}
                </span>
                {item.unit && (
                  <span className="font-mono text-xs text-white/40">{item.unit}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Altitude Profile */}
      <div className="px-4 pb-1">
        <div className="flex items-center justify-between mb-1">
          <span className="font-mono text-[10px] text-white/40 uppercase">Altitude Profile</span>
          <span className="font-mono text-[11px] font-bold text-af-cyan">
            FL{flightLevel.toString().padStart(3, '0')}
          </span>
        </div>
        <Sparkline
          data={altitudeHistory.length > 1 ? altitudeHistory : [5000, 15000, 25000, 33000, 37000]}
          color="#06b6d4"
          height={52}
        />
      </div>

      {/* Fuel Burn Rate */}
      <div className="px-4 pb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="font-mono text-[10px] text-white/40 uppercase">Fuel Burn Rate</span>
          <span className="font-mono text-[10px] text-af-orange/70">
            {Math.round(fuelState.burn_rate_kg_per_min)} kg/min
          </span>
        </div>
        <Sparkline
          data={fuelRateHistory.length > 1 ? fuelRateHistory : [100, 102, 100, 103, 101]}
          color="#f97316"
          height={48}
          showBudgetLine={105}
        />
      </div>

      {/* Agent Status */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <h3 className="font-mono text-[10px] text-white/40 uppercase mb-2">Agent Status</h3>
        <div className="space-y-2">
          {latestMessages.length === 0 ? (
            <div className="text-sm text-white/30 italic">No agent activity yet…</div>
          ) : (
            latestMessages.map(msg => (
              <div
                key={msg.id}
                className="flex items-start gap-2 bg-af-card rounded-lg p-2 border border-white/[0.06]"
              >
                <div
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono border shrink-0 ${agentColors[msg.agent] || 'text-white/50'}`}
                >
                  {msg.agent}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-white/70 truncate">{msg.message}</p>
                  <span className="font-mono text-[10px] text-white/30">{msg.sim_elapsed}</span>
                </div>
                <span className={`w-2 h-2 rounded-full shrink-0 mt-1 ${severityDot[msg.severity]}`} />
              </div>
            ))
          )}
        </div>
      </div>
    </aside>
  );
}
