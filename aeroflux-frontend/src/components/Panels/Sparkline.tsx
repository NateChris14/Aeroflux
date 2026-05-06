import { AreaChart, Area, ResponsiveContainer, ReferenceLine } from 'recharts';

interface SparklineProps {
  data: number[];
  color: string;
  height: number;
  showBudgetLine?: number;
}

export function Sparkline({ data, color, height, showBudgetLine }: SparklineProps) {
  const chartData = data.map((value, index) => ({ index, value }));
  
  return (
    <div className="w-full bg-af-card rounded-lg border border-white/[0.06] p-2">
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={chartData}>
          <defs>
            <linearGradient id={`gradient-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.3} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area 
            type="monotone" 
            dataKey="value" 
            stroke={color} 
            strokeWidth={2}
            fill={`url(#gradient-${color.replace('#', '')})`}
          />
          {showBudgetLine && (
            <ReferenceLine 
              y={showBudgetLine} 
              stroke="#ef4444" 
              strokeDasharray="4 4" 
              strokeWidth={1}
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
