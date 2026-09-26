import React, { useState, useEffect, useCallback } from 'react';
import {
  User,
  Plus,
  Search,
  CheckCircle,
  AlertTriangle,
  Download,
  UploadCloud,
  RefreshCw,
  Calendar,
  Pencil,
  Eye,
  X,
  Phone,
  MapPin,
  Clock,
  ShieldAlert,
  FileText,
  AlertCircle
} from 'lucide-react';
import { Button, Card, Badge } from '@medidesk/ui';
import { Patient, DuplicatePatientMatch, SessionUser } from '@medidesk/shared';
import { DataExportModal, ExportColumn } from './common/DataExportModal.js';

interface PatientManagementViewProps {
  currentUser: SessionUser;
  onBookAppointment?: (patient: Patient) => void;
  onNavigate?: (tab: string) => void;
}

export const PatientManagementView: React.FC<PatientManagementViewProps> = ({
  currentUser,
  onBookAppointment,
  onNavigate
}) => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);

  // Modals
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);

  // Registration Form State
  const [registerForm, setRegisterForm] = useState({
    fullName: '',
    sex: 'MALE' as 'MALE' | 'FEMALE' | 'OTHER',
    mobile: '',
    dateOfBirth: '',
    age: '',
    alternateMobile: '',
    address: '',
    emergencyContactName: '',
    emergencyContactPhone: ''
  });
  const [duplicateMatches, setDuplicateMatches] = useState<DuplicatePatientMatch[]>([]);
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Edit Form State
  const [editForm, setEditForm] = useState({
    fullName: '',
    sex: 'MALE' as 'MALE' | 'FEMALE' | 'OTHER',
    mobile: '',
    dateOfBirth: '',
    age: '',
    alternateMobile: '',
    address: '',
    emergencyContactName: '',
    emergencyContactPhone: ''
  });

  const sessionToken = localStorage.getItem('medidesk_session_token') || '';

  const loadPatients = useCallback(async (query = '') => {
    if (!window.mediDeskBridge) return;
    setLoading(true);
    try {
      const res = await window.mediDeskBridge.searchPatients(
        {
          organizationId: currentUser.organizationId,
          query: query.trim() || undefined,
          limit: 100
        },
        sessionToken
      );
      if (res.success && res.data) {
        setPatients(res.data);
      }
    } catch (err) {
      console.error('Failed to load patients:', err);
    } finally {
      setLoading(false);
    }
  }, [currentUser.organizationId, sessionToken]);

  useEffect(() => {
    loadPatients(searchQuery);
  }, [loadPatients, searchQuery]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadPatients(searchQuery);
  };

  const handleOpenRegister = () => {
    setRegisterForm({
      fullName: '',
      sex: 'MALE',
      mobile: '',
      dateOfBirth: '',
      age: '',
      alternateMobile: '',
      address: '',
      emergencyContactName: '',
      emergencyContactPhone: ''
    });
    setDuplicateMatches([]);
    setShowDuplicateWarning(false);
    setFormError(null);
    setIsRegisterOpen(true);
  };

  const handleSavePatient = async (forceCreate = false) => {
    if (!window.mediDeskBridge) return;
    if (!registerForm.fullName.trim()) {
      setFormError('Full name is required.');
      return;
    }

    setFormSubmitting(true);
    setFormError(null);

    try {
      // 1. Duplicate check unless forced
      if (!forceCreate) {
        const dupRes = await window.mediDeskBridge.checkDuplicates(
          {
            organizationId: currentUser.organizationId,
            fullName: registerForm.fullName.trim(),
            mobile: registerForm.mobile.trim() || undefined,
            dateOfBirth: registerForm.dateOfBirth || undefined,
            sex: registerForm.sex
          },
          sessionToken
        );

        if (dupRes.success && dupRes.data && dupRes.data.length > 0) {
          setDuplicateMatches(dupRes.data);
          setShowDuplicateWarning(true);
          setFormSubmitting(false);
          return;
        }
      }

      // 2. Create Patient
      const res = await window.mediDeskBridge.createPatient(
        {
          organizationId: currentUser.organizationId,
          fullName: registerForm.fullName.trim(),
          sex: registerForm.sex,
          mobile: registerForm.mobile.trim() || undefined,
          dateOfBirth: registerForm.dateOfBirth || undefined,
          age: registerForm.age ? parseInt(registerForm.age, 10) : undefined,
          alternateMobile: registerForm.alternateMobile.trim() || undefined,
          address: registerForm.address.trim() || undefined,
          emergencyContactName: registerForm.emergencyContactName.trim() || undefined,
          emergencyContactPhone: registerForm.emergencyContactPhone.trim() || undefined
        },
        sessionToken
      );

      if (res.success && res.data) {
        setIsRegisterOpen(false);
        setSelectedPatient(res.data);
        loadPatients(searchQuery);
      } else {
        setFormError(res.error?.message || 'Failed to register patient.');
      }
    } catch (err: any) {
      setFormError(err.message || 'An error occurred during registration.');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleOpenEdit = (patient: Patient) => {
    setEditForm({
      fullName: patient.fullName,
      sex: patient.sex,
      mobile: patient.mobile || '',
      dateOfBirth: patient.dateOfBirth || '',
      age: patient.age ? String(patient.age) : '',
      alternateMobile: patient.alternateMobile || '',
      address: patient.address || '',
      emergencyContactName: patient.emergencyContactName || '',
      emergencyContactPhone: patient.emergencyContactPhone || ''
    });
    setFormError(null);
    setIsEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedPatient || !window.mediDeskBridge) return;
    if (!editForm.fullName.trim()) {
      setFormError('Full name is required.');
      return;
    }

    setFormSubmitting(true);
    setFormError(null);

    try {
      const res = await window.mediDeskBridge.updatePatient(
        {
          patientId: selectedPatient.id,
          fullName: editForm.fullName.trim(),
          sex: editForm.sex,
          mobile: editForm.mobile.trim() || undefined,
          dateOfBirth: editForm.dateOfBirth || undefined,
          age: editForm.age ? parseInt(editForm.age, 10) : undefined,
          alternateMobile: editForm.alternateMobile.trim() || undefined,
          address: editForm.address.trim() || undefined,
          emergencyContactName: editForm.emergencyContactName.trim() || undefined,
          emergencyContactPhone: editForm.emergencyContactPhone.trim() || undefined
        },
        currentUser.organizationId,
        sessionToken
      );

      if (res.success && res.data) {
        setIsEditOpen(false);
        setSelectedPatient(res.data);
        loadPatients(searchQuery);
      } else {
        setFormError(res.error?.message || 'Failed to update patient.');
      }
    } catch (err: any) {
      setFormError(err.message || 'An error occurred while updating patient.');
    } finally {
      setFormSubmitting(false);
    }
  };

  const patientExportColumns: ExportColumn[] = [
    { key: 'patientNumber', header: 'Patient ID (UHID)' },
    { key: 'fullName', header: 'Full Name' },
    { key: 'sex', header: 'Gender' },
    { key: 'age', header: 'Age' },
    { key: 'dateOfBirth', header: 'Date of Birth' },
    { key: 'mobile', header: 'Mobile Number' },
    { key: 'alternateMobile', header: 'Alternate Mobile' },
    { key: 'address', header: 'Address' },
    { key: 'emergencyContactName', header: 'Emergency Contact Name' },
    { key: 'emergencyContactPhone', header: 'Emergency Contact Phone' },
    { key: 'status', header: 'Status' }
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* Header & Global Search Bar with Icon-First Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
              <User className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                Patient Directory & Registrations
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Search, register, and manage patient profiles with duplicate detection
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadPatients(searchQuery)}
            className="flex items-center gap-1.5 text-xs"
            title="Refresh patient list"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden md:inline">Refresh</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsExportOpen(true)}
            className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-200"
            title="Export patients to CSV or JSON"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export</span>
          </Button>

          {onNavigate && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onNavigate('import')}
              className="flex items-center gap-1.5 text-xs text-blue-600 border-blue-200 dark:border-blue-800 hover:bg-blue-50"
              title="Bulk import patients from CSV spreadsheet"
            >
              <UploadCloud className="h-3.5 w-3.5" />
              <span>Import</span>
            </Button>
          )}

          <Button
            variant="primary"
            size="sm"
            onClick={handleOpenRegister}
            className="flex items-center gap-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white font-medium"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Register New Patient</span>
          </Button>
        </div>
      </div>

      {/* Fast Search Input */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <form onSubmit={handleSearchSubmit} className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by Patient ID (e.g. MD-000001), Name (e.g. Rahul), or Mobile number..."
            className="w-full pl-10 pr-24 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
          <Search className="h-4 w-4 absolute left-3.5 top-3 text-slate-400" />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-20 top-2 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 px-2 py-1"
            >
              Clear
            </button>
          )}
          <button
            type="submit"
            className="absolute right-2 top-1.5 px-3 py-1 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded text-xs font-medium transition"
          >
            Search
          </button>
        </form>
      </div>

      {/* Patient Table & Details Drawer Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Patient List (2 cols) */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/40">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Patients Found ({patients.length})
            </span>
            {loading && <span className="text-xs text-blue-500 animate-pulse">Searching...</span>}
          </div>

          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            {patients.length === 0 && !loading ? (
              <div className="p-12 text-center text-slate-500 space-y-2">
                <FileText className="h-10 w-10 text-slate-300 dark:text-slate-700 mx-auto" />
                <p className="font-medium text-xs">No patients found</p>
                <p className="text-[11px] text-slate-400">
                  Try adjusting your search query or register a new patient.
                </p>
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="p-3">Patient ID</th>
                    <th className="p-3">Full Name</th>
                    <th className="p-3">Gender / Age</th>
                    <th className="p-3">Mobile</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {patients.map((p) => {
                    const isSelected = selectedPatient?.id === p.id;
                    return (
                      <tr
                        key={p.id}
                        onClick={() => setSelectedPatient(p)}
                        className={`cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-blue-50/80 dark:bg-blue-950/40 font-medium'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/30'
                        }`}
                      >
                        <td className="p-3 font-mono font-bold text-blue-600 dark:text-blue-400">
                          {p.patientNumber}
                        </td>
                        <td className="p-3 font-semibold text-slate-900 dark:text-white">
                          {p.fullName}
                        </td>
                        <td className="p-3 text-slate-600 dark:text-slate-400">
                          {p.sex} • {p.age ? `${p.age} yrs` : p.dateOfBirth ? `${p.dateOfBirth}` : '—'}
                        </td>
                        <td className="p-3 font-mono text-slate-600 dark:text-slate-400">
                          {p.mobile || '—'}
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                            {onBookAppointment && (
                              <button
                                onClick={() => onBookAppointment(p)}
                                className="px-2.5 py-1 bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-950 dark:text-blue-300 rounded font-medium text-xs flex items-center gap-1 transition"
                                title="Book appointment for patient"
                              >
                                <Calendar className="h-3.5 w-3.5" />
                                <span>Book</span>
                              </button>
                            )}
                            <button
                              onClick={() => {
                                setSelectedPatient(p);
                                handleOpenEdit(p);
                              }}
                              className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 rounded transition"
                              title="Edit patient profile"
                              aria-label="Edit patient profile"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Selected Patient Details Card (1 col) */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-5">
          {selectedPatient ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
                    <User className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                      {selectedPatient.fullName}
                    </h3>
                    <span className="font-mono text-[11px] text-blue-600 dark:text-blue-400">
                      {selectedPatient.patientNumber}
                    </span>
                  </div>
                </div>

                <Badge variant={selectedPatient.status === 'ACTIVE' ? 'success' : 'secondary'} className="text-[10px]">
                  {selectedPatient.status}
                </Badge>
              </div>

              <div className="space-y-3 text-xs">
                <div className="flex items-start gap-2 text-slate-600 dark:text-slate-400">
                  <Phone className="h-3.5 w-3.5 text-slate-400 mt-0.5 shrink-0" />
                  <div>
                    <span className="text-slate-400 block text-[10px]">Mobile</span>
                    <span className="font-mono font-medium text-slate-800 dark:text-slate-200">
                      {selectedPatient.mobile || 'None provided'}
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-2 text-slate-600 dark:text-slate-400">
                  <Clock className="h-3.5 w-3.5 text-slate-400 mt-0.5 shrink-0" />
                  <div>
                    <span className="text-slate-400 block text-[10px]">Demographics</span>
                    <span className="font-medium text-slate-800 dark:text-slate-200">
                      {selectedPatient.sex} • {selectedPatient.age ? `${selectedPatient.age} years old` : selectedPatient.dateOfBirth || 'Unknown age'}
                    </span>
                  </div>
                </div>

                {selectedPatient.address && (
                  <div className="flex items-start gap-2 text-slate-600 dark:text-slate-400">
                    <MapPin className="h-3.5 w-3.5 text-slate-400 mt-0.5 shrink-0" />
                    <div>
                      <span className="text-slate-400 block text-[10px]">Address</span>
                      <span className="font-medium text-slate-800 dark:text-slate-200">{selectedPatient.address}</span>
                    </div>
                  </div>
                )}

                {selectedPatient.emergencyContactName && (
                  <div className="p-3 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-xl space-y-1">
                    <span className="text-[10px] font-bold text-amber-800 dark:text-amber-300 block">Emergency Contact</span>
                    <p className="font-medium text-slate-800 dark:text-slate-200">
                      {selectedPatient.emergencyContactName} ({selectedPatient.emergencyContactPhone || 'No phone'})
                    </p>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex gap-2">
                {onBookAppointment && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => onBookAppointment(selectedPatient)}
                    className="flex-1 text-xs bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center gap-1.5"
                  >
                    <Calendar className="h-3.5 w-3.5" />
                    <span>Book Visit</span>
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleOpenEdit(selectedPatient)}
                  className="flex items-center gap-1.5 text-xs"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  <span>Edit</span>
                </Button>
              </div>
            </div>
          ) : (
            <div className="py-16 text-center text-slate-400 space-y-2">
              <Eye className="h-8 w-8 mx-auto text-slate-300 dark:text-slate-700" />
              <p className="text-xs font-medium">Select a patient from the list to view profile details</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal: Register Patient */}
      {isRegisterOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <Card className="w-full max-w-lg p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl rounded-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Plus className="h-5 w-5 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Register New Patient</h3>
              </div>
              <button onClick={() => setIsRegisterOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold p-1">
                <X className="h-4 w-4" />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                <span>{formError}</span>
              </div>
            )}

            {showDuplicateWarning && duplicateMatches.length > 0 && (
              <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl space-y-2 text-xs">
                <div className="flex items-center gap-2 font-bold text-amber-800 dark:text-amber-300">
                  <ShieldAlert className="h-4 w-4" />
                  <span>Potential Duplicate Patients Detected</span>
                </div>
                <p className="text-slate-600 dark:text-slate-400 text-[11px]">
                  Existing patient records match the name or mobile number:
                </p>
                <div className="space-y-1 max-h-24 overflow-y-auto font-mono text-[11px]">
                  {duplicateMatches.map((m, idx) => (
                    <div key={idx} className="p-1.5 bg-white dark:bg-slate-800 rounded border border-amber-200 dark:border-amber-900">
                      {m.patient.fullName} ({m.patient.patientNumber}) • Match Reason: {m.matchReason}
                    </div>
                  ))}
                </div>
                <div className="pt-2 flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => setShowDuplicateWarning(false)}>
                    Review Info
                  </Button>
                  <Button variant="primary" size="sm" onClick={() => handleSavePatient(true)} className="bg-amber-600 hover:bg-amber-700 text-white">
                    Create Anyway (Confirm New Patient)
                  </Button>
                </div>
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSavePatient(false);
              }}
              className="space-y-3.5 text-xs"
            >
              <div>
                <label className="font-semibold block mb-1">Full Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Rahul Sharma"
                  value={registerForm.fullName}
                  onChange={(e) => setRegisterForm({ ...registerForm, fullName: e.target.value })}
                  className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold block mb-1">Gender *</label>
                  <select
                    value={registerForm.sex}
                    onChange={(e) => setRegisterForm({ ...registerForm, sex: e.target.value as any })}
                    className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold block mb-1">Mobile Number</label>
                  <input
                    type="text"
                    placeholder="10-digit mobile"
                    value={registerForm.mobile}
                    onChange={(e) => setRegisterForm({ ...registerForm, mobile: e.target.value })}
                    className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="font-semibold block mb-1">Date of Birth</label>
                  <input
                    type="date"
                    value={registerForm.dateOfBirth}
                    onChange={(e) => setRegisterForm({ ...registerForm, dateOfBirth: e.target.value })}
                    className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="font-semibold block mb-1">Age (if DOB unknown)</label>
                  <input
                    type="number"
                    min="0"
                    max="130"
                    placeholder="e.g. 34"
                    value={registerForm.age}
                    onChange={(e) => setRegisterForm({ ...registerForm, age: e.target.value })}
                    className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold block mb-1">Address</label>
                <input
                  type="text"
                  placeholder="Street address, city, pin"
                  value={registerForm.address}
                  onChange={(e) => setRegisterForm({ ...registerForm, address: e.target.value })}
                  className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                <Button variant="outline" type="button" onClick={() => setIsRegisterOpen(false)} className="flex-1 text-xs">
                  <X className="h-4 w-4 mr-1" /> Cancel
                </Button>
                <Button
                  variant="primary"
                  type="submit"
                  disabled={formSubmitting}
                  className="flex-1 text-xs bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center gap-1.5"
                >
                  <CheckCircle className="h-4 w-4" />
                  <span>{formSubmitting ? 'Registering...' : 'Save Patient Profile'}</span>
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Modal: Edit Patient */}
      {isEditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <Card className="w-full max-w-lg p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl rounded-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Pencil className="h-5 w-5 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Edit Patient Profile</h3>
              </div>
              <button onClick={() => setIsEditOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold p-1">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSaveEdit();
              }}
              className="space-y-3.5 text-xs"
            >
              <div>
                <label className="font-semibold block mb-1">Full Name *</label>
                <input
                  type="text"
                  value={editForm.fullName}
                  onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
                  className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold block mb-1">Gender *</label>
                  <select
                    value={editForm.sex}
                    onChange={(e) => setEditForm({ ...editForm, sex: e.target.value as any })}
                    className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold block mb-1">Mobile Number</label>
                  <input
                    type="text"
                    value={editForm.mobile}
                    onChange={(e) => setEditForm({ ...editForm, mobile: e.target.value })}
                    className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold block mb-1">Address</label>
                <input
                  type="text"
                  value={editForm.address}
                  onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                  className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                <Button variant="outline" type="button" onClick={() => setIsEditOpen(false)} className="flex-1 text-xs">
                  <X className="h-4 w-4 mr-1" /> Cancel
                </Button>
                <Button
                  variant="primary"
                  type="submit"
                  disabled={formSubmitting}
                  className="flex-1 text-xs bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center gap-1.5"
                >
                  <CheckCircle className="h-4 w-4" />
                  <span>{formSubmitting ? 'Saving...' : 'Save Changes'}</span>
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Export Modal */}
      <DataExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        title="Export Patient Directory"
        entityName="Patients"
        data={patients}
        columns={patientExportColumns}
        currentUser={currentUser}
        defaultFilename={`patients_directory_${new Date().toISOString().split('T')[0]}`}
      />
    </div>
  );
};
