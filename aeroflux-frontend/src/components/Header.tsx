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
    GROUND:    'text-white/40 bg-white/5 border-white/15',
    CLIMB:     'text-af-green bg-af-green/10 border-af-green/30',
    CRUISE:    'text-af-cyan bg-af-cyan/10 border-af-cyan/30',
    DESCENT:   'text-af-yellow bg-af-yellow/10 border-af-yellow/30',
    DEVIATION: 'text-af-red bg-af-red/10 border-af-red/30',
  };

  const handleInject = (eventType: string) => {
    injectEvent(eventType);
    setShowDropdown(false);
  };

  return (
    <header className="h-16 bg-af-header border-b border-white/[0.10] flex items-center justify-between px-5 shrink-0">
      {/* Left: Logo + Status */}
      <div className="flex items-center gap-4">
        {/* Blue accent bar */}
        <div className="w-[3px] h-7 bg-af-cyan rounded-full opacity-80" />
        <div className="flex items-center gap-2.5">
          <svg width="24" height="24" viewBox="0 0 28 28" fill="none">
            <path d="M4 20L24 8" stroke="#0ea5e9" strokeWidth="1.5" strokeLinecap="round"/>
            <text x="5" y="19" fill="#0ea5e9" fontSize="11" fontWeight="700" fontFamily="monospace">AF</text>
          </svg>
          <span className="font-sans font-semibold text-white text-sm tracking-wide">AeroFlux AI</span>
        </div>
        <div className="w-px h-5 bg-white/15" />
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-[11px] text-af-green tracking-widest">■ LIVE</span>
        </div>
      </div>

      {/* Center: Flight Info */}
      <div className="flex flex-col items-center gap-1">
        <div className="flex items-center gap-3">
          <span className="font-mono font-bold text-white text-base tracking-widest">{flightState.callsign}</span>
          <div className="w-px h-4 bg-white/20" />
          <span className="text-white/60 text-sm font-sans">{flightState.origin} → {flightState.destination}</span>
          <div className="w-px h-4 bg-white/20" />
          <span className="text-white/40 text-xs font-mono">{flightState.aircraft_type}</span>
        </div>
        <span className={`px-2.5 py-0.5 rounded-sm border text-[11px] font-mono font-semibold tracking-widest ${phaseColors[flightState.phase] ?? 'text-white/40 bg-white/5 border-white/15'}`}>
          {flightState.phase}
        </span>
      </div>

      {/* Right: Controls */}
      <div className="flex items-center gap-3">
        {/* UTC Clock */}
        <span className="font-mono text-sm font-semibold text-white/65 tabular-nums">{utcTime} Z</span>

        <div className="w-px h-5 bg-white/15" />

        {/* Speed Controls */}
        <div className="flex items-center gap-1">
          {([1, 2, 4] as const).map((speed) => (
            <button
              key={speed}
              onClick={() => setSimSpeed(speed)}
              className={`px-2.5 py-1 text-xs font-mono rounded-sm border transition-colors ${
                simSpeed === speed
                  ? 'bg-af-cyan/15 border-af-cyan text-af-cyan'
                  : 'border-white/10 text-white/40 hover:text-white/70 hover:border-white/25'
              }`}
            >
              {speed}×
            </button>
          ))}
        </div>

        {/* Inject Event */}
        <div className="relative">
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-white/[0.12] rounded-sm text-xs text-white/60 hover:text-white hover:border-white/25 transition-colors font-mono tracking-wide"
          >
            <AlertTriangle size={11} />
            INJECT
          </button>
          {showDropdown && (
            <div className="absolute right-0 top-full mt-1 w-44 bg-af-header border border-white/[0.12] rounded-sm shadow-2xl z-50 py-1">
              <button onClick={() => handleInject('Turbulence')} className="w-full px-3 py-2 text-xs text-left text-white/70 hover:text-white hover:bg-white/5 flex items-center gap-2 font-mono transition-colors">
                <Wind size={11} /> Turbulence
              </button>
              <button onClick={() => handleInject('Headwind')} className="w-full px-3 py-2 text-xs text-left text-white/70 hover:text-white hover:bg-white/5 flex items-center gap-2 font-mono transition-colors">
                <Activity size={11} /> Headwind
              </button>
              <button onClick={() => handleInject('ATC Hold')} className="w-full px-3 py-2 text-xs text-left text-white/70 hover:text-white hover:bg-white/5 flex items-center gap-2 font-mono transition-colors">
                <MapPin size={11} /> ATC Hold
              </button>
              <div className="border-t border-white/[0.08] my-1" />
              <button onClick={() => handleInject('Engine Alert')} className="w-full px-3 py-2 text-xs text-left text-af-red hover:bg-af-red/5 flex items-center gap-2 font-mono transition-colors">
                <AlertTriangle size={11} /> Engine Alert
              </button>
            </div>
          )}
        </div>

        {/* Play/Pause */}
        <button
          onClick={isRunning ? pauseSimulation : startSimulation}
          className={`px-4 py-1.5 rounded-sm text-xs font-mono font-semibold tracking-wide border transition-colors ${
            isRunning
              ? 'border-af-red/50 text-af-red hover:bg-af-red/10'
              : 'bg-af-green border-af-green text-af-bg hover:bg-af-green/90'
          }`}
        >
          {isRunning ? '⏸ PAUSE' : '▶ START'}
        </button>

        <button
          onClick={resetSimulation}
          className="p-1.5 text-white/30 hover:text-white/70 border border-white/10 hover:border-white/25 rounded-sm transition-colors"
          title="Reset"
        >
          <RotateCcw size={13} />
        </button>
      </div>
    </header>
  );
}
