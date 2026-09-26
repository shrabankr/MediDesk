import React, { useState, useEffect, useCallback } from 'react';
import {
  Stethoscope,
  Plus,
  Clock,
  Pencil,
  CheckCircle,
  XCircle,
  Download,
  UploadCloud,
  RefreshCw,
  X,
  Phone,
  Award,
  AlertCircle,
  Shield,
  FileText
} from 'lucide-react';
import { Button, Card, Badge } from '@medidesk/ui';
import { Doctor, SessionUser } from '@medidesk/shared';
import { DataExportModal, ExportColumn } from './common/DataExportModal.js';

interface DoctorManagementViewProps {
  currentUser: SessionUser;
  onNavigate?: (tab: string) => void;
}

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const DoctorManagementView: React.FC<DoctorManagementViewProps> = ({
  currentUser,
  onNavigate
}) => {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);

  // Add / Edit Modal State
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [doctorForm, setDoctorForm] = useState({
    displayName: '',
    qualification: '',
    specialization: '',
    registrationNumber: '',
    mobile: '',
    consultationFee: '0'
  });
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Schedules Modal State
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [schedules, setSchedules] = useState<Array<{ dayOfWeek: number; startTime: string; endTime: string; isActive: boolean }>>([]);

  const sessionToken = localStorage.getItem('medidesk_session_token') || '';

  const loadDoctors = useCallback(async () => {
    if (!window.mediDeskBridge) return;
    setLoading(true);
    try {
      const res = await window.mediDeskBridge.listDoctors(currentUser.organizationId, sessionToken);
      if (res.success && res.data) {
        setDoctors(res.data);
        if (selectedDoctor) {
          const updated = res.data.find((d) => d.id === selectedDoctor.id);
          if (updated) setSelectedDoctor(updated);
        }
      }
    } catch (err: unknown) {
      console.error('Failed to load doctors:', err);
    } finally {
      setLoading(false);
    }
  }, [currentUser.organizationId, sessionToken, selectedDoctor]);

  useEffect(() => {
    loadDoctors();
  }, [loadDoctors]);

  const handleOpenAdd = () => {
    setDoctorForm({
      displayName: '',
      qualification: 'MBBS',
      specialization: 'General Medicine',
      registrationNumber: '',
      mobile: '',
      consultationFee: '500'
    });
    setFormError(null);
    setIsAddOpen(true);
  };

  const handleOpenEdit = (doctor: Doctor) => {
    setSelectedDoctor(doctor);
    setDoctorForm({
      displayName: doctor.displayName,
      qualification: doctor.qualification,
      specialization: doctor.specialization,
      registrationNumber: doctor.registrationNumber || '',
      mobile: doctor.mobile || '',
      consultationFee: String(doctor.consultationFee ? doctor.consultationFee / 100 : 0)
    });
    setFormError(null);
    setIsEditOpen(true);
  };

  const handleSaveAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!window.mediDeskBridge) return;
    if (!doctorForm.displayName.trim() || !doctorForm.specialization.trim()) {
      setFormError('Doctor display name and specialization are required.');
      return;
    }

    setFormSubmitting(true);
    setFormError(null);

    try {
      const feeInPaise = Math.round(parseFloat(doctorForm.consultationFee || '0') * 100);
      const res = await window.mediDeskBridge.createDoctor(
        {
          organizationId: currentUser.organizationId,
          displayName: doctorForm.displayName.trim(),
          qualification: doctorForm.qualification.trim(),
          specialization: doctorForm.specialization.trim(),
          registrationNumber: doctorForm.registrationNumber.trim() || undefined,
          mobile: doctorForm.mobile.trim() || undefined,
          consultationFee: isNaN(feeInPaise) ? 0 : feeInPaise
        },
        sessionToken
      );

      if (res.success && res.data) {
        setIsAddOpen(false);
        loadDoctors();
      } else {
        setFormError(res.error?.message || 'Failed to add doctor.');
      }
    } catch (err: unknown) {
      setFormError((err as Error).message || 'An error occurred');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDoctor || !window.mediDeskBridge) return;
    if (!doctorForm.displayName.trim() || !doctorForm.specialization.trim()) {
      setFormError('Doctor display name and specialization are required.');
      return;
    }

    setFormSubmitting(true);
    setFormError(null);

    try {
      const feeInPaise = Math.round(parseFloat(doctorForm.consultationFee || '0') * 100);
      const res = await window.mediDeskBridge.updateDoctor(
        {
          doctorId: selectedDoctor.id,
          displayName: doctorForm.displayName.trim(),
          qualification: doctorForm.qualification.trim(),
          specialization: doctorForm.specialization.trim(),
          registrationNumber: doctorForm.registrationNumber.trim() || undefined,
          mobile: doctorForm.mobile.trim() || undefined,
          consultationFee: isNaN(feeInPaise) ? 0 : feeInPaise
        },
        currentUser.organizationId,
        sessionToken
      );

      if (res.success) {
        setIsEditOpen(false);
        loadDoctors();
      } else {
        setFormError(res.error?.message || 'Failed to update doctor.');
      }
    } catch (err: unknown) {
      setFormError((err as Error).message || 'An error occurred');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleToggleDoctorStatus = async (doctor: Doctor) => {
    if (!window.mediDeskBridge) return;
    const isDeactivating = doctor.status === 'ACTIVE';

    if (isDeactivating) {
      const confirmed = window.confirm(`Deactivate ${doctor.displayName}? Inactive doctors cannot be booked for new appointments.`);
      if (!confirmed) return;

      const res = await window.mediDeskBridge.deactivateDoctor(doctor.id, currentUser.organizationId, sessionToken);
      if (res.success) {
        loadDoctors();
      }
    } else {
      const res = await window.mediDeskBridge.updateDoctor(
        { doctorId: doctor.id, status: 'ACTIVE' },
        currentUser.organizationId,
        sessionToken
      );
      if (res.success) {
        loadDoctors();
      }
    }
  };

  const handleOpenSchedule = (doctor: Doctor) => {
    setSelectedDoctor(doctor);
    const existing = doctor.schedules || [];
    const fullWeek = [1, 2, 3, 4, 5, 6].map((day) => {
      const match = existing.find((s) => s.dayOfWeek === day);
      return {
        dayOfWeek: day,
        startTime: match?.startTime || '09:00',
        endTime: match?.endTime || '13:00',
        isActive: match ? match.isActive : false
      };
    });
    setSchedules(fullWeek);
    setIsScheduleOpen(true);
  };

  const handleSaveSchedules = async () => {
    if (!selectedDoctor || !window.mediDeskBridge) return;
    setFormSubmitting(true);
    setFormError(null);

    const activeSchedules = schedules
      .filter((s) => s.isActive)
      .map((s) => ({
        dayOfWeek: s.dayOfWeek,
        startTime: s.startTime,
        endTime: s.endTime,
        slotDurationMinutes: 15,
        isActive: true
      }));

    try {
      const res = await window.mediDeskBridge.setDoctorSchedules(
        {
          doctorId: selectedDoctor.id,
          schedules: activeSchedules
        },
        currentUser.organizationId,
        sessionToken
      );

      if (res.success) {
        setIsScheduleOpen(false);
        loadDoctors();
      } else {
        setFormError(res.error?.message || 'Failed to save schedules');
      }
    } catch (err: unknown) {
      setFormError((err as Error).message || 'An error occurred');
    } finally {
      setFormSubmitting(false);
    }
  };

  const doctorExportColumns: ExportColumn[] = [
    { key: 'displayName', header: 'Doctor Name' },
    { key: 'specialization', header: 'Specialization' },
    { key: 'qualification', header: 'Qualification' },
    { key: 'registrationNumber', header: 'Medical Reg Number' },
    { key: 'mobile', header: 'Mobile Number' },
    {
      key: 'consultationFee',
      header: 'Consultation Fee (₹)',
      format: (val) => (val ? `₹${(val / 100).toFixed(2)}` : '₹0.00')
    },
    {
      key: 'schedules',
      header: 'Working Days',
      format: (val) =>
        val && val.length > 0
          ? val.map((s: any) => DAYS_OF_WEEK[s.dayOfWeek].slice(0, 3)).join(', ')
          : 'None'
    },
    { key: 'status', header: 'Status' }
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* Header with Icon-First Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
              <Stethoscope className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                Doctor Directory & Weekly Availability
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Manage practicing clinic doctors, consultation fees, and weekly availability schedules
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={loadDoctors}
            className="flex items-center gap-1.5 text-xs"
            title="Refresh doctor list"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden md:inline">Refresh</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsExportOpen(true)}
            className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-200"
            title="Export doctors to CSV or JSON"
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
              title="Bulk import doctors from CSV spreadsheet"
            >
              <UploadCloud className="h-3.5 w-3.5" />
              <span>Import</span>
            </Button>
          )}

          <Button
            variant="primary"
            size="sm"
            onClick={handleOpenAdd}
            className="flex items-center gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add New Doctor</span>
          </Button>
        </div>
      </div>

      {/* Doctor Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {doctors.length === 0 && !loading ? (
          <div className="col-span-full bg-white dark:bg-slate-900 p-12 text-center text-slate-500 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
            <FileText className="h-10 w-10 text-slate-300 dark:text-slate-700 mx-auto" />
            <p className="font-medium text-xs">No doctors registered yet</p>
            <p className="text-[11px] text-slate-400">Add practicing doctors to begin scheduling appointments.</p>
          </div>
        ) : (
          doctors.map((doc) => {
            const isActive = doc.status === 'ACTIVE';
            return (
              <div
                key={doc.id}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 flex flex-col justify-between space-y-4 hover:shadow-md transition"
              >
                <div>
                  <div className="flex justify-between items-start">
                    <span
                      className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full ${
                        isActive
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                          : 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300'
                      }`}
                    >
                      {doc.status}
                    </span>
                    <span className="font-bold text-sm text-slate-900 dark:text-white font-mono">
                      ₹{(doc.consultationFee ? doc.consultationFee / 100 : 0).toFixed(0)}
                    </span>
                  </div>

                  <h3 className="font-bold text-slate-900 dark:text-white text-base mt-2 flex items-center gap-1.5">
                    <Stethoscope className="h-4 w-4 text-emerald-600" />
                    <span>{doc.displayName}</span>
                  </h3>
                  <p className="text-xs text-slate-500">{doc.qualification}</p>

                  <div className="mt-4 space-y-2 text-xs text-slate-600 dark:text-slate-400">
                    <div className="flex items-center gap-2">
                      <Award className="h-3.5 w-3.5 text-slate-400" />
                      <span className="font-medium text-slate-800 dark:text-slate-200">{doc.specialization}</span>
                    </div>
                    {doc.mobile && (
                      <div className="flex items-center gap-2 font-mono text-[11px]">
                        <Phone className="h-3.5 w-3.5 text-slate-400" />
                        <span>{doc.mobile}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-[11px]">
                      <Shield className="h-3.5 w-3.5 text-slate-400" />
                      <span>Reg No: {doc.registrationNumber || '—'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px]">
                      <Clock className="h-3.5 w-3.5 text-slate-400" />
                      <span>Working Days: </span>
                      {doc.schedules && doc.schedules.length > 0 ? (
                        <span className="font-medium text-slate-800 dark:text-slate-200">
                          {doc.schedules.map((s) => DAYS_OF_WEEK[s.dayOfWeek].slice(0, 3)).join(', ')}
                        </span>
                      ) : (
                        <span className="text-amber-500 font-medium">No schedule set</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-between gap-2">
                  <button
                    onClick={() => handleOpenSchedule(doc)}
                    className="flex-1 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-medium transition flex items-center justify-center gap-1"
                  >
                    <Clock className="h-3.5 w-3.5" />
                    <span>Schedule</span>
                  </button>
                  <button
                    onClick={() => handleOpenEdit(doc)}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-medium transition flex items-center gap-1"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    <span>Edit</span>
                  </button>
                  <button
                    onClick={() => handleToggleDoctorStatus(doc)}
                    className={`px-2.5 py-1.5 text-xs font-medium rounded-lg transition ${
                      isActive
                        ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
                        : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                    }`}
                  >
                    {isActive ? 'Deactivate' : 'Activate'}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal: Add Doctor */}
      {isAddOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/40">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Plus className="h-5 w-5 text-emerald-600" />
                <span>Add New Doctor</span>
              </h3>
              <button
                onClick={() => setIsAddOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold p-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {formError && (
              <div className="m-5 mb-0 p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSaveAdd} className="p-5 space-y-4 text-xs">
              <div>
                <label className="font-semibold block mb-1">Doctor Name (with Dr. Prefix) *</label>
                <input
                  type="text"
                  placeholder="e.g. Dr. Ananya Roy"
                  value={doctorForm.displayName}
                  onChange={(e) => setDoctorForm({ ...doctorForm, displayName: e.target.value })}
                  className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold block mb-1">Qualification</label>
                  <input
                    type="text"
                    placeholder="e.g. MBBS, MD (General Medicine)"
                    value={doctorForm.qualification}
                    onChange={(e) => setDoctorForm({ ...doctorForm, qualification: e.target.value })}
                    className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="font-semibold block mb-1">Specialization *</label>
                  <input
                    type="text"
                    placeholder="e.g. General Medicine, Pediatrics"
                    value={doctorForm.specialization}
                    onChange={(e) => setDoctorForm({ ...doctorForm, specialization: e.target.value })}
                    className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    required
                  />
                </div>

                <div>
                  <label className="font-semibold block mb-1">Medical Registration No.</label>
                  <input
                    type="text"
                    placeholder="e.g. KMC-54321"
                    value={doctorForm.registrationNumber}
                    onChange={(e) => setDoctorForm({ ...doctorForm, registrationNumber: e.target.value })}
                    className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="font-semibold block mb-1">Consultation Fee (₹)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 500"
                    value={doctorForm.consultationFee}
                    onChange={(e) => setDoctorForm({ ...doctorForm, consultationFee: e.target.value })}
                    className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold block mb-1">Contact Mobile</label>
                <input
                  type="text"
                  placeholder="10-digit mobile number"
                  value={doctorForm.mobile}
                  onChange={(e) => setDoctorForm({ ...doctorForm, mobile: e.target.value })}
                  className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-slate-900 dark:text-white"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2.5">
                <Button variant="outline" type="button" onClick={() => setIsAddOpen(false)} className="text-xs">
                  <X className="h-4 w-4 mr-1" /> Cancel
                </Button>
                <Button
                  variant="primary"
                  type="submit"
                  disabled={formSubmitting}
                  className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5"
                >
                  <CheckCircle className="h-4 w-4" />
                  <span>{formSubmitting ? 'Saving...' : 'Add Doctor'}</span>
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Doctor */}
      {isEditOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/40">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Pencil className="h-5 w-5 text-blue-600" />
                <span>Edit Doctor Profile</span>
              </h3>
              <button
                onClick={() => setIsEditOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold p-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {formError && (
              <div className="m-5 mb-0 p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSaveEdit} className="p-5 space-y-4 text-xs">
              <div>
                <label className="font-semibold block mb-1">Doctor Name *</label>
                <input
                  type="text"
                  value={doctorForm.displayName}
                  onChange={(e) => setDoctorForm({ ...doctorForm, displayName: e.target.value })}
                  className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold block mb-1">Qualification</label>
                  <input
                    type="text"
                    value={doctorForm.qualification}
                    onChange={(e) => setDoctorForm({ ...doctorForm, qualification: e.target.value })}
                    className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="font-semibold block mb-1">Specialization *</label>
                  <input
                    type="text"
                    value={doctorForm.specialization}
                    onChange={(e) => setDoctorForm({ ...doctorForm, specialization: e.target.value })}
                    className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    required
                  />
                </div>

                <div>
                  <label className="font-semibold block mb-1">Medical Registration No.</label>
                  <input
                    type="text"
                    value={doctorForm.registrationNumber}
                    onChange={(e) => setDoctorForm({ ...doctorForm, registrationNumber: e.target.value })}
                    className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="font-semibold block mb-1">Consultation Fee (₹)</label>
                  <input
                    type="number"
                    min="0"
                    value={doctorForm.consultationFee}
                    onChange={(e) => setDoctorForm({ ...doctorForm, consultationFee: e.target.value })}
                    className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold block mb-1">Contact Mobile</label>
                <input
                  type="text"
                  value={doctorForm.mobile}
                  onChange={(e) => setDoctorForm({ ...doctorForm, mobile: e.target.value })}
                  className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-slate-900 dark:text-white"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2.5">
                <Button variant="outline" type="button" onClick={() => setIsEditOpen(false)} className="text-xs">
                  <X className="h-4 w-4 mr-1" /> Cancel
                </Button>
                <Button
                  variant="primary"
                  type="submit"
                  disabled={formSubmitting}
                  className="text-xs bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5"
                >
                  <CheckCircle className="h-4 w-4" />
                  <span>{formSubmitting ? 'Saving...' : 'Save Changes'}</span>
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Schedules */}
      {isScheduleOpen && selectedDoctor && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/40">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Clock className="h-5 w-5 text-blue-600" />
                  <span>Availability Schedule: {selectedDoctor.displayName}</span>
                </h3>
                <p className="text-xs text-slate-500">Configure working hours and active consultation slots</p>
              </div>
              <button
                onClick={() => setIsScheduleOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold p-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 space-y-3 max-h-[60vh] overflow-y-auto">
              {schedules.map((s, index) => (
                <div
                  key={s.dayOfWeek}
                  className={`p-3 rounded-xl border flex items-center justify-between gap-4 transition ${
                    s.isActive
                      ? 'bg-blue-50/40 border-blue-200 dark:bg-blue-950/20 dark:border-blue-900'
                      : 'bg-slate-50 border-slate-200 dark:bg-slate-800/40 dark:border-slate-700 opacity-60'
                  }`}
                >
                  <label className="flex items-center gap-2.5 cursor-pointer font-semibold text-xs text-slate-800 dark:text-slate-200 min-w-[90px]">
                    <input
                      type="checkbox"
                      checked={s.isActive}
                      onChange={(e) => {
                        const updated = [...schedules];
                        updated[index].isActive = e.target.checked;
                        setSchedules(updated);
                      }}
                      className="rounded text-blue-600 h-4 w-4"
                    />
                    <span>{DAYS_OF_WEEK[s.dayOfWeek]}</span>
                  </label>

                  <div className="flex items-center gap-2 text-xs">
                    <input
                      type="time"
                      value={s.startTime}
                      disabled={!s.isActive}
                      onChange={(e) => {
                        const updated = [...schedules];
                        updated[index].startTime = e.target.value;
                        setSchedules(updated);
                      }}
                      className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                    <span className="text-slate-400">to</span>
                    <input
                      type="time"
                      value={s.endTime}
                      disabled={!s.isActive}
                      onChange={(e) => {
                        const updated = [...schedules];
                        updated[index].endTime = e.target.value;
                        setSchedules(updated);
                      }}
                      className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="p-5 pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2.5">
              <Button variant="outline" size="sm" onClick={() => setIsScheduleOpen(false)}>
                <X className="h-4 w-4 mr-1" /> Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={formSubmitting}
                onClick={handleSaveSchedules}
                className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5"
              >
                <CheckCircle className="h-4 w-4" />
                <span>{formSubmitting ? 'Saving...' : 'Save Schedules'}</span>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Export Modal */}
      <DataExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        title="Export Doctor Directory"
        entityName="Doctors"
        data={doctors}
        columns={doctorExportColumns}
        currentUser={currentUser}
        defaultFilename={`doctors_directory_${new Date().toISOString().split('T')[0]}`}
      />
    </div>
  );
};
