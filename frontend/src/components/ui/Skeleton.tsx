import React from 'react';
import { cn } from '../../lib/utils.js';

export const Skeleton: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <div
      className={cn(
        'animate-pulse rounded-md bg-slate-200/70',
        className
      )}
    />
  );
};
