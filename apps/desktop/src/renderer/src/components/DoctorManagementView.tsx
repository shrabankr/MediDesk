import React, { useState, useEffect, useCallback } from 'react';
import { Doctor, SessionUser } from '@medidesk/shared';

interface DoctorManagementViewProps {
  currentUser: SessionUser;
}

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const DoctorManagementView: React.FC<DoctorManagementViewProps> = ({ currentUser }) => {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);

  // Add / Edit Modal State
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
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
      qualification: '',
      specialization: '',
      registrationNumber: '',
      mobile: '',
      consultationFee: '0'
    });
    setFormError(null);
    setIsAddOpen(true);
  };

  const handleCreateDoctor = async () => {
    if (!window.mediDeskBridge) return;
    if (!doctorForm.displayName.trim() || !doctorForm.qualification.trim() || !doctorForm.specialization.trim()) {
      setFormError('Display name, qualification, and specialization are required.');
      return;
    }

    setFormSubmitting(true);
    setFormError(null);

    try {
      const res = await window.mediDeskBridge.createDoctor(
        {
          organizationId: currentUser.organizationId,
          displayName: doctorForm.displayName.trim(),
          qualification: doctorForm.qualification.trim(),
          specialization: doctorForm.specialization.trim(),
          registrationNumber: doctorForm.registrationNumber.trim() || undefined,
          mobile: doctorForm.mobile.trim() || undefined,
          consultationFee: parseFloat(doctorForm.consultationFee) || 0
        },
        sessionToken
      );

      if (res.success && res.data) {
        setIsAddOpen(false);
        setSelectedDoctor(res.data);
        loadDoctors();
      } else {
        setFormError(res.error?.message || 'Failed to create doctor');
      }
    } catch (err: unknown) {
      setFormError((err as Error).message || 'An unexpected error occurred');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleOpenEdit = (doctor: Doctor) => {
    setSelectedDoctor(doctor);
    setDoctorForm({
      displayName: doctor.displayName,
      qualification: doctor.qualification,
      specialization: doctor.specialization,
      registrationNumber: doctor.registrationNumber || '',
      mobile: doctor.mobile || '',
      consultationFee: String(doctor.consultationFee)
    });
    setFormError(null);
    setIsEditOpen(true);
  };

  const handleUpdateDoctor = async () => {
    if (!selectedDoctor || !window.mediDeskBridge) return;
    setFormSubmitting(true);
    setFormError(null);

    try {
      const res = await window.mediDeskBridge.updateDoctor(
        {
          doctorId: selectedDoctor.id,
          displayName: doctorForm.displayName.trim(),
          qualification: doctorForm.qualification.trim(),
          specialization: doctorForm.specialization.trim(),
          registrationNumber: doctorForm.registrationNumber.trim() || undefined,
          mobile: doctorForm.mobile.trim() || undefined,
          consultationFee: parseFloat(doctorForm.consultationFee) || 0
        },
        currentUser.organizationId,
        sessionToken
      );

      if (res.success && res.data) {
        setIsEditOpen(false);
        setSelectedDoctor(res.data);
        loadDoctors();
      } else {
        setFormError(res.error?.message || 'Failed to update doctor');
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span>🩺</span> Doctor Directory & Schedules
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Manage practicing clinic doctors, consultation fees, and weekly availability schedules.
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow transition flex items-center gap-2"
        >
          <span>➕</span> Add New Doctor
        </button>
      </div>

      {/* Doctor Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {doctors.length === 0 && !loading ? (
          <div className="col-span-full bg-white dark:bg-slate-800 p-12 text-center text-slate-500 rounded-xl border border-slate-200 dark:border-slate-700">
            <span className="text-4xl block mb-2">👨‍⚕️</span>
            <p className="font-medium">No doctors registered yet</p>
            <p className="text-xs text-slate-400 mt-1">Add practicing doctors to begin scheduling appointments.</p>
          </div>
        ) : (
          doctors.map((doc) => {
            const isActive = doc.status === 'ACTIVE';
            return (
              <div
                key={doc.id}
                className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-5 flex flex-col justify-between space-y-4 hover:shadow-md transition"
              >
                <div>
                  <div className="flex justify-between items-start">
                    <span
                      className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                        isActive
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                          : 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300'
                      }`}
                    >
                      {doc.status}
                    </span>

                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Fee: ₹{doc.consultationFee}
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-2">
                    {doc.displayName}
                  </h3>
                  <p className="text-xs font-medium text-blue-600 dark:text-blue-400">
                    {doc.specialization} • {doc.qualification}
                  </p>

                  <div className="mt-4 space-y-1 text-xs text-slate-600 dark:text-slate-300 border-t border-slate-100 dark:border-slate-700 pt-3">
                    <div>
                      <span className="text-slate-400">Mobile:</span> {doc.mobile || '—'}
                    </div>
                    <div>
                      <span className="text-slate-400">Reg No:</span> {doc.registrationNumber || '—'}
                    </div>
                    <div>
                      <span className="text-slate-400">Working Days:</span>{' '}
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

                <div className="pt-3 border-t border-slate-100 dark:border-slate-700 flex justify-between gap-2">
                  <button
                    onClick={() => handleOpenSchedule(doc)}
                    className="flex-1 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded text-xs font-medium transition"
                  >
                    ⏰ Schedule
                  </button>
                  <button
                    onClick={() => handleOpenEdit(doc)}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded text-xs font-medium transition"
                  >
                    ✏️ Edit
                  </button>
                  <button
                    onClick={() => handleToggleDoctorStatus(doc)}
                    className={`px-2.5 py-1.5 text-xs font-medium rounded transition ${
                      isActive
                        ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300'
                        : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
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

      {/* Add Doctor Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="p-5 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>➕</span> Add New Doctor
              </h3>
              <button
                onClick={() => setIsAddOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-rose-50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-800 rounded-lg text-sm text-rose-700 dark:text-rose-300">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Full Display Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Dr. Rajesh Sharma"
                  value={doctorForm.displayName}
                  onChange={(e) => setDoctorForm({ ...doctorForm, displayName: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Specialization *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. General Medicine"
                    value={doctorForm.specialization}
                    onChange={(e) => setDoctorForm({ ...doctorForm, specialization: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Qualification *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. MBBS, MD"
                    value={doctorForm.qualification}
                    onChange={(e) => setDoctorForm({ ...doctorForm, qualification: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Mobile Number
                  </label>
                  <input
                    type="tel"
                    placeholder="10-digit mobile"
                    value={doctorForm.mobile}
                    onChange={(e) => setDoctorForm({ ...doctorForm, mobile: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Consultation Fee (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 500"
                    value={doctorForm.consultationFee}
                    onChange={(e) => setDoctorForm({ ...doctorForm, consultationFee: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Medical Registration Number
                </label>
                <input
                  type="text"
                  placeholder="e.g. MCI-12345"
                  value={doctorForm.registrationNumber}
                  onChange={(e) => setDoctorForm({ ...doctorForm, registrationNumber: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-sm"
                />
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsAddOpen(false)}
                className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateDoctor}
                disabled={formSubmitting}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg shadow disabled:opacity-50"
              >
                {formSubmitting ? 'Saving...' : 'Save Doctor'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Doctor Modal */}
      {isEditOpen && selectedDoctor && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="p-5 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>✏️</span> Edit Doctor Profile
              </h3>
              <button
                onClick={() => setIsEditOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-rose-50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-800 rounded-lg text-sm text-rose-700 dark:text-rose-300">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Full Display Name *
                </label>
                <input
                  type="text"
                  value={doctorForm.displayName}
                  onChange={(e) => setDoctorForm({ ...doctorForm, displayName: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Specialization *
                  </label>
                  <input
                    type="text"
                    value={doctorForm.specialization}
                    onChange={(e) => setDoctorForm({ ...doctorForm, specialization: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Qualification *
                  </label>
                  <input
                    type="text"
                    value={doctorForm.qualification}
                    onChange={(e) => setDoctorForm({ ...doctorForm, qualification: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Mobile Number
                  </label>
                  <input
                    type="tel"
                    value={doctorForm.mobile}
                    onChange={(e) => setDoctorForm({ ...doctorForm, mobile: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Consultation Fee (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={doctorForm.consultationFee}
                    onChange={(e) => setDoctorForm({ ...doctorForm, consultationFee: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Medical Registration Number
                </label>
                <input
                  type="text"
                  value={doctorForm.registrationNumber}
                  onChange={(e) => setDoctorForm({ ...doctorForm, registrationNumber: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-sm"
                />
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsEditOpen(false)}
                className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUpdateDoctor}
                disabled={formSubmitting}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg shadow disabled:opacity-50"
              >
                {formSubmitting ? 'Updating...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Weekly Schedule Manager Modal */}
      {isScheduleOpen && selectedDoctor && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="p-5 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>⏰</span> Weekly Schedule — {selectedDoctor.displayName}
                </h3>
                <p className="text-xs text-slate-500">
                  Specify working days and consultation hours for appointment availability.
                </p>
              </div>
              <button
                onClick={() => setIsScheduleOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-3 max-h-[60vh] overflow-y-auto">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-sm text-rose-700">
                  {formError}
                </div>
              )}

              {schedules.map((s, idx) => (
                <div
                  key={s.dayOfWeek}
                  className={`p-3 rounded-xl border flex items-center justify-between gap-4 transition ${
                    s.isActive
                      ? 'bg-blue-50/50 dark:bg-slate-700/40 border-blue-200 dark:border-blue-800'
                      : 'bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-750 opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-3 w-36">
                    <input
                      type="checkbox"
                      id={`day-${s.dayOfWeek}`}
                      checked={s.isActive}
                      onChange={(e) => {
                        const updated = [...schedules];
                        updated[idx].isActive = e.target.checked;
                        setSchedules(updated);
                      }}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                    />
                    <label
                      htmlFor={`day-${s.dayOfWeek}`}
                      className="text-sm font-semibold text-slate-900 dark:text-white cursor-pointer"
                    >
                      {DAYS_OF_WEEK[s.dayOfWeek]}
                    </label>
                  </div>

                  {s.isActive ? (
                    <div className="flex items-center gap-2 text-xs">
                      <span>From:</span>
                      <input
                        type="time"
                        value={s.startTime}
                        onChange={(e) => {
                          const updated = [...schedules];
                          updated[idx].startTime = e.target.value;
                          setSchedules(updated);
                        }}
                        className="px-2 py-1 bg-white dark:bg-slate-800 border rounded text-xs"
                      />
                      <span>To:</span>
                      <input
                        type="time"
                        value={s.endTime}
                        onChange={(e) => {
                          const updated = [...schedules];
                          updated[idx].endTime = e.target.value;
                          setSchedules(updated);
                        }}
                        className="px-2 py-1 bg-white dark:bg-slate-800 border rounded text-xs"
                      />
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400 italic">Not Available / Off</span>
                  )}
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsScheduleOpen(false)}
                className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveSchedules}
                disabled={formSubmitting}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg shadow disabled:opacity-50"
              >
                {formSubmitting ? 'Saving...' : 'Save Schedules'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
