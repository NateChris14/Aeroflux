import { useSimulation } from '../../context/SimulationContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Cloud, Fuel, Radio, Armchair, Sparkles, AlertCircle, AlertTriangle, Info } from 'lucide-react';

export function AgentFeed() {
  const { agentMessages, isRunning } = useSimulation();

  const agentIcons: Record<string, typeof Cloud> = {
    WEATHER: Cloud,
    FUEL: Fuel,
    ATC: Radio,
    COMFORT: Armchair,
    SUPERVISOR: Sparkles,
  };

  const agentColors: Record<string, string> = {
    WEATHER:    'text-af-cyan',
    FUEL:       'text-af-orange',
    ATC:        'text-af-purple',
    COMFORT:    'text-af-green',
    SUPERVISOR: 'text-white/60',
  };

  const agentBorderAccent: Record<string, string> = {
    WEATHER:    'border-l-af-cyan',
    FUEL:       'border-l-af-orange',
    ATC:        'border-l-af-purple',
    COMFORT:    'border-l-af-green',
    SUPERVISOR: 'border-l-white/25',
  };

  const severityIcons: Record<string, typeof Info> = {
    info:     Info,
    warning:  AlertCircle,
    critical: AlertTriangle,
  };

  const severityColors: Record<string, string> = {
    info:     'text-af-green',
    warning:  'text-af-yellow',
    critical: 'text-af-red',
  };

  return (
    <div className="h-[220px] bg-af-panel border-t border-af-cyan/[0.10] flex flex-col">
      {/* ATC-style header bar */}
      <div className="atc-bar shrink-0">
        <h3 className="section-label">Agent Communications Log</h3>
        <span className={`font-mono text-[11px] tracking-widest ${isRunning ? 'text-af-green atc-glow-green' : 'text-white/20'}`}>
          {isRunning ? '◆ LIVE' : '◇ OFFLINE'}
        </span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-2 py-1 space-y-px">
        <AnimatePresence initial={false}>
          {agentMessages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-white/15 text-[11px] font-mono tracking-[0.2em] uppercase">
              Awaiting transmissions…
            </div>
          ) : (
            agentMessages.slice().reverse().map((msg) => {
              const Icon = agentIcons[msg.agent] || Cloud;
              const SeverityIcon = severityIcons[msg.severity] || Info;

              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -12 }}
                  transition={{ duration: 0.2 }}
                  className={`flex items-center gap-3 px-3 py-1.5 bg-af-card border-l-2 ${agentBorderAccent[msg.agent] || 'border-l-white/20'} hover:bg-af-muted transition-colors`}
                >
                  {/* Agent label */}
                  <div className={`flex items-center gap-1 font-mono text-[10px] font-semibold tracking-[0.15em] shrink-0 ${agentColors[msg.agent] || 'text-white/40'}`}>
                    <Icon size={9} />
                    <span>▸{msg.agent}</span>
                  </div>

                  {/* Severity */}
                  <SeverityIcon size={11} className={`shrink-0 ${severityColors[msg.severity] || 'text-white/40'}`} />

                  {/* Message */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-white/70 truncate font-sans">{msg.message}</p>
                    {msg.finding && (
                      <p className="text-[10px] text-white/30 truncate font-mono italic">{msg.finding}</p>
                    )}
                  </div>

                  {/* Timestamp */}
                  <span className="font-mono text-[10px] text-white/20 whitespace-nowrap tabular-nums shrink-0">
                    {msg.sim_elapsed}
                  </span>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
