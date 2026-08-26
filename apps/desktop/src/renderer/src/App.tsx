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
import { SystemStatusData, InitializationStateData, Patient } from '@medidesk/shared';
import { SessionUser } from '@medidesk/domain';

export const App: React.FC = () => {
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
        />
      )}

      {activeTab === 'doctors' && (
        <DoctorManagementView currentUser={currentUser} />
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
        <MedicineMasterView currentUser={currentUser} />
      )}

      {activeTab === 'inventory' && (
        <InventoryStockView currentUser={currentUser} />
      )}

      {activeTab === 'purchases' && (
        <PurchaseManagementView currentUser={currentUser} />
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
