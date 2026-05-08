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

  const isGround = flightState.phase === 'GROUND';

  const telemetry = [
    {
      label: 'ALT',
      value: isGround ? 0 : flightState.altitude_ft,
      unit: 'ft',
      color: 'text-af-cyan',
      delta: flightState.vertical_rate_fpm,
      badge: isGround ? 'GND' : `FL${flightLevel.toString().padStart(3, '0')}`,
    },
    { label: 'SPD',  value: isGround ? 0 : flightState.speed_kts,          unit: 'kts', color: 'text-white',     delta: 0 },
    { label: 'HDG',  value: Math.round(flightState.heading_deg),            unit: '°',   color: 'text-white',     delta: 0 },
    {
      label: 'FUEL',
      value: Math.round(fuelState.remaining_kg),
      unit: 'kg',
      color: fuelState.remaining_kg < 15000 ? 'text-af-red' : 'text-af-orange',
      delta: isGround ? 0 : -Math.round(fuelState.burn_rate_kg_per_min),
    },
    { label: 'ETA',  value: eta,                                            unit: '',    color: 'text-white',     delta: 0 },
    {
      label: 'RIDE',
      value: isGround                              ? 'N/A'
           : flightState.phase === 'CRUISE'        ? 'SMOOTH'
           : flightState.phase === 'DEVIATION'     ? 'MODERATE'
           : 'LIGHT',
      unit: '',
      color: isGround ? 'text-white/30' : flightState.phase === 'CRUISE' ? 'text-af-green' : 'text-af-yellow',
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
  // Determine LLM status from recent messages
  const latestMessages = agentMessages.slice(-5);
  const lastMsg = agentMessages[agentMessages.length - 1];
  const hasActivity = agentMessages.length > 0;

  const phaseLabel: Record<string, string> = {
    GROUND:    'PRE-FLT',
    CLIMB:     'CLIMB',
    CRUISE:    'CRUISE',
    DESCENT:   'DESCENT',
    DEVIATION: 'DIVERT',
  };
  const phaseColor: Record<string, string> = {
    GROUND:    'text-white/45  bg-white/5      border-white/15',
    CLIMB:     'text-af-green  bg-af-green/10  border-af-green/30',
    CRUISE:    'text-af-cyan   bg-af-cyan/10   border-af-cyan/30',
    DESCENT:   'text-af-yellow bg-af-yellow/10 border-af-yellow/30',
    DEVIATION: 'text-af-orange bg-af-orange/10 border-af-orange/30',
  };

  const agentAccentBorder: Record<string, string> = {
    WEATHER:    'border-l-af-cyan',
    FUEL:       'border-l-af-orange',
    ATC:        'border-l-af-purple',
    COMFORT:    'border-l-af-green',
    SUPERVISOR: 'border-l-white/30',
  };

  const glowClass: Record<string, string> = {
    'text-af-cyan':   'atc-glow-cyan',
    'text-af-orange': 'atc-glow-orange',
    'text-af-red':    'atc-glow-red',
    'text-white':     '',
    'text-af-green':  'atc-glow-green',
    'text-white/30':  '',
  };

  return (
    <aside className="w-[270px] min-w-[230px] max-w-[290px] bg-af-panel border-r border-af-cyan/[0.10] flex flex-col overflow-hidden shrink-0">
      {/* Flight Identity block */}
      <div className="px-4 pt-3.5 pb-3 border-b border-white/[0.08]">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-mono font-bold text-2xl text-white tracking-[0.15em] leading-none atc-glow-cyan">
              {flightState.callsign}
            </h1>
            <p className="mt-1.5 text-[11px] text-white/40 font-mono tracking-widest">
              {origin?.label} <span className="text-af-cyan/40">▸</span> {destination?.label}
            </p>
          </div>
          <span className={`px-2 py-0.5 border text-[10px] font-mono font-semibold tracking-widest ${phaseColor[flightState.phase] || 'text-white/50 border-white/20'}`}>
            {phaseLabel[flightState.phase] || flightState.phase}
          </span>
        </div>
        <div className="mt-2.5 flex items-center gap-2">
          <span className="inline-flex items-center px-2 py-0.5 bg-af-card border border-white/[0.08] text-[10px] text-white/35 font-mono tracking-wider">
            {flightState.aircraft_type}
          </span>
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 border border-white/[0.08] text-[10px] font-mono bg-af-card">
            {hasActivity ? (
              <>
                <Brain size={9} className="text-af-cyan" />
                <span className="text-af-cyan/80 tracking-widest atc-glow-cyan">LLM ACTIVE</span>
              </>
            ) : (
              <>
                <Cpu size={9} className="text-white/25" />
                <span className="text-white/25 tracking-widest">STANDBY</span>
              </>
            )}
          </span>
        </div>
      </div>

      {/* Telemetry */}
      <div className="atc-bar">
        <span className="section-label">Telemetry</span>
      </div>
      <div className="px-3 py-2">
        <div className="grid grid-cols-2 gap-px bg-white/[0.06]">
          {telemetry.map((item: TelemetryItem) => (
            <div key={item.label} className="bg-af-card px-3 py-2.5">
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-mono text-[9px] text-white/30 uppercase tracking-[0.18em]">{item.label}</span>
                {'badge' in item && item.badge ? (
                  <span className="font-mono text-[10px] text-af-cyan/60 font-semibold tracking-wider">{item.badge}</span>
                ) : (
                  getDeltaIcon(item.delta)
                )}
              </div>
              <div className="flex items-baseline gap-1">
                <span className={`font-mono font-bold text-[17px] tabular-nums leading-none ${item.color} ${glowClass[item.color] ?? ''}`}>
                  {typeof item.value === 'number' ? item.value.toLocaleString() : item.value}
                </span>
                {item.unit && (
                  <span className="font-mono text-[9px] text-white/25 ml-0.5">{item.unit}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Altitude Profile */}
      <div className="atc-bar">
        <span className="section-label">Altitude Profile</span>
        <span className="font-mono text-[11px] font-bold text-af-cyan tracking-wider atc-glow-cyan">
          FL{flightLevel.toString().padStart(3, '0')}
        </span>
      </div>
      <div className="px-3 pt-2 pb-1">
        <Sparkline
          data={altitudeHistory.length > 1 ? altitudeHistory : [5000, 15000, 25000, 33000, 37000]}
          color="#0ea5e9"
          height={60}
        />
      </div>

      {/* Fuel Burn Rate */}
      <div className="atc-bar">
        <span className="section-label">Fuel Burn Rate</span>
        <span className="font-mono text-[11px] text-af-orange tabular-nums atc-glow-orange">
          {Math.round(fuelState.burn_rate_kg_per_min)}<span className="text-[9px] text-white/30 ml-0.5">kg/m</span>
        </span>
      </div>
      <div className="px-3 pt-2 pb-2">
        <Sparkline
          data={fuelRateHistory.length > 1 ? fuelRateHistory : [100, 102, 100, 103, 101]}
          color="#f97316"
          height={44}
          showBudgetLine={105}
        />
      </div>

      {/* Agent Log */}
      <div className="atc-bar">
        <span className="section-label">Agent Log</span>
        {lastMsg && <span className="font-mono text-[10px] text-white/20">{lastMsg.sim_elapsed}</span>}
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-2">
        <div className="space-y-px">
          {latestMessages.length === 0 ? (
            <div className="bg-af-card border border-white/[0.07] p-3 text-center">
              <p className="text-[10px] text-white/20 font-mono tracking-widest">AWAITING AGENT ACTIVITY</p>
            </div>
          ) : (
            latestMessages.map(msg => (
              <div
                key={msg.id}
                className={`bg-af-card p-2.5 border-l-2 border-b border-b-white/[0.04] ${agentAccentBorder[msg.agent] || 'border-l-white/20'}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`font-mono text-[10px] font-semibold tracking-[0.15em] ${agentColors[msg.agent]?.split(' ')[0] || 'text-white/50'}`}>
                    ▸ {msg.agent}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 ${severityDot[msg.severity]}`} />
                    <span className="font-mono text-[10px] text-white/20">{msg.sim_elapsed}</span>
                  </div>
                </div>
                <p className="text-[11px] text-white/70 leading-snug font-sans" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {msg.message}
                </p>
                {msg.finding && msg.finding !== msg.message && (
                  <p className="mt-1 text-[10px] text-white/35 leading-snug font-mono italic" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
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
