import React from 'react';
import { SystemStatusCard } from './SystemStatusCard';
import { SecurityCard } from './SecurityCard';
import { PhaseRoadmapCard } from './PhaseRoadmapCard';
import { SystemStatusData } from '@medidesk/shared';

interface DashboardViewProps {
  status: SystemStatusData | null;
  loading: boolean;
  onRefresh: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ status, loading, onRefresh }) => {
  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-teal-900 via-teal-800 to-slate-900 p-6 text-white shadow-lg">
        <div className="max-w-3xl space-y-2">
          <h2 className="text-2xl font-bold tracking-tight text-white">
            MediDesk Control Center
          </h2>
          <p className="text-sm text-teal-100/90 leading-relaxed">
            Offline-first clinical and pharmacy management platform running on Electron 33 with local SQLite persistence, Scrypt authentication, and RBAC privilege separation.
          </p>
        </div>
      </div>

      {/* System Status */}
      <SystemStatusCard status={status} loading={loading} onRefresh={onRefresh} />

      {/* Security & Roadmap Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SecurityCard status={status} />
        <PhaseRoadmapCard />
      </div>
    </div>
  );
};
