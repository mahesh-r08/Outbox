import React from 'react';
import { cn } from '../../lib/utils.js';
import type { EmailStatus } from '../../types/index.js';

export interface StatusBadgeProps {
  status: EmailStatus | string;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  className,
}) => {
  const normalized = status.toLowerCase();

  const getStatusConfig = () => {
    switch (normalized) {
      case 'sent':
      case 'completed':
        return {
          label: 'Sent',
          styles: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        };
      case 'processing':
        return {
          label: 'Processing',
          styles: 'bg-blue-50 text-blue-700 border-blue-200',
        };
      case 'scheduled':
        return {
          label: 'Scheduled',
          styles: 'bg-purple-50 text-purple-700 border-purple-200',
        };
      case 'queued':
        return {
          label: 'Queued',
          styles: 'bg-slate-100 text-slate-700 border-slate-200',
        };
      case 'rescheduled':
        return {
          label: 'Rescheduled',
          styles: 'bg-amber-50 text-amber-700 border-amber-200',
        };
      case 'failed':
        return {
          label: 'Failed',
          styles: 'bg-rose-50 text-rose-700 border-rose-200',
        };
      case 'cancelled':
        return {
          label: 'Cancelled',
          styles: 'bg-slate-100 text-slate-600 border-slate-200',
        };
      default:
        return {
          label: status,
          styles: 'bg-slate-100 text-slate-700 border-slate-200',
        };
    }
  };

  const config = getStatusConfig();

  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border select-none',
        config.styles,
        className
      )}
    >
      {config.label}
    </span>
  );
};
