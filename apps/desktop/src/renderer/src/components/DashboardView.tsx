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
  const [activeAlerts, setActiveAlerts] = useState<any[]>([]);
  const sessionToken = localStorage.getItem('medidesk_session_token') || '';

  const userRole = currentUser?.roles?.[0] || 'STAFF';

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

    // Load active smart alerts
    if (window.mediDeskBridge.getActiveAlerts) {
      window.mediDeskBridge
        .getActiveAlerts(10)
        .then((res) => {
          if (res.success && res.data) {
            setActiveAlerts(res.data);
          }
        })
        .catch((err) => console.error('Failed to load smart alerts:', err));
    }
  }, [currentUser, sessionToken]);

  const handleAcknowledgeAlert = async (alertId: string) => {
    if (!window.mediDeskBridge?.acknowledgeAlert) return;
    try {
      const res = await window.mediDeskBridge.acknowledgeAlert(alertId, 24);
      if (res.success) {
        setActiveAlerts((prev) => prev.filter((a) => a.id !== alertId));
      }
    } catch (err) {
      console.error('Failed to acknowledge alert:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 p-6 text-white shadow-lg">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="max-w-2xl space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 bg-blue-500/30 text-blue-200 text-xs font-semibold rounded-full border border-blue-400/30">
                Phase 8: Active
              </span>
              <span className="text-xs text-blue-200/80">
                Role: <span className="font-bold text-white uppercase">{userRole}</span> • Clinic: {currentUser?.organizationName || 'MediDesk Clinic'}
              </span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-white">
              Welcome back, {currentUser?.fullName || 'Staff Member'}
            </h2>
            <p className="text-xs text-blue-100/80">
              Offline-first medical practice system • Smart alerts, deterministic multi-tier packaging & Hybrid backup.
            </p>
          </div>

          {/* Role-Specific Quick Action Buttons */}
          {onNavigateTab && (
            <div className="flex flex-wrap gap-2">
              {userRole === 'DOCTOR' && (
                <>
                  <button
                    onClick={() => onNavigateTab('appointments')}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow transition flex items-center gap-1.5"
                  >
                    <span>🩺</span> OPD Queue
                  </button>
                  <button
                    onClick={() => onNavigateTab('patients')}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow transition flex items-center gap-1.5"
                  >
                    <span>👤</span> Patient Search
                  </button>
                </>
              )}

              {userRole === 'STAFF' && (
                <>
                  <button
                    onClick={() => onNavigateTab('pos')}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow transition flex items-center gap-1.5"
                  >
                    <span>🛒</span> Quick POS Billing
                  </button>
                  <button
                    onClick={() => onNavigateTab('appointments')}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow transition flex items-center gap-1.5"
                  >
                    <span>📅</span> Book / Check-In
                  </button>
                  <button
                    onClick={() => onNavigateTab('patients')}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold shadow transition flex items-center gap-1.5"
                  >
                    <span>👤</span> Register Patient
                  </button>
                </>
              )}

              {userRole === 'OWNER' && (
                <>
                  <button
                    onClick={() => onNavigateTab('pos')}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow transition flex items-center gap-1.5"
                  >
                    <span>🛒</span> POS Terminal
                  </button>
                  <button
                    onClick={() => onNavigateTab('pharmacy')}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold shadow transition flex items-center gap-1.5"
                  >
                    <span>📦</span> Inventory & Packaging
                  </button>
                  <button
                    onClick={() => onNavigateTab('settings')}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow transition flex items-center gap-1.5"
                  >
                    <span>⚙️</span> Clinic Settings
                  </button>
                </>
              )}

              {userRole === 'DEVELOPER' && (
                <button
                  onClick={() => onNavigateTab('settings')}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-800 text-white rounded-lg text-xs font-bold shadow transition flex items-center gap-1.5"
                >
                  <span>🛠️</span> System Diagnostics
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Active Smart Alerts Bar */}
      {activeAlerts.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold text-amber-900 dark:text-amber-200 flex items-center gap-2">
              <span>🔔</span> Notification Center ({activeAlerts.length} Active)
            </h3>
          </div>
          <div className="space-y-2">
            {activeAlerts.slice(0, 3).map((alert) => (
              <div
                key={alert.id}
                className="flex items-center justify-between bg-white dark:bg-slate-800 p-3 rounded-lg border border-amber-200 dark:border-slate-700 text-xs"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      alert.severity === 'CRITICAL' || alert.severity === 'MANDATORY_SAFETY'
                        ? 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300'
                        : 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300'
                    }`}
                  >
                    {alert.severity}
                  </span>
                  <span className="font-semibold text-slate-800 dark:text-slate-100">{alert.title}:</span>
                  <span className="text-slate-600 dark:text-slate-300">{alert.message}</span>
                </div>
                {alert.severity !== 'MANDATORY_SAFETY' && (
                  <button
                    onClick={() => handleAcknowledgeAlert(alert.id)}
                    className="px-2.5 py-1 text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded transition"
                  >
                    Snooze (24h)
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Live Operational Metrics if logged in (for non-developer roles) */}
      {userRole !== 'DEVELOPER' && todayMetrics && (
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
