import React from 'react';
import { Database, Cpu, Wifi, HardDrive, RefreshCw } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, StatusIndicator, Badge, Button } from '@medidesk/ui';
import { SystemStatusData } from '@medidesk/shared';

interface SystemStatusCardProps {
  status: SystemStatusData | null;
  loading: boolean;
  onRefresh: () => void;
}

export const SystemStatusCard: React.FC<SystemStatusCardProps> = ({
  status,
  loading,
  onRefresh
}) => {
  return (
    <Card className="border-slate-200/80 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Cpu className="h-5 w-5 text-teal-600" />
            System Status
          </CardTitle>
          <CardDescription>
            Real-time runtime health across Electron Main, Preload Bridge, and SQLite
          </CardDescription>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={loading}
          className="h-8 gap-1.5 text-xs"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </CardHeader>

      <CardContent className="pt-2">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Database Status */}
          <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-800/40">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Database className="h-4 w-4 text-emerald-600" />
                Database
              </span>
              <StatusIndicator
                status={status?.database.status === 'connected' ? 'connected' : 'error'}
                label={status?.database.status === 'connected' ? 'Connected' : 'Offline'}
              />
            </div>
            <div className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
              <div className="flex justify-between">
                <span className="text-slate-400">Engine:</span>
                <span className="font-mono font-medium">SQLite (WAL + FK)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Applied Migrations:</span>
                <Badge variant="success" className="text-[10px] py-0">
                  v{status?.database.appliedMigrations ?? 0}
                </Badge>
              </div>
              <div className="truncate text-[11px] text-slate-400 pt-1">
                Path: <span className="font-mono">{status?.database.databasePath ?? 'Loading...'}</span>
              </div>
            </div>
          </div>

          {/* Application Status */}
          <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-800/40">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Cpu className="h-4 w-4 text-teal-600" />
                Application
              </span>
              <StatusIndicator
                status={status?.application.status === 'ready' ? 'ready' : 'warning'}
                label={status?.application.status === 'ready' ? 'Ready' : 'Pending'}
              />
            </div>
            <div className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
              <div className="flex justify-between">
                <span className="text-slate-400">Lifecycle:</span>
                <span className="font-medium text-emerald-600">Phase 1 Foundation</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">First-Run Initialized:</span>
                <span className="font-medium">
                  {status?.application.initialized ? 'Yes' : 'Pending First-Run'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Process Uptime:</span>
                <span className="font-mono">{status?.application.uptimeSeconds ?? 0}s</span>
              </div>
            </div>
          </div>

          {/* Network / Offline Status */}
          <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-800/40">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Wifi className="h-4 w-4 text-blue-600" />
                Connectivity
              </span>
              <Badge variant="info" className="text-[11px]">
                Not Required
              </Badge>
            </div>
            <div className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
              <div className="flex justify-between">
                <span className="text-slate-400">Architecture:</span>
                <span className="font-medium">Offline-First</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">LAN / Cloud Mode:</span>
                <span className="font-medium text-slate-500">Disabled (Phase 1)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Internet Dependency:</span>
                <span className="font-semibold text-blue-600">0% for core clinic ops</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
