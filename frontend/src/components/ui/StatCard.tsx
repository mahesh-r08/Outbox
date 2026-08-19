import React from 'react';
import { cn } from '../../lib/utils.js';

export interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: string;
  trendPositive?: boolean;
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  trend,
  trendPositive,
  className,
}) => {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl bg-[#161F30]/80 border border-slate-800/80 p-5 shadow-xl transition-all duration-300 hover:border-slate-700 hover:shadow-brand-500/5',
        className
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          {title}
        </span>
        <div className="rounded-xl bg-slate-800/80 p-2.5 text-brand-400 border border-slate-700/50">
          {icon}
        </div>
      </div>

      <div className="mt-4 flex items-baseline gap-2">
        <span className="text-2xl font-bold tracking-tight text-white">{value}</span>
        {trend && (
          <span
            className={cn(
              'text-xs font-semibold',
              trendPositive ? 'text-emerald-400' : 'text-rose-400'
            )}
          >
            {trend}
          </span>
        )}
      </div>

      {subtitle && <p className="mt-1 text-xs text-slate-400">{subtitle}</p>}
    </div>
  );
};
