import React, { useState, useEffect, useCallback } from 'react';
import { Card, Button, Badge } from '@medidesk/ui';
import { SessionUser } from '@medidesk/domain';
import {
  ShieldCheck,
  HardDrive,
  Cloud,
  Printer,
  Activity,
  Download,
  CheckCircle,
  AlertTriangle,
  Key,
  RefreshCw,
  FileText,
  Clock,
  RotateCcw,
  Network,
  Bell,
  Send,
  Lock
} from 'lucide-react';
import { LanManagementView } from './LanManagementView';

interface SettingsManagementViewProps {
  currentUser?: SessionUser;
  sessionToken: string;
  userRole: string;
}

export const SettingsManagementView: React.FC<SettingsManagementViewProps> = ({ sessionToken, userRole }) => {
  const [activeTab, setActiveTab] = useState<'license' | 'backup' | 'printer' | 'alerts' | 'diagnostics' | 'lan'>('license');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Licensing state
  const [licenseInfo, setLicenseInfo] = useState<any>(null);
  const [licenseKeyInput, setLicenseKeyInput] = useState('');
  const [showKeyModal, setShowKeyModal] = useState(false);

  // Hybrid Backup state
  const [backups, setBackups] = useState<any[]>([]);
  const [backupSettings, setBackupSettings] = useState<any>({
    backupMode: 'HYBRID',
    backupSchedule: 'DAILY',
    backupTime: '21:00',
    localRetentionDays: 30,
    cloudRetentionDays: 90,
    googleDriveFolder: 'MediDesk_Backups',
    googleDriveConnected: false,
    autoRetryCloud: true
  });
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRetryingCloud, setIsRetryingCloud] = useState(false);
  const [selectedBackupForRestore, setSelectedBackupForRestore] = useState<any>(null);
  const [restoreConfirmText, setRestoreConfirmText] = useState('');
  const [restorePassphrase, setRestorePassphrase] = useState('');
  const [showPassphraseModal, setShowPassphraseModal] = useState(false);
  const [backupPassphrase, setBackupPassphrase] = useState('');
  const [googleDriveAuthCode, setGoogleDriveAuthCode] = useState('');
  const [showGDriveModal, setShowGDriveModal] = useState(false);

  // Printer & Document Delivery state
  const [printerConfig, setPrinterConfig] = useState<any>({
    prescriptionPrinterName: 'Default Printer',
    prescriptionPageSize: 'A4',
    receiptPrinterName: 'POS Thermal Printer',
    receiptPageSize: '80mm',
    silentPrinting: false
  });

  // Alert Policies state
  const [alertConfigs, setAlertConfigs] = useState<any>({
    lowStockThreshold: 10,
    nearExpiryDays: 60,
    notifyOwner: true,
    notifyStaff: true,
    notifyDoctor: false
  });

  // Diagnostics state
  const [diagnosticsData, setDiagnosticsData] = useState<any>(null);

  const bridge = (window as any).mediDeskBridge;

  const loadSettingsData = useCallback(async () => {
    if (!bridge) return;
    try {
      if (activeTab === 'license') {
        const res = await bridge.getLicenseStatus(sessionToken);
        if (res.success) setLicenseInfo(res.data);
      } else if (activeTab === 'backup') {
        const [logsRes, setRes] = await Promise.all([
          bridge.listBackups(sessionToken),
          bridge.getBackupSettings ? bridge.getBackupSettings(sessionToken) : { success: false }
        ]);
        if (logsRes.success) setBackups(logsRes.data);
        if (setRes.success && setRes.data) setBackupSettings(setRes.data);
      } else if (activeTab === 'printer') {
        const res = await bridge.getPrinterConfig(sessionToken);
        if (res.success && res.data) setPrinterConfig(res.data);
      } else if (activeTab === 'alerts') {
        if (bridge.getAlertConfigurations) {
          const res = await bridge.getAlertConfigurations();
          if (res.success && res.data) {
            const lowStock = res.data.find((c: any) => c.alertType === 'LOW_STOCK');
            const nearExp = res.data.find((c: any) => c.alertType === 'NEAR_EXPIRY');
            if (lowStock) setAlertConfigs((prev: any) => ({ ...prev, lowStockThreshold: lowStock.thresholdValueInteger || 10 }));
            if (nearExp) setAlertConfigs((prev: any) => ({ ...prev, nearExpiryDays: nearExp.thresholdValueInteger || 60 }));
          }
        }
      } else if (activeTab === 'diagnostics') {
        const res = await bridge.runDiagnostics(sessionToken);
        if (res.success) setDiagnosticsData(res.data);
      }
    } catch {
      // Ignored
    }
  }, [activeTab, bridge, sessionToken]);

  useEffect(() => {
    loadSettingsData();
  }, [loadSettingsData]);

  const handleCreateBackup = async (passphrase?: string) => {
    if (!bridge) return;
    setIsBackingUp(true);
    setMessage(null);
    try {
      const res = await bridge.createBackup({
        mode: backupSettings.backupMode,
        passphrase: passphrase || undefined
      }, sessionToken);

      if (res.success) {
        setMessage({
          type: 'success',
          text: `Backup complete [${res.data.overallStatus || 'SUCCESS'}]: ${res.data.filename} (${(res.data.sizeBytes / 1024).toFixed(1)} KB). Local: ${res.data.localStatus || 'SUCCESS'}, Cloud: ${res.data.cloudStatus || 'NONE'}`
        });
        setShowPassphraseModal(false);
        setBackupPassphrase('');
        loadSettingsData();
      } else {
        setMessage({ type: 'error', text: res.error?.message || 'Backup failed' });
      }
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message || 'Backup error' });
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleRetryCloud = async () => {
    if (!bridge) return;
    setIsRetryingCloud(true);
    setMessage(null);
    try {
      const res = await bridge.retryCloudBackups(sessionToken);
      if (res.success) {
        setMessage({
          type: 'success',
          text: `Cloud retry finished: ${res.data.succeeded} uploaded, ${res.data.failed} failed of ${res.data.attempted} pending.`
        });
        loadSettingsData();
      } else {
        setMessage({ type: 'error', text: res.error?.message || 'Cloud retry failed' });
      }
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message || 'Retry error' });
    } finally {
      setIsRetryingCloud(false);
    }
  };

  const handleSaveBackupSettings = async (updated: Partial<any>) => {
    if (!bridge) return;
    const newSettings = { ...backupSettings, ...updated };
    setBackupSettings(newSettings);
    try {
      const res = await bridge.updateBackupSettings(newSettings, sessionToken);
      if (res.success) {
        setMessage({ type: 'success', text: 'Backup preferences updated.' });
      }
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message });
    }
  };

  const handleConnectGDrive = async () => {
    if (!bridge || !googleDriveAuthCode.trim()) return;
    try {
      const res = await bridge.connectGoogleDrive(googleDriveAuthCode.trim(), sessionToken);
      if (res.success) {
        setMessage({ type: 'success', text: `Google Drive connected successfully: ${res.data.email}` });
        setShowGDriveModal(false);
        setGoogleDriveAuthCode('');
        loadSettingsData();
      } else {
        setMessage({ type: 'error', text: res.error?.message || 'Failed to connect Google Drive.' });
      }
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message });
    }
  };

  const handleDisconnectGDrive = async () => {
    if (!bridge) return;
    try {
      const res = await bridge.disconnectGoogleDrive(sessionToken);
      if (res.success) {
        setMessage({ type: 'success', text: 'Google Drive disconnected.' });
        loadSettingsData();
      }
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message });
    }
  };

  const handleVerifyBackup = async (filePath: string) => {
    if (!bridge) return;
    try {
      const res = await bridge.verifyBackup(filePath, undefined, sessionToken);
      if (res.success && res.data.isValid) {
        setMessage({ type: 'success', text: 'Backup integrity verified (SHA-256 Checksum & AES-256-GCM header valid)' });
      } else {
        setMessage({ type: 'error', text: 'Backup verification failed or file corrupted.' });
      }
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message });
    }
  };

  const handleRestoreBackup = async () => {
    if (!bridge || !selectedBackupForRestore) return;
    if (restoreConfirmText !== 'RESTORE') {
      setMessage({ type: 'error', text: 'Please type RESTORE to confirm.' });
      return;
    }

    try {
      const res = await bridge.restoreBackup({
        source: selectedBackupForRestore.storageTarget === 'GOOGLE_DRIVE' ? 'GOOGLE_DRIVE' : 'LOCAL',
        backupIdOrPath: selectedBackupForRestore.filePath || selectedBackupForRestore.remoteFileId,
        passphrase: restorePassphrase || undefined
      }, sessionToken);

      if (res.success) {
        setMessage({ type: 'success', text: 'Database restored successfully! A safety backup was created automatically.' });
        setSelectedBackupForRestore(null);
        setRestoreConfirmText('');
        setRestorePassphrase('');
        loadSettingsData();
      } else {
        setMessage({ type: 'error', text: res.error?.message || 'Restore failed' });
      }
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message });
    }
  };

  const handleActivateLicense = async () => {
    if (!bridge || !licenseKeyInput.trim()) return;
    try {
      const res = await bridge.activateLicense(licenseKeyInput.trim(), sessionToken);
      if (res.success) {
        setMessage({ type: 'success', text: 'Commercial license activated successfully!' });
        setShowKeyModal(false);
        setLicenseKeyInput('');
        loadSettingsData();
      } else {
        setMessage({ type: 'error', text: res.error?.message || 'Activation failed: Invalid signature or expired key' });
      }
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message });
    }
  };

  const handleSavePrinterConfig = async () => {
    if (!bridge) return;
    try {
      const res = await bridge.savePrinterConfig(printerConfig, sessionToken);
      if (res.success) {
        setMessage({ type: 'success', text: 'Printer configurations saved.' });
      } else {
        setMessage({ type: 'error', text: res.error?.message || 'Could not save printer settings' });
      }
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message });
    }
  };

  const handleTestPrint = async (type: 'STANDARD' | 'THERMAL_POS') => {
    if (!bridge) return;
    try {
      const pName = type === 'STANDARD' ? printerConfig.prescriptionPrinterName : printerConfig.receiptPrinterName;
      const res = await bridge.testPrinter(pName, type, sessionToken);
      if (res.success) {
        setMessage({ type: 'success', text: `Test print job sent (${res.data.jobId})` });
      } else {
        setMessage({ type: 'error', text: 'Print test failed' });
      }
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message });
    }
  };

  const handleSaveAlertPolicies = async () => {
    if (!bridge?.configureAlertPolicy) return;
    try {
      const roles = ['OWNER'];
      if (alertConfigs.notifyStaff) roles.push('STAFF');
      if (alertConfigs.notifyDoctor) roles.push('DOCTOR');

      await bridge.configureAlertPolicy('LOW_STOCK', {
        isEnabled: true,
        thresholdValueInteger: alertConfigs.lowStockThreshold,
        warningLevel: 'WARNING',
        targetRoles: roles
      });

      await bridge.configureAlertPolicy('NEAR_EXPIRY', {
        isEnabled: true,
        thresholdValueInteger: alertConfigs.nearExpiryDays,
        warningLevel: 'WARNING',
        targetRoles: roles
      });

      setMessage({ type: 'success', text: 'Smart Alert & Stock Control policies saved successfully.' });
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message || 'Could not save alert policies' });
    }
  };

  // Latest backup stats for Owner Dashboard
  const latestBackup = backups[0];
  const pendingCloudCount = backups.filter(b => b.cloudStatus === 'PENDING' || b.cloudStatus === 'FAILED').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">System & Clinic Settings</h1>
          <p className="text-sm text-slate-500">Manage offline licensing, hybrid cloud backups, printing hardware, alert rules, and diagnostic health.</p>
        </div>
        <div className="flex gap-2">
          <Badge variant={userRole === 'OWNER' ? 'success' : 'default'}>Role: {userRole}</Badge>
        </div>
      </div>

      {message && (
        <div className={`p-4 rounded-lg border text-sm font-medium ${message.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
          {message.text}
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-4 flex-wrap">
        <button
          className={`pb-3 font-semibold text-sm flex items-center gap-2 border-b-2 transition-colors ${activeTab === 'license' ? 'border-sky-600 text-sky-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          onClick={() => setActiveTab('license')}
        >
          <Key className="w-4 h-4" /> Licensing & Trial
        </button>
        <button
          className={`pb-3 font-semibold text-sm flex items-center gap-2 border-b-2 transition-colors ${activeTab === 'backup' ? 'border-sky-600 text-sky-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          onClick={() => setActiveTab('backup')}
        >
          <HardDrive className="w-4 h-4" /> Hybrid Backup & Recovery
        </button>
        <button
          className={`pb-3 font-semibold text-sm flex items-center gap-2 border-b-2 transition-colors ${activeTab === 'printer' ? 'border-sky-600 text-sky-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          onClick={() => setActiveTab('printer')}
        >
          <Printer className="w-4 h-4" /> Printers & Documents
        </button>
        <button
          className={`pb-3 font-semibold text-sm flex items-center gap-2 border-b-2 transition-colors ${activeTab === 'alerts' ? 'border-sky-600 text-sky-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          onClick={() => setActiveTab('alerts')}
        >
          <Bell className="w-4 h-4" /> Alerts & Stock Rules
        </button>
        <button
          className={`pb-3 font-semibold text-sm flex items-center gap-2 border-b-2 transition-colors ${activeTab === 'diagnostics' ? 'border-sky-600 text-sky-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          onClick={() => setActiveTab('diagnostics')}
        >
          <Activity className="w-4 h-4" /> Diagnostics & Health
        </button>
        <button
          className={`pb-3 font-semibold text-sm flex items-center gap-2 border-b-2 transition-colors ${activeTab === 'lan' ? 'border-sky-600 text-sky-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          onClick={() => setActiveTab('lan')}
        >
          <Network className="w-4 h-4" /> LAN & Multi-PC
        </button>
      </div>

      {/* Tab 1: Licensing */}
      {activeTab === 'license' && (
        <div className="space-y-6">
          <Card className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">License Status & Entitlements</h3>
                <p className="text-sm text-slate-500">MediDesk operates 100% offline with asymmetric cryptographic license validation.</p>
              </div>
              <Button onClick={() => setShowKeyModal(true)} variant="primary" className="flex items-center gap-2">
                <Key className="w-4 h-4" /> Enter License Key
              </Button>
            </div>

            {licenseInfo ? (
              <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                  <span className="text-xs text-slate-500 block uppercase font-semibold">Tier</span>
                  <span className="text-xl font-bold text-slate-800 dark:text-slate-100">{licenseInfo.tier || '60-Day Trial'}</span>
                </div>
                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                  <span className="text-xs text-slate-500 block uppercase font-semibold">Status</span>
                  <span className="text-xl font-bold text-emerald-600">{licenseInfo.status || 'ACTIVE'}</span>
                </div>
                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                  <span className="text-xs text-slate-500 block uppercase font-semibold">Days Remaining</span>
                  <span className="text-xl font-bold text-sky-600">{licenseInfo.daysRemaining ?? '60'} Days</span>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-slate-400">Loading license status...</div>
            )}
          </Card>
        </div>
      )}

      {/* Tab 2: Hybrid Backup & Recovery */}
      {activeTab === 'backup' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="p-6 space-y-3">
              <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-100">
                <HardDrive className="w-5 h-5 text-sky-600" /> Local Encrypted Snapshot
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Atomic SQLite snapshots encrypted with AES-256-GCM + scrypt. Local snapshots succeed 100% offline.
              </p>
              <div className="pt-2">
                <Button variant="primary" disabled={isBackingUp} onClick={() => setShowPassphraseModal(true)} className="w-full text-xs">
                  {isBackingUp ? 'Creating Snapshot...' : 'Create Backup Now'}
                </Button>
              </div>
            </Card>

            <Card className="p-6 space-y-3">
              <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-100">
                <Clock className="w-5 h-5 text-emerald-600" /> Automated Schedule
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Configured: <strong className="text-slate-700 dark:text-slate-200">{backupSettings.backupSchedule}</strong> at <strong className="text-slate-700 dark:text-slate-200">{backupSettings.backupTime}</strong>. Automatic sleep/wake catch-up active.
              </p>
              <div className="flex gap-2 pt-2">
                <select
                  className="w-1/2 p-1.5 border border-slate-200 dark:border-slate-700 rounded text-xs bg-white dark:bg-slate-800"
                  value={backupSettings.backupSchedule}
                  onChange={(e) => handleSaveBackupSettings({ backupSchedule: e.target.value })}
                >
                  <option value="DAILY">Daily</option>
                  <option value="WEEKLY">Weekly</option>
                  <option value="MONTHLY">Monthly</option>
                </select>
                <input
                  type="time"
                  className="w-1/2 p-1.5 border border-slate-200 dark:border-slate-700 rounded text-xs bg-white dark:bg-slate-800"
                  value={backupSettings.backupTime}
                  onChange={(e) => handleSaveBackupSettings({ backupTime: e.target.value })}
                />
              </div>
            </Card>

            <Card className="p-6 space-y-3">
              <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-100">
                <Cloud className="w-5 h-5 text-indigo-600" /> Off-Site Google Drive
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                {backupSettings.googleDriveConnected ? 'Connected & syncing opportunistically.' : 'Not connected (local-only mode).'}
              </p>
              <div className="pt-2">
                {backupSettings.googleDriveConnected ? (
                  <Button size="sm" variant="danger" onClick={handleDisconnectGDrive} className="w-full text-xs">
                    Disconnect Google Drive
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => setShowGDriveModal(true)} className="w-full text-xs">
                    Connect Google Drive
                  </Button>
                )}
              </div>
            </Card>
          </div>

          {/* Backup Snapshot History Table */}
          <Card className="p-6 space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h4 className="font-bold text-slate-800 dark:text-slate-100">Backup Snapshots & Audit History</h4>
                <p className="text-xs text-slate-500">Chronological ledger of encrypted snapshots. Restores automatically create a PRE_RESTORE_SAFETY backup.</p>
              </div>
              <Button size="sm" variant="outline" onClick={loadSettingsData} className="flex items-center gap-1">
                <RefreshCw className="w-3.5 h-3.5" /> Refresh
              </Button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-600 font-semibold">
                    <th className="p-2.5">Snapshot Filename</th>
                    <th className="p-2.5">Mode</th>
                    <th className="p-2.5">Local Status</th>
                    <th className="p-2.5">Cloud Sync</th>
                    <th className="p-2.5">Size</th>
                    <th className="p-2.5">Date & Time</th>
                    <th className="p-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {backups.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-6 text-center text-slate-400 italic">No backup snapshots recorded yet.</td>
                    </tr>
                  ) : (
                    backups.map((b) => (
                      <tr key={b.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                        <td className="p-2.5 font-medium text-slate-800 dark:text-slate-200 flex items-center gap-2">
                          <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                          <span className="truncate max-w-[200px]" title={b.filename}>{b.filename}</span>
                        </td>
                        <td className="p-2.5"><Badge variant="default">{b.backupMode || b.storageTarget}</Badge></td>
                        <td className="p-2.5">
                          <Badge variant={b.localStatus === 'SUCCESS' ? 'success' : 'danger'}>
                            {b.localStatus || 'SUCCESS'}
                          </Badge>
                        </td>
                        <td className="p-2.5">
                          <Badge
                            variant={
                              b.cloudStatus === 'SUCCESS'
                                ? 'success'
                                : (b.cloudStatus === 'PENDING' ? 'warning' : (b.cloudStatus === 'NONE' ? 'default' : 'danger'))
                            }
                          >
                            {b.cloudStatus || 'NONE'}
                          </Badge>
                        </td>
                        <td className="p-2.5 text-slate-600 dark:text-slate-400">{(b.sizeBytes / 1024).toFixed(1)} KB</td>
                        <td className="p-2.5 text-slate-500">{new Date(b.createdAt).toLocaleString()}</td>
                        <td className="p-2.5 text-right space-x-1">
                          <Button size="sm" variant="outline" onClick={() => handleVerifyBackup(b.filePath)} className="text-[11px] h-7 px-2">
                            Verify
                          </Button>
                          {userRole === 'OWNER' && (
                            <Button
                              size="sm"
                              variant="danger"
                              onClick={() => {
                                setSelectedBackupForRestore(b);
                                setRestoreConfirmText('');
                                setRestorePassphrase('');
                              }}
                              className="text-[11px] h-7 px-2"
                            >
                              Restore
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* Tab 3: Printers & Documents */}
      {activeTab === 'printer' && (
        <div className="space-y-6">
          <Card className="p-6 space-y-6">
            <div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Workstation Printers & Physical Layouts</h3>
              <p className="text-sm text-slate-500">Configure local physical printers for A4/A5 clinical prescriptions and POS thermal receipts.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 space-y-4">
                <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-100">
                  <Printer className="w-5 h-5 text-sky-600" /> Clinical Prescriptions (Laser / Inkjet)
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Target Printer</label>
                  <input
                    className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded text-sm bg-white dark:bg-slate-800"
                    value={printerConfig.prescriptionPrinterName || ''}
                    onChange={(e) => setPrinterConfig({ ...printerConfig, prescriptionPrinterName: e.target.value })}
                    placeholder="System Printer Name"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Page Format</label>
                  <select
                    className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded text-sm bg-white dark:bg-slate-800"
                    value={printerConfig.prescriptionPageSize}
                    onChange={(e) => setPrinterConfig({ ...printerConfig, prescriptionPageSize: e.target.value })}
                  >
                    <option value="A4">A4 Standard Sheet (Full Page)</option>
                    <option value="A5">A5 Half Sheet (Compact Pad)</option>
                  </select>
                </div>
                <Button size="sm" variant="outline" onClick={() => handleTestPrint('STANDARD')}>
                  Send Test Page
                </Button>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 space-y-4">
                <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-100">
                  <Printer className="w-5 h-5 text-emerald-600" /> POS Billing Receipts (Thermal ESC/POS)
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Thermal Printer</label>
                  <input
                    className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded text-sm bg-white dark:bg-slate-800"
                    value={printerConfig.receiptPrinterName || ''}
                    onChange={(e) => setPrinterConfig({ ...printerConfig, receiptPrinterName: e.target.value })}
                    placeholder="POS-80 Thermal Printer"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Paper Roll Width</label>
                  <select
                    className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded text-sm bg-white dark:bg-slate-800"
                    value={printerConfig.receiptPageSize}
                    onChange={(e) => setPrinterConfig({ ...printerConfig, receiptPageSize: e.target.value })}
                  >
                    <option value="80mm">80mm (Standard POS Receipt)</option>
                    <option value="58mm">58mm (Compact Mobile Receipt)</option>
                  </select>
                </div>
                <Button size="sm" variant="outline" onClick={() => handleTestPrint('THERMAL_POS')}>
                  Send Test Receipt
                </Button>
              </div>
            </div>

            <div className="flex justify-end">
              <Button variant="primary" onClick={handleSavePrinterConfig}>
                Save Printer Preferences
              </Button>
            </div>
          </Card>

          {/* Digital Document Dispatch & Gateway Notice */}
          <Card className="p-6 space-y-4">
            <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-100">
              <Send className="w-5 h-5 text-indigo-600" /> Digital Document Delivery & Privacy Governance
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Prescriptions and invoices can be printed offline or exported locally as PDFs. Digital messaging channels require explicit recorded patient consent.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm text-slate-800 dark:text-slate-200">WhatsApp Messaging Gateway</span>
                  <Badge variant="warning">Mock / Local Gateway Mode</Badge>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Requires external Twilio / WhatsApp Business API configuration for live cellular delivery. In standalone mode, documents are safely queued in the local audit log.
                </p>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm text-slate-800 dark:text-slate-200">Email Dispatch Gateway</span>
                  <Badge variant="warning">Mock / Local Gateway Mode</Badge>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Requires external SMTP server credentials for live internet delivery. Automatic background broadcast without explicit user consent is permanently blocked.
                </p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Tab 4: Alerts & Stock Rules */}
      {activeTab === 'alerts' && (
        <div className="space-y-6">
          <Card className="p-6 space-y-6">
            <div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Owner Alert Policies & Stock Controls</h3>
              <p className="text-sm text-slate-500">Configure thresholds for inventory warnings and review non-bypassable patient safety controls.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Section A: Configurable Operational Warnings */}
              <div className="p-5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 space-y-4">
                <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200 flex items-center gap-2">
                  <Bell className="w-4 h-4 text-amber-500" /> A. Configurable Operational Warnings
                </h4>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Low Stock Threshold (Base Units)
                  </label>
                  <input
                    type="number"
                    min="1"
                    className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded text-sm bg-white dark:bg-slate-800"
                    value={alertConfigs.lowStockThreshold}
                    onChange={(e) => setAlertConfigs({ ...alertConfigs, lowStockThreshold: parseInt(e.target.value) || 10 })}
                  />
                  <span className="text-[11px] text-slate-400">Triggers an alert when available base unit inventory falls below this number.</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Near-Expiry Warning Window (Days)
                  </label>
                  <input
                    type="number"
                    min="1"
                    className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded text-sm bg-white dark:bg-slate-800"
                    value={alertConfigs.nearExpiryDays}
                    onChange={(e) => setAlertConfigs({ ...alertConfigs, nearExpiryDays: parseInt(e.target.value) || 60 })}
                  />
                  <span className="text-[11px] text-slate-400">Notifies when medicine batches are within this many days of expiry.</span>
                </div>

                <div className="pt-2 space-y-2">
                  <span className="block text-xs font-semibold text-slate-600 dark:text-slate-300">Recipient Roles:</span>
                  <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={alertConfigs.notifyStaff}
                      onChange={(e) => setAlertConfigs({ ...alertConfigs, notifyStaff: e.target.checked })}
                    />
                    Staff Members (Pharmacy & Reception)
                  </label>
                  <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={alertConfigs.notifyDoctor}
                      onChange={(e) => setAlertConfigs({ ...alertConfigs, notifyDoctor: e.target.checked })}
                    />
                    Doctors (Clinical OPD)
                  </label>
                </div>
              </div>

              {/* Section B: Inviolable Domain Safety Invariants */}
              <div className="p-5 bg-red-50/50 dark:bg-red-950/20 rounded-xl border border-red-200 dark:border-red-900 space-y-4">
                <h4 className="font-bold text-sm text-red-900 dark:text-red-200 flex items-center gap-2">
                  <Lock className="w-4 h-4 text-red-600" /> B. Non-Bypassable Safety Invariants
                </h4>
                <p className="text-xs text-red-700 dark:text-red-300 leading-relaxed">
                  These domain safety controls protect clinical and legal integrity. They are permanently locked and cannot be disabled by any user.
                </p>

                <div className="space-y-3 pt-1">
                  <div className="p-3 bg-white dark:bg-slate-800 rounded-lg border border-red-100 dark:border-red-950 flex items-start justify-between">
                    <div>
                      <div className="font-semibold text-xs text-slate-800 dark:text-slate-200">Block Expired Medicine Dispensing</div>
                      <div className="text-[11px] text-slate-500">POS billing automatically rejects expired batches at checkout.</div>
                    </div>
                    <Badge variant="danger">Locked</Badge>
                  </div>

                  <div className="p-3 bg-white dark:bg-slate-800 rounded-lg border border-red-100 dark:border-red-950 flex items-start justify-between">
                    <div>
                      <div className="font-semibold text-xs text-slate-800 dark:text-slate-200">Block Negative Stock Sales</div>
                      <div className="text-[11px] text-slate-500">Serialized transaction write mutex prevents selling unallocated stock.</div>
                    </div>
                    <Badge variant="danger">Locked</Badge>
                  </div>

                  <div className="p-3 bg-white dark:bg-slate-800 rounded-lg border border-red-100 dark:border-red-950 flex items-start justify-between">
                    <div>
                      <div className="font-semibold text-xs text-slate-800 dark:text-slate-200">Immutable Clinical & Financial Ledger</div>
                      <div className="text-[11px] text-slate-500">Signed prescriptions and finalized sales are append-only.</div>
                    </div>
                    <Badge variant="danger">Locked</Badge>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <Button variant="primary" onClick={handleSaveAlertPolicies}>
                Save Alert Policies
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Tab 5: Diagnostics */}
      {activeTab === 'diagnostics' && (
        <Card className="p-6 space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">System Diagnostics & Health Integrity</h3>
              <p className="text-sm text-slate-500">Monitor local application runtime, database health, and generate support bundles.</p>
            </div>
            <Button variant="outline" onClick={loadSettingsData} className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4" /> Refresh
            </Button>
          </div>

          {diagnosticsData && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                <div className="text-xs text-slate-500 uppercase font-semibold">SQLite Health</div>
                <div className="text-lg font-bold text-emerald-600 mt-1 flex items-center gap-1">
                  <CheckCircle className="w-4 h-4" /> {diagnosticsData.sqliteIntegrity}
                </div>
              </div>
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                <div className="text-xs text-slate-500 uppercase font-semibold">Platform & OS</div>
                <div className="text-lg font-bold text-slate-800 dark:text-slate-100 mt-1">{diagnosticsData.platform} ({diagnosticsData.arch})</div>
              </div>
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                <div className="text-xs text-slate-500 uppercase font-semibold">Node Runtime</div>
                <div className="text-lg font-bold text-slate-800 dark:text-slate-100 mt-1">{diagnosticsData.nodeVersion}</div>
              </div>
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                <div className="text-xs text-slate-500 uppercase font-semibold">Heap Memory</div>
                <div className="text-lg font-bold text-slate-800 dark:text-slate-100 mt-1">
                  {(diagnosticsData.memoryUsage.heapUsed / (1024 * 1024)).toFixed(1)} MB
                </div>
              </div>
            </div>
          )}

          <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700 flex justify-between items-center">
            <div>
              <div className="font-semibold text-slate-800 dark:text-slate-100">Support Diagnostic Bundle</div>
              <div className="text-xs text-slate-500">Export scrubbed technical logs and system diagnostics without PII.</div>
            </div>
            <Button
              variant="outline"
              onClick={async () => {
                const res = await bridge?.exportSupportBundle(sessionToken);
                if (res?.success) setMessage({ type: 'success', text: `Diagnostic bundle generated: ${res.data.bundleFilename}` });
              }}
            >
              Export Support Bundle
            </Button>
          </div>
        </Card>
      )}

      {/* Tab 6: LAN & Multi-Computer Architecture */}
      {activeTab === 'lan' && (
        <LanManagementView sessionToken={sessionToken} userRole={userRole} />
      )}

      {/* Modal: Passphrase Generator for Backup */}
      {showPassphraseModal && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-200 dark:border-slate-800">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Create Encrypted Backup Snapshot</h3>
            <p className="text-xs text-slate-500">
              Snapshots are secured using AES-256-GCM encryption. You can optionally enter a custom passphrase or use the default system key.
            </p>
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Optional Passphrase</label>
              <input
                type="password"
                className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded text-sm bg-white dark:bg-slate-800"
                placeholder="Leave blank for system master key"
                value={backupPassphrase}
                onChange={(e) => setBackupPassphrase(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowPassphraseModal(false)}>Cancel</Button>
              <Button variant="primary" onClick={() => handleCreateBackup(backupPassphrase)}>
                Generate Encrypted Snapshot
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Google Drive Authorization Code */}
      {showGDriveModal && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-200 dark:border-slate-800">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Connect Google Drive</h3>
            <p className="text-xs text-slate-500">
              Paste the OAuth authorization code from your Google Cloud consent screen to link off-site storage.
            </p>
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Authorization Code</label>
              <input
                className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded text-sm font-mono bg-white dark:bg-slate-800"
                placeholder="4/0AWgav..."
                value={googleDriveAuthCode}
                onChange={(e) => setGoogleDriveAuthCode(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowGDriveModal(false)}>Cancel</Button>
              <Button variant="primary" disabled={!googleDriveAuthCode.trim()} onClick={handleConnectGDrive}>
                Authenticate & Connect
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: License Activation */}
      {showKeyModal && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl max-w-lg w-full p-6 space-y-4 shadow-xl border border-slate-200 dark:border-slate-800">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Activate Commercial License Token</h3>
            <p className="text-sm text-slate-500">
              Paste the cryptographic digital license token provided for your clinic workstation.
            </p>
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">License Token</label>
              <textarea
                className="w-full h-32 p-3 font-mono text-xs border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white dark:bg-slate-800"
                placeholder="eyJhbGciOiJSU0EyNTYiLCJ0eXAiOiJKV1QifQ....signature"
                value={licenseKeyInput}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setLicenseKeyInput(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowKeyModal(false)}>Cancel</Button>
              <Button variant="primary" onClick={handleActivateLicense}>Verify & Activate</Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Restore Confirmation */}
      {selectedBackupForRestore && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl border border-red-200 dark:border-red-900">
            <div className="flex items-center gap-3 text-red-600">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="text-lg font-bold">Confirm Database Restore</h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Restoring snapshot <strong>{selectedBackupForRestore.filename}</strong> will replace the current live database. A safety snapshot (<code>PRE_RESTORE_SAFETY</code>) will be created automatically before restoration.
            </p>
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Decryption Passphrase (if custom key used)</label>
              <input
                type="password"
                className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded text-sm bg-white dark:bg-slate-800 mb-3"
                placeholder="Leave blank if default system key"
                value={restorePassphrase}
                onChange={(e) => setRestorePassphrase(e.target.value)}
              />
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Type RESTORE to proceed:</label>
              <input
                className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded text-sm bg-white dark:bg-slate-800"
                value={restoreConfirmText}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRestoreConfirmText(e.target.value)}
                placeholder="RESTORE"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setSelectedBackupForRestore(null)}>Cancel</Button>
              <Button variant="danger" disabled={restoreConfirmText !== 'RESTORE'} onClick={handleRestoreBackup}>
                Proceed with Restore
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
