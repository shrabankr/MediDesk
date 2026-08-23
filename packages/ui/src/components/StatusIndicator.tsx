import React from 'react';
import { cn } from '../utils/cn.js';

export interface StatusIndicatorProps {
  status: 'online' | 'ready' | 'connected' | 'offline' | 'warning' | 'error' | 'neutral';
  label?: string;
  className?: string;
}

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  status,
  label,
  className
}) => {
  const colorMap = {
    online: 'bg-emerald-500 shadow-emerald-500/40',
    ready: 'bg-emerald-500 shadow-emerald-500/40',
    connected: 'bg-emerald-500 shadow-emerald-500/40',
    offline: 'bg-blue-500 shadow-blue-500/40',
    warning: 'bg-amber-500 shadow-amber-500/40',
    error: 'bg-rose-500 shadow-rose-500/40',
    neutral: 'bg-slate-400 shadow-slate-400/40'
  };

  return (
    <div className={cn('inline-flex items-center gap-2', className)}>
      <span
        className={cn(
          'relative flex h-2.5 w-2.5 rounded-full shadow-sm',
          colorMap[status] || colorMap.neutral
        )}
      >
        <span
          className={cn(
            'absolute inline-flex h-full w-full animate-ping rounded-full opacity-75',
            colorMap[status] || colorMap.neutral
          )}
        />
      </span>
      {label && <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{label}</span>}
    </div>
  );
};
