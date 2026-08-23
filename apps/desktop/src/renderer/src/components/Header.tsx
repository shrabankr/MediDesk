import React from 'react';
import { Activity, ShieldCheck, WifiOff } from 'lucide-react';
import { Badge } from '@medidesk/ui';

export const Header: React.FC = () => {
  return (
    <header className="sticky top-0 z-50 flex h-16 w-full items-center justify-between border-b border-slate-200 bg-white/80 px-8 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-600 text-white shadow-md shadow-teal-600/20">
          <Activity className="h-6 w-6" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              MediDesk
            </h1>
            <Badge variant="outline" className="border-teal-600/30 text-teal-600 font-mono text-[10px]">
              v1.0.0 (Phase 1)
            </Badge>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Clinical & Pharmacy Management Platform
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          <WifiOff className="h-3.5 w-3.5 text-blue-500" />
          <span>Offline-First (Single-PC)</span>
        </div>
        <div className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
          <span>Sandboxed Core</span>
        </div>
      </div>
    </header>
  );
};
