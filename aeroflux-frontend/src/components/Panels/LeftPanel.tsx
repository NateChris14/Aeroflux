import { useSimulation } from '../../context/SimulationContext';
import { Sparkline } from './Sparkline';
import { TrendingUp, TrendingDown, Minus, Cpu, Brain } from 'lucide-react';

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
    if (delta > 0) return <TrendingUp  size={11} className="text-af-green" />;
    if (delta < 0) return <TrendingDown size={11} className="text-af-red"  />;
    return <Minus size={11} className="text-white/25" />;
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
  const severityLabel: Record<string, string> = {
    info:     'text-af-green/70',
    warning:  'text-af-yellow/80',
    critical: 'text-af-red/80',
  };

  // Determine LLM status from recent messages
  const latestMessages = agentMessages.slice(-5);
  const lastMsg = agentMessages[agentMessages.length - 1];
  const hasActivity = agentMessages.length > 0;

  const phaseLabel: Record<string, string> = {
    CLIMB:     'CLIMB',
    CRUISE:    'CRUISE',
    DESCENT:   'DESCENT',
    DEVIATION: 'DIVERT',
  };
  const phaseColor: Record<string, string> = {
    CLIMB:     'text-af-green  bg-af-green/10  border-af-green/30',
    CRUISE:    'text-af-cyan   bg-af-cyan/10   border-af-cyan/30',
    DESCENT:   'text-af-yellow bg-af-yellow/10 border-af-yellow/30',
    DEVIATION: 'text-af-orange bg-af-orange/10 border-af-orange/30',
  };

  return (
    <aside className="w-[270px] min-w-[230px] max-w-[290px] bg-af-panel border-r border-white/[0.06] flex flex-col overflow-hidden shrink-0">
      {/* Flight Identity */}
      <div className="px-4 pt-4 pb-3 border-b border-white/[0.06]">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-mono font-bold text-2xl text-white tracking-wide leading-none">
              {flightState.callsign}
            </h1>
            <p className="mt-1 text-sm text-white/55 font-sans">
              {origin?.label} → {destination?.label}
            </p>
          </div>
          <span className={`mt-0.5 px-2 py-0.5 rounded border text-[11px] font-mono font-semibold tracking-wider ${phaseColor[flightState.phase] || 'text-white/50 bg-white/5 border-white/20'}`}>
            {phaseLabel[flightState.phase] || flightState.phase}
          </span>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <span className="inline-flex items-center px-2 py-0.5 bg-af-card rounded border border-white/[0.08] text-[11px] text-white/45 font-mono">
            {flightState.aircraft_type}
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-white/[0.08] text-[11px] font-mono bg-af-card">
            {hasActivity ? (
              <>
                <Brain size={10} className="text-af-cyan" />
                <span className="text-af-cyan/80">LLM</span>
              </>
            ) : (
              <>
                <Cpu size={10} className="text-white/30" />
                <span className="text-white/30">STANDBY</span>
              </>
            )}
          </span>
        </div>
      </div>

      {/* Telemetry Grid */}
      <div className="px-4 pt-3 pb-2">
        <p className="font-mono text-[10px] text-white/35 uppercase tracking-widest mb-2">Live Telemetry</p>
        <div className="grid grid-cols-2 gap-1.5">
          {telemetry.map((item: TelemetryItem) => (
            <div key={item.label} className="bg-af-card rounded-lg px-2.5 py-2 border border-white/[0.06]">
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono text-[11px] text-white/40 uppercase tracking-wider">{item.label}</span>
                {'badge' in item && item.badge ? (
                  <span className="font-mono text-[11px] text-af-cyan/65 font-semibold">{item.badge}</span>
                ) : (
                  getDeltaIcon(item.delta)
                )}
              </div>
              <div className="flex items-baseline gap-1">
                <span className={`font-mono font-bold text-[15px] tabular-nums ${item.color}`}>
                  {typeof item.value === 'number' ? item.value.toLocaleString() : item.value}
                </span>
                {item.unit && (
                  <span className="font-mono text-[11px] text-white/35">{item.unit}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Altitude Profile */}
      <div className="px-4 pb-1">
        <div className="flex items-center justify-between mb-1.5">
          <span className="font-mono text-[10px] text-white/35 uppercase tracking-widest">Altitude Profile</span>
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
        <div className="flex items-center justify-between mb-1.5">
          <span className="font-mono text-[10px] text-white/35 uppercase tracking-widest">Fuel Burn Rate</span>
          <span className="font-mono text-[11px] text-af-orange/75 tabular-nums">
            {Math.round(fuelState.burn_rate_kg_per_min)} kg/min
          </span>
        </div>
        <Sparkline
          data={fuelRateHistory.length > 1 ? fuelRateHistory : [100, 102, 100, 103, 101]}
          color="#f97316"
          height={44}
          showBudgetLine={105}
        />
      </div>

      {/* Agent Status */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <div className="flex items-center justify-between mb-2">
          <p className="font-mono text-[10px] text-white/35 uppercase tracking-widest">Agent Status</p>
          {lastMsg && (
            <span className={`font-mono text-[10px] ${severityLabel[lastMsg.severity] || 'text-white/30'}`}>
              {lastMsg.sim_elapsed}
            </span>
          )}
        </div>
        <div className="space-y-2">
          {latestMessages.length === 0 ? (
            <div className="bg-af-card rounded-lg border border-white/[0.06] p-3 text-center">
              <p className="text-[12px] text-white/30 italic">Awaiting agent activity…</p>
            </div>
          ) : (
            latestMessages.map(msg => (
              <div
                key={msg.id}
                className="bg-af-card rounded-lg p-2.5 border border-white/[0.06]"
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold border shrink-0 ${agentColors[msg.agent] || 'text-white/50'}`}>
                    {msg.agent}
                  </span>
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${severityDot[msg.severity]}`} />
                  <span className={`font-mono text-[10px] uppercase tracking-wide ${severityLabel[msg.severity] || 'text-white/30'}`}>
                    {msg.severity}
                  </span>
                </div>
                <p className="text-[12px] text-white/80 leading-snug font-sans" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {msg.message}
                </p>
                {msg.finding && msg.finding !== msg.message && (
                  <p className="mt-1 text-[11px] text-white/45 leading-snug font-mono italic" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {msg.finding}
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </aside>
  );
}
