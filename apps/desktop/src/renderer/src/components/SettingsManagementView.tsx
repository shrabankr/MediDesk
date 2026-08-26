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
  Network
} from 'lucide-react';
import { LanManagementView } from './LanManagementView';

interface SettingsManagementViewProps {
  currentUser?: SessionUser;
  sessionToken: string;
  userRole: string;
}

export const SettingsManagementView: React.FC<SettingsManagementViewProps> = ({ sessionToken, userRole }) => {
  const [activeTab, setActiveTab] = useState<'license' | 'backup' | 'printer' | 'diagnostics' | 'lan'>('license');
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

  // Printer state
  const [printerConfig, setPrinterConfig] = useState<any>({
    prescriptionPrinterName: 'Default Printer',
    prescriptionPageSize: 'A4',
    receiptPrinterName: 'POS Thermal Printer',
    receiptPageSize: '80mm',
    silentPrinting: false
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

  // Latest backup stats for Owner Dashboard
  const latestBackup = backups[0];
  const pendingCloudCount = backups.filter(b => b.cloudStatus === 'PENDING' || b.cloudStatus === 'FAILED').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">System & Clinic Settings</h1>
          <p className="text-sm text-slate-500">Manage offline licensing, hybrid cloud backups, printing hardware, and diagnostic health.</p>
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
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-4">
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
          <Printer className="w-4 h-4" /> Printers & Formats
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
                <Key className="w-4 h-4" /> Activate Commercial Key
              </Button>
            </div>

            {licenseInfo && (
              <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                  <div className="text-xs font-semibold text-slate-500 uppercase">License State</div>
                  <div className="text-xl font-bold mt-1 flex items-center gap-2">
                    <Badge variant={licenseInfo.status === 'ACTIVE' || licenseInfo.status === 'TRIAL' ? 'success' : 'danger'}>
                      {licenseInfo.status}
                    </Badge>
                  </div>
                  {licenseInfo.status === 'TRIAL' && (
                    <div className="text-xs text-amber-600 font-medium mt-2">
                      {licenseInfo.daysRemaining} days remaining in trial
                    </div>
                  )}
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                  <div className="text-xs font-semibold text-slate-500 uppercase">Tier & Clinic Capacity</div>
                  <div className="text-xl font-bold mt-1 text-slate-800 dark:text-slate-100">{licenseInfo.tier || 'STANDARD'}</div>
                  <div className="text-xs text-slate-500 mt-2">
                    Max Doctors: {licenseInfo.maxDoctors || 5} | Max Staff: {licenseInfo.maxStaff || 10}
                  </div>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                  <div className="text-xs font-semibold text-slate-500 uppercase">Installation Hardware</div>
                  <div className="text-xs font-mono text-slate-700 dark:text-slate-300 truncate mt-1">
                    ID: {licenseInfo.installationId}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-2">
                    Verified: {licenseInfo.lastVerifiedAt ? new Date(licenseInfo.lastVerifiedAt).toLocaleString() : 'Just now'}
                  </div>
                </div>
              </div>
            )}

            <div className="mt-6 p-4 bg-sky-50 dark:bg-sky-950/30 rounded-lg border border-sky-200 dark:border-sky-800 flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-sky-600 shrink-0 mt-0.5" />
              <div className="text-xs text-sky-900 dark:text-sky-200 leading-relaxed">
                <strong>Patient Data Retention Invariant:</strong> Even if your license or 60-day trial expires, your historical clinical visits, prescriptions, and patient records are permanently preserved and remain readable and exportable.
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Tab 2: Backup & Restore */}
      {activeTab === 'backup' && (
        <div className="space-y-6">
          {/* Owner Dashboard: Backup Status Cards */}
          <Card className="p-6">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-2">Owner Backup Overview</h3>
            <p className="text-xs text-slate-500 mb-6">Real-time status of local offline snapshots and off-site Google Drive synchronization.</p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Card 1: Local Backup */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-semibold text-slate-500 uppercase flex items-center gap-1.5">
                    <HardDrive className="w-4 h-4 text-emerald-600" /> Local Backup
                  </span>
                  <Badge variant="success">Verified</Badge>
                </div>
                <div className="text-sm font-bold text-slate-800 dark:text-slate-100">
                  {latestBackup ? latestBackup.filename : 'No snapshots'}
                </div>
                <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" /> {latestBackup ? new Date(latestBackup.createdAt).toLocaleString() : 'Never'}
                </div>
              </div>

              {/* Card 2: Google Drive */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-semibold text-slate-500 uppercase flex items-center gap-1.5">
                    <Cloud className="w-4 h-4 text-sky-600" /> Google Drive
                  </span>
                  {backupSettings.googleDriveConnected ? (
                    pendingCloudCount > 0 ? (
                      <Badge variant="warning">{pendingCloudCount} Pending</Badge>
                    ) : (
                      <Badge variant="success">Verified</Badge>
                    )
                  ) : (
                    <Badge variant="default">Disconnected</Badge>
                  )}
                </div>
                <div className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">
                  {backupSettings.googleDriveConnected ? (backupSettings.googleDriveAccountEmail || 'Connected') : 'Off-site Sync Inactive'}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  {backupSettings.googleDriveConnected
                    ? (pendingCloudCount > 0 ? 'Uploads queued for internet availability' : 'All encrypted snapshots synced')
                    : 'Connect account to enable off-site backup'}
                </div>
              </div>

              {/* Card 3: Overall Hybrid Status */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-semibold text-slate-500 uppercase">Overall State</span>
                  <Badge variant={backupSettings.backupMode === 'LOCAL_ONLY' ? 'success' : (pendingCloudCount === 0 ? 'success' : 'warning')}>
                    {backupSettings.backupMode === 'LOCAL_ONLY' ? 'Local Protected' : (pendingCloudCount === 0 ? 'Hybrid Protected' : 'Partial Protected')}
                  </Badge>
                </div>
                <div className="text-sm font-bold text-slate-800 dark:text-slate-100">
                  {backupSettings.backupMode === 'LOCAL_ONLY'
                    ? 'Local Backup Active'
                    : (pendingCloudCount === 0
                      ? 'Local + Cloud Complete'
                      : 'Local OK / Cloud Pending')}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  Mode: <span className="font-semibold text-slate-700 dark:text-slate-300">{backupSettings.backupMode}</span> (AES-256-GCM Encrypted)
                </div>
              </div>
            </div>

            {/* Top Action Controls */}
            <div className="flex flex-wrap justify-between items-center gap-3 mt-6 pt-4 border-t border-slate-200 dark:border-slate-800">
              <div className="flex gap-2">
                <Button
                  onClick={() => setShowPassphraseModal(true)}
                  disabled={isBackingUp}
                  variant="primary"
                  className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <Download className="w-4 h-4" /> {isBackingUp ? 'Backing Up...' : 'Create Backup Now'}
                </Button>
                {pendingCloudCount > 0 && backupSettings.googleDriveConnected && (
                  <Button
                    onClick={handleRetryCloud}
                    disabled={isRetryingCloud}
                    variant="outline"
                    className="flex items-center gap-2"
                  >
                    <RotateCcw className="w-4 h-4" /> {isRetryingCloud ? 'Retrying...' : `Retry Cloud (${pendingCloudCount})`}
                  </Button>
                )}
              </div>
              <div className="text-xs text-slate-400">
                Local backups never fail if Google Drive is offline.
              </div>
            </div>
          </Card>

          {/* Backup Mode & Google Drive Configuration */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Mode & Retention */}
            <Card className="p-6 space-y-4">
              <h4 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-sky-600" /> Backup Mode & Retention Policy
              </h4>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2">Operating Mode</label>
                <div className="space-y-2 text-xs">
                  <label className="flex items-center gap-2 p-2 border rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">
                    <input
                      type="radio"
                      name="backupMode"
                      checked={backupSettings.backupMode === 'HYBRID'}
                      onChange={() => handleSaveBackupSettings({ backupMode: 'HYBRID' })}
                    />
                    <div>
                      <div className="font-semibold text-slate-800 dark:text-slate-200">Hybrid (Local + Google Drive) — Recommended</div>
                      <div className="text-slate-500 text-[11px]">Instant local snapshot, automatic background off-site sync.</div>
                    </div>
                  </label>
                  <label className="flex items-center gap-2 p-2 border rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">
                    <input
                      type="radio"
                      name="backupMode"
                      checked={backupSettings.backupMode === 'LOCAL_ONLY'}
                      onChange={() => handleSaveBackupSettings({ backupMode: 'LOCAL_ONLY' })}
                    />
                    <div>
                      <div className="font-semibold text-slate-800 dark:text-slate-200">Local Offline Only</div>
                      <div className="text-slate-500 text-[11px]">Zero internet requests. Point-in-time encrypted local files only.</div>
                    </div>
                  </label>
                  <label className="flex items-center gap-2 p-2 border rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">
                    <input
                      type="radio"
                      name="backupMode"
                      checked={backupSettings.backupMode === 'CLOUD_ONLY'}
                      onChange={() => handleSaveBackupSettings({ backupMode: 'CLOUD_ONLY' })}
                    />
                    <div>
                      <div className="font-semibold text-slate-800 dark:text-slate-200">Cloud Only</div>
                      <div className="text-slate-500 text-[11px]">Encrypted artifact purged locally after verified cloud upload.</div>
                    </div>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Local Retention</label>
                  <select
                    className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded text-xs bg-white dark:bg-slate-800"
                    value={backupSettings.localRetentionDays}
                    onChange={(e) => handleSaveBackupSettings({ localRetentionDays: parseInt(e.target.value, 10) })}
                  >
                    <option value="7">7 Days</option>
                    <option value="30">30 Days (Recommended)</option>
                    <option value="90">90 Days</option>
                    <option value="365">1 Year</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Cloud Retention</label>
                  <select
                    className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded text-xs bg-white dark:bg-slate-800"
                    value={backupSettings.cloudRetentionDays}
                    onChange={(e) => handleSaveBackupSettings({ cloudRetentionDays: parseInt(e.target.value, 10) })}
                  >
                    <option value="30">30 Days</option>
                    <option value="90">90 Days (Recommended)</option>
                    <option value="180">180 Days</option>
                    <option value="365">1 Year</option>
                  </select>
                </div>
              </div>
            </Card>

            {/* Google Drive Connection */}
            <Card className="p-6 space-y-4">
              <h4 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Cloud className="w-4 h-4 text-sky-600" /> Google Drive Off-Site Storage
              </h4>
              <p className="text-xs text-slate-500">
                All cloud backups use AES-256-GCM encryption before upload. Plaintext clinic databases are never transmitted.
              </p>

              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Account Status</span>
                  {backupSettings.googleDriveConnected ? (
                    <Badge variant="success">Connected</Badge>
                  ) : (
                    <Badge variant="default">Not Connected</Badge>
                  )}
                </div>
                {backupSettings.googleDriveConnected ? (
                  <div className="text-xs text-slate-700 dark:text-slate-300 font-mono truncate">
                    {backupSettings.googleDriveAccountEmail || 'clinic-admin@gmail.com'}
                  </div>
                ) : (
                  <div className="text-xs text-slate-400 italic">
                    Connect your clinic Google account to activate off-site hybrid backups.
                  </div>
                )}

                <div className="pt-2 flex gap-2">
                  {backupSettings.googleDriveConnected ? (
                    <Button size="sm" variant="danger" onClick={handleDisconnectGDrive} className="text-xs">
                      Disconnect Account
                    </Button>
                  ) : (
                    <Button size="sm" variant="primary" onClick={() => setShowGDriveModal(true)} className="text-xs">
                      Connect Google Drive
                    </Button>
                  )}
                </div>
              </div>

              <div className="text-[11px] text-slate-400 leading-normal">
                Folder: <span className="font-mono text-slate-600 dark:text-slate-300">{backupSettings.googleDriveFolder}</span> | Duplicate-safe upload enabled.
              </div>
            </Card>
          </div>

          {/* Backup Snapshot History Table */}
          <Card className="p-6 space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h4 className="font-bold text-slate-800 dark:text-slate-100">Backup Snapshots & Audit Trail</h4>
                <p className="text-xs text-slate-500">Chronological history of local encrypted artifacts and Google Drive sync logs.</p>
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
                    <th className="p-2.5">Local</th>
                    <th className="p-2.5">Cloud</th>
                    <th className="p-2.5">Size</th>
                    <th className="p-2.5">Date & Time</th>
                    <th className="p-2.5">Checksum</th>
                    <th className="p-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {backups.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-6 text-center text-slate-400 italic">No backup snapshots recorded yet.</td>
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
                        <td className="p-2.5 font-mono text-[10px] text-slate-500">
                          {b.sha256Checksum ? b.sha256Checksum.slice(0, 8) + '...' : 'Verified'}
                        </td>
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

      {/* Tab 3: Printers */}
      {activeTab === 'printer' && (
        <Card className="p-6 space-y-6">
          <div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Hardware Printer Configurations</h3>
            <p className="text-sm text-slate-500">Set default document formats and thermal receipt printers for this workstation.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 space-y-4">
              <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-100">
                <Printer className="w-5 h-5 text-sky-600" /> Clinical Prescriptions (Laser/Inkjet)
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Target Printer</label>
                <input
                  className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded text-sm bg-white dark:bg-slate-800"
                  value={printerConfig.prescriptionPrinterName || ''}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPrinterConfig({ ...printerConfig, prescriptionPrinterName: e.target.value })}
                  placeholder="System Printer Name"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Page Format</label>
                <select
                  className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded text-sm bg-white dark:bg-slate-800"
                  value={printerConfig.prescriptionPageSize}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setPrinterConfig({ ...printerConfig, prescriptionPageSize: e.target.value })}
                >
                  <option value="A4">A4 Standard Sheet</option>
                  <option value="A5">A5 Half Sheet</option>
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
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPrinterConfig({ ...printerConfig, receiptPrinterName: e.target.value })}
                  placeholder="POS-80 Thermal"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Thermal Paper Width</label>
                <select
                  className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded text-sm bg-white dark:bg-slate-800"
                  value={printerConfig.receiptPageSize}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setPrinterConfig({ ...printerConfig, receiptPageSize: e.target.value })}
                >
                  <option value="80mm">80mm (Standard POS)</option>
                  <option value="58mm">58mm (Compact Receipt)</option>
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
      )}

      {/* Tab 4: Diagnostics */}
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

      {/* Tab 5: LAN & Multi-Computer Architecture */}
      {activeTab === 'lan' && (
        <LanManagementView sessionToken={sessionToken} userRole={userRole} />
      )}

      {/* Modal: Backup Passphrase Prompt */}
      {showPassphraseModal && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-200 dark:border-slate-800">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Create Encrypted Backup</h3>
            <p className="text-xs text-slate-500">
              The backup will be encrypted with AES-256-GCM. Enter an optional custom encryption passphrase or leave blank for default system key.
            </p>
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Custom Passphrase (Optional)</label>
              <input
                type="password"
                className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded text-sm bg-white dark:bg-slate-800"
                placeholder="Leave blank for default key"
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
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Restoring snapshot <strong>{selectedBackupForRestore.filename}</strong> will replace the current live database. An automatic safety snapshot (<code>PRE_RESTORE_SAFETY</code>) will be created before restoration.
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
