import React, { useState, useEffect } from 'react';
import { SystemStatusCard } from './SystemStatusCard';
import { SecurityCard } from './SecurityCard';
import { PhaseRoadmapCard } from './PhaseRoadmapCard';
import { SystemStatusData, SessionUser, TodayMetricsData } from '@medidesk/shared';

interface DashboardViewProps {
  status: SystemStatusData | null;
  loading: boolean;
  onRefresh: () => void;
  currentUser?: SessionUser | null;
  onNavigateTab?: (tab: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  status,
  loading,
  onRefresh,
  currentUser,
  onNavigateTab
}) => {
  const [todayMetrics, setTodayMetrics] = useState<TodayMetricsData | null>(null);
  const sessionToken = localStorage.getItem('medidesk_session_token') || '';

  useEffect(() => {
    if (!currentUser || !window.mediDeskBridge) return;
    const today = new Date().toISOString().split('T')[0];

    window.mediDeskBridge
      .getTodayMetrics(currentUser.organizationId, today, sessionToken)
      .then((res) => {
        if (res.success && res.data) {
          setTodayMetrics(res.data);
        }
      })
      .catch((err) => console.error('Failed to load dashboard metrics:', err));
  }, [currentUser, sessionToken]);

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 p-6 text-white shadow-lg">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="max-w-2xl space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 bg-blue-500/30 text-blue-200 text-xs font-semibold rounded-full border border-blue-400/30">
                Phase 3: Active
              </span>
              <span className="text-xs text-blue-200/80">
                Clinic: {currentUser?.organizationName || 'MediDesk Clinic'}
              </span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-white">
              Welcome back, {currentUser?.fullName || 'Staff Member'}
            </h2>
            <p className="text-xs text-blue-100/80">
              Offline-first medical practice system • Quick registration, fast search, and live waiting queue.
            </p>
          </div>

          {/* Fast Quick Action Buttons */}
          {onNavigateTab && (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => onNavigateTab('appointments')}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow transition flex items-center gap-1.5"
              >
                <span>📅</span> Book Appointment
              </button>
              <button
                onClick={() => onNavigateTab('patients')}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow transition flex items-center gap-1.5"
              >
                <span>👤</span> Register Patient
              </button>
              <button
                onClick={() => onNavigateTab('appointments')}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold shadow transition flex items-center gap-1.5"
              >
                <span>📋</span> View Queue
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Live Operational Metrics if logged in */}
      {todayMetrics && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div
            onClick={() => onNavigateTab && onNavigateTab('appointments')}
            className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm cursor-pointer hover:border-blue-400 transition"
          >
            <span className="text-xs text-slate-500 block">Today's Appointments</span>
            <span className="text-2xl font-extrabold text-blue-600 dark:text-blue-400">{todayMetrics.total}</span>
          </div>

          <div
            onClick={() => onNavigateTab && onNavigateTab('appointments')}
            className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm cursor-pointer hover:border-amber-400 transition"
          >
            <span className="text-xs text-slate-500 block">Waiting in Queue</span>
            <span className="text-2xl font-extrabold text-amber-600 dark:text-amber-400">{todayMetrics.waiting}</span>
          </div>

          <div
            onClick={() => onNavigateTab && onNavigateTab('appointments')}
            className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm cursor-pointer hover:border-emerald-400 transition"
          >
            <span className="text-xs text-slate-500 block">In Consultation</span>
            <span className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">
              {todayMetrics.inConsultation}
            </span>
          </div>

          <div
            onClick={() => onNavigateTab && onNavigateTab('appointments')}
            className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm cursor-pointer hover:border-slate-400 transition"
          >
            <span className="text-xs text-slate-500 block">Completed Today</span>
            <span className="text-2xl font-extrabold text-slate-700 dark:text-slate-300">
              {todayMetrics.completed}
            </span>
          </div>
        </div>
      )}

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
