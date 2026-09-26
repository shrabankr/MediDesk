import React, { useEffect, useState, useCallback } from 'react';
import { SetupWizard } from './components/SetupWizard';
import { LoginScreen } from './components/LoginScreen';
import { AppLayout, NavTab } from './components/AppLayout';
import { DashboardView } from './components/DashboardView';
import { PatientManagementView } from './components/PatientManagementView';
import { DoctorManagementView } from './components/DoctorManagementView';
import { AppointmentManagementView } from './components/AppointmentManagementView';
import { ClinicalConsultationView } from './components/ClinicalConsultationView';
import { PharmacyPOSView } from './components/PharmacyPOSView';
import { MedicineMasterView } from './components/MedicineMasterView';
import { InventoryStockView } from './components/InventoryStockView';
import { PurchaseManagementView } from './components/PurchaseManagementView';
import { UserManagementView } from './components/UserManagementView';
import { SettingsManagementView } from './components/SettingsManagementView';
import { AuditLogView } from './components/AuditLogView';
import { RbacExplorerView } from './components/RbacExplorerView';
import { BulkDataImportView } from './components/BulkDataImportView';
import { SystemStatusData, InitializationStateData, Patient } from '@medidesk/shared';
import { SessionUser } from '@medidesk/domain';

/**
 * BrowserGuardScreen — renders when window.mediDeskBridge is absent.
 *
 * The preload bridge is only injected by Electron's sandboxed preload script.
 * When MediDesk is accessed via a plain web browser (Chrome, Edge, Firefox),
 * window.mediDeskBridge is always undefined and login is impossible. This
 * component replaces the entire UI with a clear, actionable message.
 */
const BrowserGuardScreen: React.FC = () => (
  <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
    <div className="max-w-lg w-full text-center space-y-6">
      {/* Shield icon */}
      <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-teal-500/10 border border-teal-500/20 mx-auto">
        <svg className="w-10 h-10 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
        </svg>
      </div>

      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">MediDesk Desktop App Required</h1>
        <p className="text-slate-400 text-sm mt-2">
          You are viewing MediDesk in a <span className="text-amber-400 font-medium">web browser</span>. Login is not available here.
        </p>
      </div>

      {/* Explanation card */}
      <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-5 text-left space-y-4">
        <p className="text-slate-300 text-sm leading-relaxed">
          MediDesk is an <strong className="text-white">offline desktop application</strong> that connects directly to a local
          encrypted SQLite database on your PC. The secure IPC bridge that enables login, patient records, and pharmacy
          operations is only available inside the native Electron desktop window.
        </p>

        <div className="bg-slate-900/80 border border-slate-700/60 rounded-xl p-4 space-y-2">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">How to open MediDesk correctly</p>
          <ol className="text-sm text-slate-300 space-y-1 list-decimal list-inside">
            <li>Open <strong className="text-white">File Explorer</strong> on your Windows PC</li>
            <li>Navigate to the folder below</li>
            <li>Double-click <code className="bg-slate-800 px-1.5 py-0.5 rounded text-teal-300 font-mono text-xs">MediDesk.exe</code></li>
          </ol>
          <div className="mt-3 bg-slate-950 rounded-lg px-3 py-2 border border-slate-700/40">
            <code className="text-xs text-teal-300 font-mono break-all">
              apps\desktop\release\win-unpacked\MediDesk.exe
            </code>
          </div>
        </div>

        <div className="flex items-start gap-2.5 bg-blue-950/40 border border-blue-800/40 rounded-lg px-3 py-2.5">
          <svg className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
          </svg>
          <p className="text-xs text-blue-300 leading-relaxed">
            If you are a developer running <code className="font-mono text-blue-200">npm run dev</code>,
            MediDesk automatically opens a native Electron window. Use that window — not the browser tab that opens with the dev server URL.
          </p>
        </div>
      </div>

      <p className="text-xs text-slate-600">MediDesk Clinical &amp; Pharmacy Management • Offline Desktop Application</p>
    </div>
  </div>
);

