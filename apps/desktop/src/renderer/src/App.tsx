import React, { useEffect, useState } from 'react';
import { Header } from './components/Header';
import { SystemStatusCard } from './components/SystemStatusCard';
import { SecurityCard } from './components/SecurityCard';
import { PhaseRoadmapCard } from './components/PhaseRoadmapCard';
import { SystemStatusData } from '@medidesk/shared';

export const App: React.FC = () => {
  const [status, setStatus] = useState<SystemStatusData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      if (window.mediDeskBridge) {
        const response = await window.mediDeskBridge.getSystemStatus();
        if (response.success && response.data) {
          setStatus(response.data);
        }
      } else {
        // Fallback for standalone browser testing mode
        setStatus({
          appName: 'MediDesk',
          version: '1.0.0',
          database: {
            status: 'connected',
            databasePath: '%APPDATA%/MediDesk/data/medidesk.sqlite',
            appliedMigrations: 1
          },
          application: {
            status: 'ready',
            initialized: false,
            uptimeSeconds: 12
          },
          network: {
            mode: 'offline_first',
            internetRequired: false,
            isOnline: false
          },
          licensing: {
            status: 'TRIAL',
            trialDaysRemaining: 60
          },
          security: {
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true
          },
          environment: 'development'
        });
      }
    } catch (err) {
      console.error('Failed to fetch system status via IPC:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 flex flex-col">
      <Header />

      <main className="flex-1 max-w-7xl w-full mx-auto p-6 md:p-8 space-y-6">
        {/* Foundation Welcome Banner */}
        <div className="rounded-2xl bg-gradient-to-r from-teal-900 via-teal-800 to-slate-900 p-6 text-white shadow-lg">
          <div className="max-w-2xl space-y-2">
            <h2 className="text-2xl font-bold tracking-tight text-white">
              MediDesk Foundation Shell
            </h2>
            <p className="text-sm text-teal-100/90 leading-relaxed">
              Production-quality desktop foundation initialized with Electron 33, React 18,
              TypeScript strict mode, secure sandboxed IPC, and SQLite migrations.
            </p>
          </div>
        </div>

        {/* Status and Diagnostics */}
        <SystemStatusCard status={status} loading={loading} onRefresh={fetchStatus} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SecurityCard status={status} />
          <PhaseRoadmapCard />
        </div>
      </main>

      <footer className="border-t border-slate-200 bg-white px-8 py-3 text-center text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900">
        MediDesk &copy; 2026 &bull; Offline-First Single-PC Architecture &bull; Phase 1 Foundation
      </footer>
    </div>
  );
};

export default App;
