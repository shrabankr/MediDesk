import React, { useState, useEffect, useCallback } from 'react';
import { Card, Button, Badge } from '@medidesk/ui';
import {
  Network,
  Server,
  Laptop,
  Key,
  ShieldCheck,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  UserCheck,
  UserX,
  Radio,
  Clock
} from 'lucide-react';

interface LanManagementViewProps {
  sessionToken: string;
  userRole: string;
}

export const LanManagementView: React.FC<LanManagementViewProps> = ({ sessionToken, userRole }) => {
  const [lanConfig, setLanConfig] = useState<any>({
    operatingMode: 'SINGLE_PC',
    serverPort: 4848,
    serverHostname: '0.0.0.0',
    maxClients: 10,
    autoDiscoveryEnabled: true
  });
  const [lanStatus, setLanStatus] = useState<any>(null);
  const [devices, setDevices] = useState<any[]>([]);
  const [activePin, setActivePin] = useState<any>(null);
  const [pinTimeLeft, setPinTimeLeft] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Client mode pairing form
  const [clientServerUrl, setClientServerUrl] = useState('http://192.168.1.100:4848');
  const [clientPairingPin, setClientPairingPin] = useState('');
  const [clientDeviceName, setClientDeviceName] = useState('Doctor PC 1');
  const [clientDeviceRole, setClientDeviceRole] = useState('DOCTOR_WORKSTATION');

  const bridge = (window as any).mediDeskBridge;

  const loadLanData = useCallback(async () => {
    if (!bridge) return;
    try {
      const [configRes, statusRes, devicesRes] = await Promise.all([
        bridge.getLanConfig ? bridge.getLanConfig(sessionToken) : { success: false },
        bridge.getLanStatus ? bridge.getLanStatus(sessionToken) : { success: false },
        bridge.listLanDevices ? bridge.listLanDevices(sessionToken) : { success: false }
      ]);

      if (configRes.success && configRes.data) setLanConfig(configRes.data);
      if (statusRes.success && statusRes.data) setLanStatus(statusRes.data);
      if (devicesRes.success && devicesRes.data) setDevices(devicesRes.data);
    } catch { /* ignore */ }
  }, [bridge, sessionToken]);

  useEffect(() => {
    loadLanData();
  }, [loadLanData]);

  // PIN countdown timer
  useEffect(() => {
    if (!activePin) return;
    const interval = setInterval(() => {
      const expiresAt = new Date(activePin.expiresAt).getTime();
      const remaining = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
      setPinTimeLeft(remaining);
      if (remaining <= 0) {
        setActivePin(null);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [activePin]);

  const handleModeChange = async (mode: 'SINGLE_PC' | 'LAN_SERVER' | 'LAN_CLIENT') => {
    if (!bridge) return;
    try {
      const res = await bridge.saveLanConfig({ operatingMode: mode }, sessionToken);
      if (res.success) {
        setLanConfig(res.data);
        setMessage({ type: 'success', text: `Operating mode updated to ${mode}` });
        loadLanData();
      } else {
        setMessage({ type: 'error', text: res.error?.message || 'Failed to update mode' });
      }
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message });
    }
  };

  const handleStartServer = async () => {
    if (!bridge) return;
    setLoading(true);
    setMessage(null);
    try {
      const res = await bridge.startLanServer(sessionToken);
      if (res.success) {
        setMessage({ type: 'success', text: `MediDesk LAN Server started on port ${res.data.config?.serverPort || 4848}` });
        loadLanData();
      } else {
        setMessage({ type: 'error', text: res.error?.message || 'Could not start LAN server' });
      }
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message });
    } finally {
      setLoading(false);
    }
  };

  const handleStopServer = async () => {
    if (!bridge) return;
    setLoading(true);
    setMessage(null);
    try {
      const res = await bridge.stopLanServer(sessionToken);
      if (res.success) {
        setMessage({ type: 'success', text: 'MediDesk LAN Server stopped.' });
        loadLanData();
      } else {
        setMessage({ type: 'error', text: res.error?.message || 'Could not stop LAN server' });
      }
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message });
    } finally {
      setLoading(false);
    }
  };

  const handleGeneratePin = async () => {
    if (!bridge) return;
    try {
      const res = await bridge.generateLanPairingPin(sessionToken);
      if (res.success) {
        setActivePin(res.data);
        setMessage({ type: 'success', text: 'New 6-digit pairing PIN generated. Valid for 10 minutes.' });
      } else {
        setMessage({ type: 'error', text: res.error?.message || 'Could not generate PIN' });
      }
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message });
    }
  };

  const handleApproveDevice = async (deviceId: string) => {
    if (!bridge) return;
    try {
      const res = await bridge.approveLanDevice(deviceId, sessionToken);
      if (res.success) {
        setMessage({ type: 'success', text: `Device ${res.data.device?.deviceName || deviceId} approved successfully!` });
        loadLanData();
      } else {
        setMessage({ type: 'error', text: res.error?.message || 'Could not approve device' });
      }
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message });
    }
  };

  const handleRevokeDevice = async (deviceId: string) => {
    if (!bridge) return;
    try {
      const res = await bridge.revokeLanDevice(deviceId, sessionToken);
      if (res.success) {
        setMessage({ type: 'success', text: 'Device authorization revoked.' });
        loadLanData();
      } else {
        setMessage({ type: 'error', text: res.error?.message || 'Could not revoke device' });
      }
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message });
    }
  };

  const handleClientPairingSubmit = async () => {
    if (!bridge || !clientPairingPin.trim()) return;
    setLoading(true);
    setMessage(null);
    try {
      const fingerprint = `fp-${Math.random().toString(36).substring(2, 9)}`;
      const res = await bridge.registerLanDevice({
        organizationId: 'default-org',
        pairingPin: clientPairingPin.trim(),
        deviceName: clientDeviceName.trim(),
        deviceRole: clientDeviceRole as any,
        deviceFingerprint: fingerprint
      });

      if (res.success) {
        setMessage({ type: 'success', text: res.data.message || 'Pairing request sent! Awaiting Owner approval.' });
        setClientPairingPin('');
      } else {
        setMessage({ type: 'error', text: res.error?.message || 'Pairing request failed' });
      }
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {message && (
        <div className={`p-4 rounded-lg border text-sm font-medium ${message.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
          {message.text}
        </div>
      )}

      {/* Top Banner & Mode Selection */}
      <Card className="p-6">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Network className="w-5 h-5 text-sky-600" /> LAN & Multi-Computer Architecture
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Connect multiple Doctor, Reception, and Pharmacy POS workstations across your local clinic network with zero Internet dependency.
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={loadLanData} className="flex items-center gap-1">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </Button>
        </div>

        {/* Operating Mode Switcher */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2">
            Workstation Operating Mode
          </label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <label className={`p-3 border rounded-xl cursor-pointer transition-all flex items-start gap-2.5 ${lanConfig.operatingMode === 'SINGLE_PC' ? 'border-sky-500 bg-sky-50/50 dark:bg-sky-950/20 shadow-sm' : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}>
              <input
                type="radio"
                name="lanMode"
                className="mt-0.5"
                checked={lanConfig.operatingMode === 'SINGLE_PC'}
                onChange={() => handleModeChange('SINGLE_PC')}
                disabled={userRole !== 'OWNER'}
              />
              <div>
                <div className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                  <Laptop className="w-4 h-4 text-slate-600" /> Single-PC Standalone
                </div>
                <div className="text-slate-500 text-[11px] mt-0.5">
                  Direct in-memory SQLite database. 0 open network ports. Zero overhead.
                </div>
              </div>
            </label>

            <label className={`p-3 border rounded-xl cursor-pointer transition-all flex items-start gap-2.5 ${lanConfig.operatingMode === 'LAN_SERVER' ? 'border-sky-500 bg-sky-50/50 dark:bg-sky-950/20 shadow-sm' : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}>
              <input
                type="radio"
                name="lanMode"
                className="mt-0.5"
                checked={lanConfig.operatingMode === 'LAN_SERVER'}
                onChange={() => handleModeChange('LAN_SERVER')}
                disabled={userRole !== 'OWNER'}
              />
              <div>
                <div className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                  <Server className="w-4 h-4 text-emerald-600" /> MediDesk LAN Server
                </div>
                <div className="text-slate-500 text-[11px] mt-0.5">
                  Hosts authoritative database, authenticates clients, executes Hybrid Backups.
                </div>
              </div>
            </label>

            <label className={`p-3 border rounded-xl cursor-pointer transition-all flex items-start gap-2.5 ${lanConfig.operatingMode === 'LAN_CLIENT' ? 'border-sky-500 bg-sky-50/50 dark:bg-sky-950/20 shadow-sm' : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}>
              <input
                type="radio"
                name="lanMode"
                className="mt-0.5"
                checked={lanConfig.operatingMode === 'LAN_CLIENT'}
                onChange={() => handleModeChange('LAN_CLIENT')}
                disabled={userRole !== 'OWNER'}
              />
              <div>
                <div className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                  <Radio className="w-4 h-4 text-sky-600" /> LAN Workstation Client
                </div>
                <div className="text-slate-500 text-[11px] mt-0.5">
                  Doctor / POS PC connecting to the clinic server via secure REST/WSS.
                </div>
              </div>
            </label>
          </div>
        </div>
      </Card>

      {/* LAN Server Mode Dashboard */}
      {lanConfig.operatingMode === 'LAN_SERVER' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Server Status & Controls */}
          <Card className="p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h4 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Server className="w-4 h-4 text-emerald-600" /> Server Daemon Status
              </h4>
              <Badge variant={lanStatus?.isServerRunning ? 'success' : 'default'}>
                {lanStatus?.isServerRunning ? '🟢 Active & Listening' : '⚪ Stopped'}
              </Badge>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Listening Port:</span>
                <span className="font-mono font-bold text-slate-700 dark:text-slate-200">{lanConfig.serverPort || 4848}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Approved Clients:</span>
                <span className="font-bold text-slate-700 dark:text-slate-200">{lanStatus?.approvedDevicesCount || 0} / {lanConfig.maxClients || 10}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Server Fingerprint:</span>
                <span className="font-mono text-[11px] text-slate-600 dark:text-slate-300 truncate max-w-[200px]">
                  {lanConfig.serverFingerprint ? lanConfig.serverFingerprint.slice(0, 16) + '...' : 'Auto-generated'}
                </span>
              </div>
            </div>

            {userRole === 'OWNER' && (
              <div className="pt-2 flex gap-2">
                {lanStatus?.isServerRunning ? (
                  <Button variant="danger" disabled={loading} onClick={handleStopServer} className="text-xs">
                    Stop LAN Server
                  </Button>
                ) : (
                  <Button variant="primary" disabled={loading} onClick={handleStartServer} className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white">
                    Start LAN Server
                  </Button>
                )}
              </div>
            )}
          </Card>

          {/* Pairing PIN Generator */}
          <Card className="p-6 space-y-4">
            <h4 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Key className="w-4 h-4 text-sky-600" /> Client Device Pairing
            </h4>
            <p className="text-xs text-slate-500">
              Generate a temporary 6-digit cryptographic PIN to register a new Doctor or POS workstation on this clinic server.
            </p>

            {activePin ? (
              <div className="p-4 bg-sky-50 dark:bg-sky-950/30 rounded-xl border border-sky-200 dark:border-sky-800 text-center space-y-2">
                <div className="text-xs font-semibold text-sky-700 dark:text-sky-300 uppercase tracking-wide">
                  Active Pairing PIN
                </div>
                <div className="text-3xl font-mono font-extrabold tracking-widest text-sky-900 dark:text-sky-100">
                  {activePin.pinCode.slice(0, 3)} {activePin.pinCode.slice(3)}
                </div>
                <div className="text-xs text-sky-600 dark:text-sky-400 flex items-center justify-center gap-1">
                  <Clock className="w-3.5 h-3.5" /> Valid for {Math.floor(pinTimeLeft / 60)}m {pinTimeLeft % 60}s
                </div>
              </div>
            ) : (
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-center text-xs text-slate-400 py-6">
                No active pairing PIN. Click below to generate.
              </div>
            )}

            {userRole === 'OWNER' && (
              <Button size="sm" variant="outline" onClick={handleGeneratePin} className="text-xs w-full">
                Generate 6-Digit Pairing PIN
              </Button>
            )}
          </Card>
        </div>
      )}

      {/* LAN Client Mode Connection Setup */}
      {lanConfig.operatingMode === 'LAN_CLIENT' && (
        <Card className="p-6 space-y-4">
          <h4 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Radio className="w-4 h-4 text-sky-600" /> Connect to Clinic LAN Server
          </h4>
          <p className="text-xs text-slate-500">
            Enter the LAN IP address of your clinic Server PC and the 6-digit pairing PIN generated by the Owner.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-600 dark:text-slate-300 mb-1">Server URL</label>
              <input
                className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800 font-mono"
                value={clientServerUrl}
                onChange={(e) => setClientServerUrl(e.target.value)}
                placeholder="http://192.168.1.100:4848"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-600 dark:text-slate-300 mb-1">6-Digit Pairing PIN</label>
              <input
                className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800 font-mono tracking-widest text-center"
                value={clientPairingPin}
                onChange={(e) => setClientPairingPin(e.target.value)}
                placeholder="489123"
                maxLength={6}
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-600 dark:text-slate-300 mb-1">Workstation Name</label>
              <input
                className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800"
                value={clientDeviceName}
                onChange={(e) => setClientDeviceName(e.target.value)}
                placeholder="Doctor Consultation Room 1"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-600 dark:text-slate-300 mb-1">Device Role</label>
              <select
                className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800"
                value={clientDeviceRole}
                onChange={(e) => setClientDeviceRole(e.target.value)}
              >
                <option value="DOCTOR_WORKSTATION">Doctor Workstation</option>
                <option value="PHARMACY_POS">Pharmacy POS Workstation</option>
                <option value="RECEPTION">Reception / Queue PC</option>
                <option value="GENERAL_CLIENT">General Client</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button
              variant="primary"
              disabled={loading || !clientPairingPin.trim()}
              onClick={handleClientPairingSubmit}
              className="text-xs"
            >
              {loading ? 'Submitting...' : 'Register Device with Server'}
            </Button>
          </div>
        </Card>
      )}

      {/* Registered LAN Devices Table (Server Mode) */}
      {lanConfig.operatingMode === 'LAN_SERVER' && (
        <Card className="p-6 space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h4 className="font-bold text-slate-800 dark:text-slate-100">Registered LAN Workstations</h4>
              <p className="text-xs text-slate-500">Approved workstations authorized to access the clinic database over the local network.</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-600 font-semibold">
                  <th className="p-2.5">Device Name</th>
                  <th className="p-2.5">Role</th>
                  <th className="p-2.5">IP Address</th>
                  <th className="p-2.5">Fingerprint</th>
                  <th className="p-2.5">Status</th>
                  <th className="p-2.5">Registered</th>
                  <th className="p-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {devices.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-slate-400 italic">No client devices registered yet.</td>
                  </tr>
                ) : (
                  devices.map((dev) => (
                    <tr key={dev.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <td className="p-2.5 font-medium text-slate-800 dark:text-slate-200 flex items-center gap-2">
                        <Laptop className="w-4 h-4 text-slate-400 shrink-0" />
                        <span>{dev.deviceName}</span>
                      </td>
                      <td className="p-2.5"><Badge variant="default">{dev.deviceRole}</Badge></td>
                      <td className="p-2.5 font-mono text-slate-600 dark:text-slate-400">{dev.ipAddress || 'LAN'}</td>
                      <td className="p-2.5 font-mono text-[10px] text-slate-400 truncate max-w-[100px]" title={dev.deviceFingerprint}>
                        {dev.deviceFingerprint.slice(0, 10)}...
                      </td>
                      <td className="p-2.5">
                        <Badge
                          variant={
                            dev.status === 'APPROVED'
                              ? 'success'
                              : (dev.status === 'PENDING_APPROVAL' ? 'warning' : 'danger')
                          }
                        >
                          {dev.status}
                        </Badge>
                      </td>
                      <td className="p-2.5 text-slate-500">{new Date(dev.createdAt).toLocaleDateString()}</td>
                      <td className="p-2.5 text-right space-x-1">
                        {dev.status === 'PENDING_APPROVAL' && userRole === 'OWNER' && (
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={() => handleApproveDevice(dev.id)}
                            className="text-[11px] h-7 px-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                          >
                            <UserCheck className="w-3 h-3 mr-1" /> Approve
                          </Button>
                        )}
                        {dev.status === 'APPROVED' && userRole === 'OWNER' && (
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => handleRevokeDevice(dev.id)}
                            className="text-[11px] h-7 px-2"
                          >
                            <UserX className="w-3 h-3 mr-1" /> Revoke
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
      )}

      {/* Zero Trust Invariant Banner */}
      <div className="p-4 bg-sky-50 dark:bg-sky-950/30 rounded-lg border border-sky-200 dark:border-sky-800 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-sky-600 shrink-0 mt-0.5" />
        <div className="text-xs text-sky-900 dark:text-sky-200 leading-relaxed">
          <strong>Zero-Trust LAN Invariant:</strong> The local network is assumed to be untrusted. All requests require cryptographically signed device tokens, HMAC payload signatures, and server-side RBAC validation. Direct SQLite file sharing over SMB/CIFS is permanently disabled.
        </div>
      </div>
    </div>
  );
};
