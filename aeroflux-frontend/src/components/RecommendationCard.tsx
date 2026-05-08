import { motion } from 'framer-motion';
import type { Recommendation } from '../types/flight';
import { Zap, Fuel, Clock, Target, Check, X, Route, TrendingUp, Wind } from 'lucide-react';

interface RecommendationCardProps {
  recommendation: Recommendation;
  onAccept: () => void;
  onDismiss: () => void;
}

export function RecommendationCard({ recommendation, onAccept, onDismiss }: RecommendationCardProps) {
  const { title, description, action_type, metrics, confidence, status } = recommendation;

  const actionIcons: Record<string, typeof Route> = {
    ROUTE_CHANGE:    Route,
    ALTITUDE_CHANGE: TrendingUp,
    SPEED_CHANGE:    Wind,
    NONE:            Zap,
  };

  const ActionIcon = actionIcons[action_type] || Zap;

  return (
    <motion.div
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3 }}
      className={`relative rounded-sm border p-3.5 ${
        status === 'accepted'
          ? 'bg-af-card border-white/[0.08] border-l-2 border-l-af-green'
          : status === 'dismissed'
          ? 'bg-af-card border-white/[0.06] opacity-50'
          : 'bg-af-card border-white/[0.08] border-l-2 border-l-af-cyan'
      }`}
    >
      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        <div className={`p-1.5 rounded-sm border ${
          status === 'accepted' ? 'border-af-green/30 bg-af-green/10' : 'border-af-cyan/30 bg-af-cyan/10'
        }`}>
          <ActionIcon size={15} className={status === 'accepted' ? 'text-af-green' : 'text-af-cyan'} />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-sans font-semibold text-[13px] text-white leading-tight">{title}</h4>
          <p className="text-[11px] text-white/45 mt-0.5 leading-snug">{description}</p>
        </div>
      </div>

      {/* Metrics */}
      <div className="border-t border-white/[0.08] pt-2.5 mb-3">
        <div className="grid grid-cols-2 gap-1.5">
          <div className="flex items-center justify-between bg-af-muted rounded-sm px-2 py-1.5">
            <div className="flex items-center gap-1.5">
              <Zap size={10} className="text-af-cyan" />
              <span className="font-mono text-[9px] text-white/40 uppercase tracking-wider">Turb</span>
            </div>
            <span className="font-mono text-[11px] text-af-green font-semibold">{metrics.turbulence_avoided_min}m</span>
          </div>
          <div className="flex items-center justify-between bg-af-muted rounded-sm px-2 py-1.5">
            <div className="flex items-center gap-1.5">
              <Fuel size={10} className="text-af-orange" />
              <span className="font-mono text-[9px] text-white/40 uppercase tracking-wider">Fuel</span>
            </div>
            <span className={`font-mono text-[11px] font-semibold ${metrics.fuel_impact_kg > 0 ? 'text-af-red' : 'text-af-green'}`}>
              {metrics.fuel_impact_kg > 0 ? '+' : ''}{metrics.fuel_impact_kg}kg
            </span>
          </div>
          <div className="flex items-center justify-between bg-af-muted rounded-sm px-2 py-1.5">
            <div className="flex items-center gap-1.5">
              <Clock size={10} className="text-white/40" />
              <span className="font-mono text-[9px] text-white/40 uppercase tracking-wider">ETA</span>
            </div>
            <span className={`font-mono text-[11px] font-semibold ${metrics.eta_impact_min > 0 ? 'text-af-yellow' : 'text-af-green'}`}>
              {metrics.eta_impact_min > 0 ? '+' : ''}{metrics.eta_impact_min}m
            </span>
          </div>
          <div className="flex items-center justify-between bg-af-muted rounded-sm px-2 py-1.5">
            <div className="flex items-center gap-1.5">
              <Target size={10} className="text-af-cyan" />
              <span className="font-mono text-[9px] text-white/40 uppercase tracking-wider">CONF</span>
            </div>
            <span className="font-mono text-[11px] text-af-cyan font-semibold">{Math.round(confidence * 100)}%</span>
          </div>
        </div>
      </div>

      {/* Confidence bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="font-mono text-[9px] text-white/30 uppercase tracking-wider">Confidence</span>
          <span className="font-mono text-[9px] text-af-cyan/70">{Math.round(confidence * 100)}%</span>
        </div>
        <div className="h-1 bg-white/[0.08] rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${confidence * 100}%` }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="h-full bg-af-cyan rounded-full"
          />
        </div>
      </div>

      {/* Actions */}
      {status === 'pending' ? (
        <div className="flex gap-2">
          <button
            onClick={onAccept}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-af-green hover:bg-af-green/85 text-af-bg rounded-sm text-[11px] font-mono font-semibold tracking-wide transition-colors"
          >
            <Check size={12} />
            ACCEPT
          </button>
          <button
            onClick={onDismiss}
            className="px-3 py-2 border border-white/[0.15] hover:border-white/30 text-white/40 hover:text-white/70 rounded-sm text-[11px] transition-colors"
          >
            <X size={12} />
          </button>
        </div>
      ) : status === 'accepted' ? (
        <div className="flex items-center gap-2 text-af-green text-[11px] font-mono">
          <Check size={12} />
          <span>
            {action_type === 'ALTITUDE_CHANGE' ? 'Climbing to new flight level…'
              : action_type === 'SPEED_CHANGE' ? 'Speed adjustment applied…'
              : 'Route deviation applied'}
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-white/35 text-[11px] font-mono">
          <X size={12} />
          <span>Dismissed</span>
        </div>
      )}
    </motion.div>
  );
}
