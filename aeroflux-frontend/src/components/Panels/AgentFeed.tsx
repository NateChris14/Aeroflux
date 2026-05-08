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
    <div className="h-[220px] bg-af-panel border-t border-white/[0.10] flex flex-col">
      {/* Header */}
      <div className="px-4 py-2 border-b border-white/[0.08] flex items-center justify-between">
        <h3 className="section-label">Agent Feed</h3>
        {isRunning && (
          <span className="font-mono text-[11px] text-af-green tracking-widest">■ LIVE</span>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        <AnimatePresence initial={false}>
          {agentMessages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-white/20 text-xs font-mono tracking-wide">
              Waiting for agent messages…
            </div>
          ) : (
            agentMessages.slice().reverse().map((msg) => {
              const Icon = agentIcons[msg.agent] || Cloud;
              const SeverityIcon = severityIcons[msg.severity] || Info;

              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -16 }}
                  transition={{ duration: 0.25 }}
                  className={`flex items-center gap-3 px-3 py-2 bg-af-card rounded-sm border border-white/[0.07] border-l-2 ${agentBorderAccent[msg.agent] || 'border-l-white/20'} hover:bg-white/[0.02] transition-colors`}
                >
                  {/* Agent label */}
                  <div className={`flex items-center gap-1 font-mono text-[10px] font-semibold tracking-widest shrink-0 ${agentColors[msg.agent] || 'text-white/40'}`}>
                    <Icon size={10} />
                    <span>[{msg.agent}]</span>
                  </div>

                  {/* Severity */}
                  <SeverityIcon size={12} className={`shrink-0 ${severityColors[msg.severity] || 'text-white/40'}`} />

                  {/* Message */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-white/75 truncate font-sans">{msg.message}</p>
                    {msg.finding && (
                      <p className="text-[10px] text-white/35 truncate font-mono italic">{msg.finding}</p>
                    )}
                  </div>

                  {/* Timestamp */}
                  <span className="font-mono text-[10px] text-white/25 whitespace-nowrap tabular-nums">
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