export const App: React.FC = () => {
  // Guard: window.mediDeskBridge is only available inside the Electron desktop
  // environment (injected via the sandboxed preload script). In a plain web
  // browser there is no bridge and login will always fail — show a clear screen.
  if (!window.mediDeskBridge) {
    return <BrowserGuardScreen />;
  }

  const [initState, setInitState] = useState<InitializationStateData | null>(null);
  const [status, setStatus] = useState<SystemStatusData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [currentUser, setCurrentUser] = useState<SessionUser | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(() => {
    return sessionStorage.getItem('medidesk_session_token') || localStorage.getItem('medidesk_session_token');
  });
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [patientForBooking, setPatientForBooking] = useState<Patient | null>(null);
  const [consultationPatientId, setConsultationPatientId] = useState<string>('');
  const [consultationAppointmentId, setConsultationAppointmentId] = useState<string>('');

  const fetchSystemState = useCallback(async () => {
    setLoading(true);
    try {
      if (window.mediDeskBridge) {
        const [initRes, statusRes] = await Promise.all([
          window.mediDeskBridge.getInitializationState(),
          window.mediDeskBridge.getSystemStatus()
        ]);

        if (initRes.success && initRes.data) {
          setInitState(initRes.data);
        }
        if (statusRes.success && statusRes.data) {
          setStatus(statusRes.data);
        }

        // Restore active session if sessionToken exists
        if (sessionToken) {
          const sessionRes = await window.mediDeskBridge.getCurrentUser(sessionToken);
          if (sessionRes.success && sessionRes.data) {
            setCurrentUser(sessionRes.data);
          } else {
            // Invalid/expired session
            sessionStorage.removeItem('medidesk_session_token');
            localStorage.removeItem('medidesk_session_token');
            setSessionToken(null);
            setCurrentUser(null);
          }
        }
      }
    } catch (err) {
      console.error('Failed to load system state:', err);
    } finally {
      setLoading(false);
    }
  }, [sessionToken]);

  useEffect(() => {
    fetchSystemState();
  }, [fetchSystemState]);

  const handleLoginSuccess = (user: SessionUser, token: string) => {
    setCurrentUser(user);
    setSessionToken(token);
    sessionStorage.setItem('medidesk_session_token', token);
    localStorage.setItem('medidesk_session_token', token);
    fetchSystemState();
  };

  const handleLogout = async () => {
    if (sessionToken && window.mediDeskBridge) {
      try {
        await window.mediDeskBridge.logout(sessionToken);
      } catch (_err) {
        // ignore
      }
    }
    sessionStorage.removeItem('medidesk_session_token');
    localStorage.removeItem('medidesk_session_token');
    setSessionToken(null);
    setCurrentUser(null);
    setActiveTab('dashboard');
  };

  const handleSetupComplete = () => {
    fetchSystemState();
  };

  const handleBookAppointmentForPatient = (patient: Patient) => {
    setPatientForBooking(patient);
    setActiveTab('appointments');
  };

  const _handleStartConsultation = (patientId: string, appointmentId?: string) => {
    setConsultationPatientId(patientId);
    setConsultationAppointmentId(appointmentId || '');
    setActiveTab('consultation');
  };

  // 1. Loading State
  if (loading && !initState && !status) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-slate-400">Loading MediDesk secure environment...</p>
        </div>
      </div>
    );
  }

  // 2. First-Run Setup Wizard (if database has not been initialized)
  if (initState && !initState.isInitialized) {
    return <SetupWizard onCompleted={handleSetupComplete} />;
  }

  // 3. Login Screen (if initialized but unauthenticated)
  if (!currentUser || !sessionToken) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  }

  // 4. Authenticated Application Shell
  return (
    <AppLayout
      currentUser={currentUser}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      onLogout={handleLogout}
    >
      {activeTab === 'dashboard' && (
        <DashboardView
          status={status}
          loading={loading}
          onRefresh={fetchSystemState}
          currentUser={currentUser}
          onNavigateTab={(tab) => setActiveTab(tab as NavTab)}
        />
      )}

      {activeTab === 'patients' && (
        <PatientManagementView
          currentUser={currentUser}
          onBookAppointment={handleBookAppointmentForPatient}
          onNavigate={(tab) => setActiveTab(tab as NavTab)}
        />
      )}

      {activeTab === 'doctors' && (
        <DoctorManagementView
          currentUser={currentUser}
          onNavigate={(tab) => setActiveTab(tab as NavTab)}
        />
      )}

      {activeTab === 'appointments' && (
        <AppointmentManagementView
          currentUser={currentUser}
          initialPatientForBooking={patientForBooking}
          onClearInitialPatient={() => setPatientForBooking(null)}
        />
      )}

      {activeTab === 'consultation' && (
        <ClinicalConsultationView
          currentUser={currentUser}
          patientId={consultationPatientId}
          appointmentId={consultationAppointmentId}
        />
      )}

      {activeTab === 'pos' && (
        <PharmacyPOSView currentUser={currentUser} />
      )}

      {activeTab === 'medicines' && (
        <MedicineMasterView
          currentUser={currentUser}
          onNavigate={(tab) => setActiveTab(tab as NavTab)}
        />
      )}

      {activeTab === 'inventory' && (
        <InventoryStockView currentUser={currentUser} />
      )}

      {activeTab === 'purchases' && (
        <PurchaseManagementView currentUser={currentUser} />
      )}

      {activeTab === 'import' && (
        <BulkDataImportView
          currentUser={currentUser}
          onNavigate={(tab) => setActiveTab(tab as NavTab)}
        />
      )}

      {activeTab === 'settings' && (
        <SettingsManagementView currentUser={currentUser} sessionToken={sessionToken} userRole={currentUser.roles[0]} />
      )}

      {activeTab === 'users' && (
        <UserManagementView currentUser={currentUser} sessionToken={sessionToken} />
      )}

      {activeTab === 'audit' && <AuditLogView />}

      {activeTab === 'rbac' && <RbacExplorerView />}
    </AppLayout>
  );
};

export default App;
