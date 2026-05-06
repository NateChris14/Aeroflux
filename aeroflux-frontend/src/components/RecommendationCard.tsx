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
    ROUTE_CHANGE: Route,
    ALTITUDE_CHANGE: TrendingUp,
    SPEED_CHANGE: Wind,
    NONE: Zap,
  };

  const ActionIcon = actionIcons[action_type] || Zap;

  return (
    <motion.div
      initial={{ opacity: 0, x: 20, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      transition={{ duration: 0.4 }}
      className={`relative rounded-lg border p-4 ${
        status === 'accepted' 
          ? 'bg-gradient-to-br from-af-green/10 to-af-green/5 border-af-green/30' 
          : status === 'dismissed'
          ? 'bg-af-card border-white/[0.06] opacity-60'
          : 'bg-gradient-to-br from-[#1a2535] to-[#0d1a2a] border-af-cyan'
      }`}
    >
      {/* Top border accent */}
      {status === 'pending' && (
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-af-cyan" />
      )}

      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        <div className={`p-2 rounded-lg ${
          status === 'accepted' ? 'bg-af-green/20' : 'bg-af-cyan/20'
        }`}>
          <ActionIcon size={18} className={status === 'accepted' ? 'text-af-green' : 'text-af-cyan'} />
        </div>
        <div className="flex-1">
          <h4 className="font-sans font-semibold text-sm text-white">{title}</h4>
          <p className="text-xs text-white/50 mt-1">{description}</p>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <div className="flex items-center gap-2 text-xs">
          <Zap size={12} className="text-af-cyan" />
          <span className="text-white/50">Turb avoided</span>
          <span className="font-mono text-af-green ml-auto">{metrics.turbulence_avoided_min}m</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <Fuel size={12} className="text-af-orange" />
          <span className="text-white/50">Fuel</span>
          <span className={`font-mono ml-auto ${metrics.fuel_impact_kg > 0 ? 'text-af-red' : 'text-af-green'}`}>
            {metrics.fuel_impact_kg > 0 ? '+' : ''}{metrics.fuel_impact_kg}kg
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <Clock size={12} className="text-white/40" />
          <span className="text-white/50">ETA</span>
          <span className={`font-mono ml-auto ${metrics.eta_impact_min > 0 ? 'text-af-yellow' : 'text-af-green'}`}>
            {metrics.eta_impact_min > 0 ? '+' : ''}{metrics.eta_impact_min}m
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <Target size={12} className="text-af-purple" />
          <span className="text-white/50">Confidence</span>
          <span className="font-mono text-af-yellow ml-auto">{Math.round(confidence * 100)}%</span>
        </div>
      </div>

      {/* Confidence bar */}
      <div className="mb-4">
        <div className="h-1 bg-white/10 rounded-full overflow-hidden">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${confidence * 100}%` }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="h-full bg-af-yellow rounded-full"
          />
        </div>
      </div>

      {/* Actions */}
      {status === 'pending' ? (
        <div className="flex gap-2">
          <button
            onClick={onAccept}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-af-green hover:bg-af-green/80 text-white rounded-lg text-xs font-medium transition-colors"
          >
            <Check size={14} />
            Accept Recommendation
          </button>
          <button
            onClick={onDismiss}
            className="px-4 py-2 border border-white/20 hover:bg-white/5 text-white/60 hover:text-white rounded-lg text-xs transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      ) : status === 'accepted' ? (
        <div className="flex items-center gap-2 text-af-green text-xs">
          <Check size={14} />
          <span>
            {action_type === 'ALTITUDE_CHANGE'
              ? 'Climbing to new flight level…'
              : 'Route deviation applied'}
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-white/40 text-xs">
          <X size={14} />
          <span>Dismissed</span>
        </div>
      )}
    </motion.div>
  );
}
