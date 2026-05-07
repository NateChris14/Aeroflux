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

  const phaseColors = {
    GROUND: 'bg-gray-500',
    CLIMB: 'bg-af-yellow',
    CRUISE: 'bg-af-cyan',
    DESCENT: 'bg-af-orange',
    DEVIATION: 'bg-af-red',
  };

  const handleInject = (eventType: string) => {
    injectEvent(eventType);
    setShowDropdown(false);
  };

  return (
    <header className="h-14 bg-af-header border-b border-white/[0.06] flex items-center justify-between px-4 shrink-0">
      {/* Left: Logo */}
      <div className="flex items-center gap-3">
        <div className="flex items-center">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <path d="M4 20L24 8" stroke="#06b6d4" strokeWidth="1.5" />
            <text x="6" y="18" fill="#06b6d4" fontSize="12" fontWeight="600">AF</text>
          </svg>
        </div>
        <span className="font-sans font-semibold text-white text-sm">AeroFlux AI</span>
        <div className="w-px h-4 bg-white/20 mx-2" />
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-af-green animate-pulse" />
          <span className="font-mono text-xs text-af-green uppercase tracking-wide">Live</span>
        </div>
      </div>

      {/* Center: Flight Info */}
      <div className="flex flex-col items-center">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-mono font-semibold text-white">{flightState.callsign}</span>
          <span className="text-white/40">·</span>
          <span className="text-white/70">{flightState.origin} → {flightState.destination}</span>
          <span className="text-white/40">·</span>
          <span className="text-white/70 text-xs">{flightState.aircraft_type}</span>
        </div>
        <div className={`mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider text-white ${phaseColors[flightState.phase]}`}>
          {flightState.phase}
        </div>
      </div>

      {/* Right: Controls */}
      <div className="flex items-center gap-3">
        {/* UTC Clock */}
        <span className="font-mono text-sm text-white/80">{utcTime}</span>

        {/* Speed Controls */}
        <div className="flex items-center bg-af-panel rounded-lg p-0.5">
          {[1, 2, 4].map((speed) => (
            <button
              key={speed}
              onClick={() => setSimSpeed(speed as 1 | 2 | 4)}
              className={`px-2 py-0.5 text-xs font-mono rounded ${
                simSpeed === speed ? 'bg-af-cyan text-white' : 'text-white/50 hover:text-white'
              }`}
            >
              {speed}×
            </button>
          ))}
        </div>

        {/* Inject Event Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-af-panel hover:bg-af-card border border-white/[0.06] rounded-lg text-xs text-white transition-colors"
          >
            <AlertTriangle size={12} />
            Inject Event
          </button>
          {showDropdown && (
            <div className="absolute right-0 top-full mt-1 w-40 bg-af-panel border border-white/[0.06] rounded-lg shadow-xl z-50 py-1">
              <button onClick={() => handleInject('Turbulence')} className="w-full px-3 py-2 text-xs text-left text-white hover:bg-white/5 flex items-center gap-2">
                <Wind size={12} /> Turbulence
              </button>
              <button onClick={() => handleInject('Headwind')} className="w-full px-3 py-2 text-xs text-left text-white hover:bg-white/5 flex items-center gap-2">
                <Activity size={12} /> Headwind
              </button>
              <button onClick={() => handleInject('ATC Hold')} className="w-full px-3 py-2 text-xs text-left text-white hover:bg-white/5 flex items-center gap-2">
                <MapPin size={12} /> ATC Hold
              </button>
              <button onClick={() => handleInject('Engine Alert')} className="w-full px-3 py-2 text-xs text-left text-af-red hover:bg-white/5 flex items-center gap-2">
                <AlertTriangle size={12} /> Engine Alert
              </button>
            </div>
          )}
        </div>

        {/* Play/Pause/Reset */}
        <button
          onClick={isRunning ? pauseSimulation : startSimulation}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            isRunning ? 'bg-af-red/20 text-af-red' : 'bg-af-green/20 text-af-green'
          }`}
        >
          {isRunning ? 'Pause' : 'Start'}
        </button>
        <button
          onClick={resetSimulation}
          className="p-1.5 text-white/50 hover:text-white transition-colors"
          title="Reset"
        >
          <RotateCcw size={14} />
        </button>
      </div>
    </header>
  );
}
