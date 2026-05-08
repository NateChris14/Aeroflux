import { useState, useEffect } from 'react';
import { useSimulation } from '../context/SimulationContext';
import { useBackendSync } from '../hooks/useBackendSync';
import { formatUTC } from '../utils/geo';
import { AlertTriangle, Wind, MapPin, Activity, RotateCcw } from 'lucide-react';

export function Header() {
  const {
    flightState,
    isRunning,
    startSimulation,
    pauseSimulation,
    resetSimulation,
    simSpeed,
    setSimSpeed,
  } = useSimulation();
  const { injectEvent } = useBackendSync();
  const [utcTime, setUtcTime] = useState(formatUTC());
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setUtcTime(formatUTC()), 1000);
    return () => clearInterval(timer);
  }, []);

  const phaseColors: Record<string, string> = {
    GROUND:    'text-white/40 border-white/15',
    CLIMB:     'text-af-green border-af-green/40',
    CRUISE:    'text-af-cyan  border-af-cyan/40',
    DESCENT:   'text-af-yellow border-af-yellow/40',
    DEVIATION: 'text-af-red   border-af-red/40',
  };

  const handleInject = (eventType: string) => {
    injectEvent(eventType);
    setShowDropdown(false);
  };

  return (
    <header className="h-14 bg-af-header border-b border-af-cyan/[0.12] flex items-stretch shrink-0">
      {/* Logo block */}
      <div className="flex items-center gap-3 px-4 border-r border-white/[0.08]">
        <div className="w-[3px] h-6 bg-af-cyan atc-glow-cyan" />
        <svg width="22" height="22" viewBox="0 0 28 28" fill="none">
          <path d="M4 20L24 8" stroke="#0ea5e9" strokeWidth="1.5" strokeLinecap="square"/>
          <text x="5" y="19" fill="#0ea5e9" fontSize="11" fontWeight="700" fontFamily="monospace">AF</text>
        </svg>
        <div>
          <div className="font-mono font-bold text-white text-[13px] tracking-widest leading-none">AEROFLUX</div>
          <div className="font-mono text-[9px] text-af-cyan/60 tracking-[0.2em] leading-none mt-0.5">AI DECISION SYSTEM</div>
        </div>
      </div>

      {/* Live indicator */}
      <div className="flex items-center px-4 border-r border-white/[0.08]">
        <span className={`font-mono text-[11px] tracking-widest atc-glow-green ${isRunning ? 'text-af-green' : 'text-white/25'}`}>
          {isRunning ? '◆ LIVE' : '◇ PAUSED'}
        </span>
      </div>

      {/* Flight data block */}
      <div className="flex items-center gap-0 flex-1">
        <div className="flex flex-col justify-center px-5 border-r border-white/[0.08] h-full">
          <div className="font-mono text-[9px] text-white/30 tracking-[0.2em] uppercase mb-0.5">Callsign</div>
          <div className="font-mono font-bold text-white text-base tracking-[0.15em] atc-glow-cyan">{flightState.callsign}</div>
        </div>
        <div className="flex flex-col justify-center px-5 border-r border-white/[0.08] h-full">
          <div className="font-mono text-[9px] text-white/30 tracking-[0.2em] uppercase mb-0.5">Route</div>
          <div className="font-mono text-sm text-white/80 tracking-wider">{flightState.origin} <span className="text-af-cyan/50">▸</span> {flightState.destination}</div>
        </div>
        <div className="flex flex-col justify-center px-5 border-r border-white/[0.08] h-full">
          <div className="font-mono text-[9px] text-white/30 tracking-[0.2em] uppercase mb-0.5">Type</div>
          <div className="font-mono text-sm text-white/60 tracking-wider">{flightState.aircraft_type}</div>
        </div>
        <div className="flex flex-col justify-center px-5 h-full">
          <div className="font-mono text-[9px] text-white/30 tracking-[0.2em] uppercase mb-0.5">Phase</div>
          <div className={`font-mono text-[11px] font-semibold tracking-widest border px-2 py-0.5 ${phaseColors[flightState.phase] ?? 'text-white/40 border-white/15'}`}>
            {flightState.phase}
          </div>
        </div>
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-0 border-l border-white/[0.08]">
        {/* UTC */}
        <div className="flex flex-col justify-center px-4 border-r border-white/[0.08] h-full">
          <div className="font-mono text-[9px] text-white/30 tracking-[0.2em] mb-0.5">UTC</div>
          <div className="font-mono text-sm font-semibold text-white/70 tabular-nums tracking-wider">{utcTime}</div>
        </div>

        {/* Speed */}
        <div className="flex items-center gap-0 border-r border-white/[0.08] h-full px-3">
          {([1, 2, 4] as const).map((speed) => (
            <button
              key={speed}
              onClick={() => setSimSpeed(speed)}
              className={`px-2.5 h-7 text-[11px] font-mono tracking-wider border-x border-white/[0.06] transition-colors ${
                simSpeed === speed
                  ? 'bg-af-cyan/10 border-af-cyan/30 text-af-cyan atc-glow-cyan'
                  : 'text-white/30 hover:text-white/60'
              }`}
            >
              {speed}×
            </button>
          ))}
        </div>

        {/* Inject */}
        <div className="relative border-r border-white/[0.08] h-full flex items-center px-3">
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 border border-white/[0.10] text-[11px] text-white/50 hover:text-white/80 hover:border-white/25 font-mono tracking-widest transition-colors"
          >
            <AlertTriangle size={11} className="text-af-yellow" />
            INJECT
          </button>
          {showDropdown && (
            <div className="absolute right-0 top-full mt-0 w-44 bg-af-header border border-af-cyan/20 shadow-2xl z-50">
              {[
                { label: 'Turbulence',    icon: Wind,          color: 'text-white/70', event: 'Turbulence' },
                { label: 'Headwind',      icon: Activity,      color: 'text-white/70', event: 'Headwind' },
                { label: 'ATC Hold',      icon: MapPin,        color: 'text-white/70', event: 'ATC Hold' },
              ].map(({ label, icon: Icon, color, event }) => (
                <button key={event} onClick={() => handleInject(event)} className={`w-full px-3 py-2 text-[11px] text-left ${color} hover:bg-af-cyan/5 hover:text-white flex items-center gap-2 font-mono border-b border-white/[0.05] transition-colors`}>
                  <Icon size={10} /> {label}
                </button>
              ))}
              <button onClick={() => handleInject('Engine Alert')} className="w-full px-3 py-2 text-[11px] text-left text-af-red hover:bg-af-red/5 flex items-center gap-2 font-mono transition-colors">
                <AlertTriangle size={10} /> Engine Alert
              </button>
            </div>
          )}
        </div>

        {/* Play/Pause */}
        <div className="flex items-center gap-2 px-4 h-full border-r border-white/[0.08]">
          <button
            onClick={isRunning ? pauseSimulation : startSimulation}
            className={`px-4 py-1.5 text-[11px] font-mono font-semibold tracking-widest border transition-colors ${
              isRunning
                ? 'border-af-red/40 text-af-red hover:bg-af-red/8 atc-glow-red'
                : 'border-af-green/50 bg-af-green/10 text-af-green hover:bg-af-green/15 atc-glow-green'
            }`}
          >
            {isRunning ? '⏸ PAUSE' : '▶ START'}
          </button>
        </div>

        {/* Reset */}
        <div className="flex items-center px-3 h-full">
          <button
            onClick={resetSimulation}
            className="p-2 text-white/25 hover:text-white/60 border border-white/[0.08] hover:border-white/20 transition-colors"
            title="Reset"
          >
            <RotateCcw size={12} />
          </button>
        </div>
      </div>
    </header>
  );
}
