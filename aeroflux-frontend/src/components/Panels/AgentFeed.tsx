import { useSimulation } from '../../context/SimulationContext';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Cloud, Fuel, Radio, Armchair, 
  Sparkles, AlertCircle, AlertTriangle, Info 
} from 'lucide-react';

export function AgentFeed() {
  const { agentMessages, isRunning } = useSimulation();

  const agentIcons: Record<string, typeof Cloud> = {
    WEATHER: Cloud,
    FUEL: Fuel,
    ATC: Radio,
    COMFORT: Armchair,
    SUPERVISOR: Sparkles,
  };

  const agentStyles: Record<string, string> = {
    WEATHER: 'bg-cyan-950/50 text-cyan-300 border-cyan-800',
    FUEL: 'bg-orange-950/50 text-orange-300 border-orange-800',
    ATC: 'bg-purple-950/50 text-purple-300 border-purple-800',
    COMFORT: 'bg-green-950/50 text-green-300 border-green-800',
    SUPERVISOR: 'bg-yellow-950/50 text-yellow-300 border-yellow-800',
  };

  const severityIcons: Record<string, typeof Info> = {
    info: Info,
    warning: AlertCircle,
    critical: AlertTriangle,
  };

  return (
    <div className="h-[220px] bg-af-panel border-t border-white/[0.06] flex flex-col">
      {/* Header */}
      <div className="px-4 py-2 border-b border-white/[0.06] flex items-center justify-between">
        <h3 className="font-mono text-[10px] text-white/40 uppercase">Agent Feed</h3>
        {isRunning && (
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-af-cyan animate-pulse" />
            <span className="font-mono text-[10px] text-af-cyan">LIVE</span>
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        <AnimatePresence initial={false}>
          {agentMessages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-white/20 text-sm">
              Waiting for agent messages...
            </div>
          ) : (
            agentMessages.slice().reverse().map((msg) => {
              const Icon = agentIcons[msg.agent] || Cloud;
              const SeverityIcon = severityIcons[msg.severity] || Info;
              
              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                  className="flex items-center gap-3 px-3 py-2 bg-af-card rounded-lg border border-white/[0.06] hover:bg-white/[0.02] transition-colors"
                >
                  {/* Agent Badge */}
                  <div className={`flex items-center gap-1 px-2 py-1 rounded-md border text-[10px] font-mono ${agentStyles[msg.agent]}`}>
                    <Icon size={10} />
                    <span>{msg.agent}</span>
                  </div>

                  {/* Severity */}
                  <SeverityIcon 
                    size={14} 
                    className={
                      msg.severity === 'critical' ? 'text-af-red' :
                      msg.severity === 'warning' ? 'text-af-yellow' :
                      'text-af-green'
                    } 
                  />

                  {/* Message */}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-white/80 truncate">{msg.message}</p>
                    {msg.finding && (
                      <p className="text-[10px] text-white/40 truncate">{msg.finding}</p>
                    )}
                  </div>

                  {/* Timestamp */}
                  <span className="font-mono text-[10px] text-white/30 whitespace-nowrap">
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
