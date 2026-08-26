import React, { useState, useEffect, useCallback } from 'react';
import { Patient, DuplicatePatientMatch, SessionUser } from '@medidesk/shared';

interface PatientManagementViewProps {
  currentUser: SessionUser;
  onBookAppointment?: (patient: Patient) => void;
}

export const PatientManagementView: React.FC<PatientManagementViewProps> = ({
  currentUser,
  onBookAppointment
}) => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);

  // Registration Modal State
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
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

  // Edit Modal State
  const [isEditOpen, setIsEditOpen] = useState(false);
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
          limit: 50
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
          emergencyContactPhone: registerForm.emergencyContactPhone.trim() || undefined,
          forceCreateOnDuplicate: forceCreate
        },
        sessionToken
      );

      if (res.success && res.data) {
        setIsRegisterOpen(false);
        setSelectedPatient(res.data);
        loadPatients(searchQuery);
      } else if (res.error?.code === 'DuplicatePatientWarningError' && res.error.details) {
        setDuplicateMatches(res.error.details as DuplicatePatientMatch[]);
        setShowDuplicateWarning(true);
      } else {
        setFormError(res.error?.message || 'Failed to register patient');
      }
    } catch (err: unknown) {
      setFormError((err as Error).message || 'An unexpected error occurred');
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

  const handleUpdatePatient = async () => {
    if (!selectedPatient || !window.mediDeskBridge) return;
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
        setFormError(res.error?.message || 'Failed to update patient');
      }
    } catch (err: unknown) {
      setFormError((err as Error).message || 'An error occurred during update');
    } finally {
      setFormSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Global Search Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span>👤</span> Patient Directory
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Search, register, and manage patient profiles with duplicate detection.
          </p>
        </div>

        <button
          onClick={handleOpenRegister}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow transition flex items-center gap-2"
        >
          <span>➕</span> Register New Patient
        </button>
      </div>

      {/* Fast Search Input */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
        <form onSubmit={handleSearchSubmit} className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by Patient ID (e.g. MD-000001), Name (e.g. Rahul), or Mobile number..."
            className="w-full pl-11 pr-24 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white text-base focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
          <span className="absolute left-3.5 top-3.5 text-slate-400 text-lg">🔍</span>
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-20 top-3 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 px-2 py-1"
            >
              Clear
            </button>
          )}
          <button
            type="submit"
            className="absolute right-2 top-2 px-4 py-1.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded text-sm font-medium transition"
          >
            Search
          </button>
        </form>
      </div>

      {/* Patient Table & Details Drawer Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Patient List (2 cols) */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              Patients Found ({patients.length})
            </span>
            {loading && <span className="text-xs text-blue-500 animate-pulse">Searching...</span>}
          </div>

          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            {patients.length === 0 && !loading ? (
              <div className="p-12 text-center text-slate-500 dark:text-slate-400">
                <span className="text-4xl block mb-2">📋</span>
                <p className="font-medium">No patients found</p>
                <p className="text-xs text-slate-400 mt-1">
                  Try adjusting your search query or register a new patient.
                </p>
              </div>
            ) : (
              <table className="w-full text-left text-sm border-collapse">
                <thead className="sticky top-0 bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 text-xs uppercase font-semibold border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="p-3">Patient ID</th>
                    <th className="p-3">Full Name</th>
                    <th className="p-3">Gender / Age</th>
                    <th className="p-3">Mobile</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {patients.map((p) => {
                    const isSelected = selectedPatient?.id === p.id;
                    return (
                      <tr
                        key={p.id}
                        onClick={() => setSelectedPatient(p)}
                        className={`cursor-pointer transition hover:bg-blue-50 dark:hover:bg-slate-700/50 ${
                          isSelected ? 'bg-blue-50/80 dark:bg-slate-700/80 border-l-4 border-blue-600' : ''
                        }`}
                      >
                        <td className="p-3 font-mono font-bold text-blue-600 dark:text-blue-400">
                          {p.patientNumber}
                        </td>
                        <td className="p-3 font-medium text-slate-900 dark:text-white">
                          {p.fullName}
                        </td>
                        <td className="p-3 text-slate-600 dark:text-slate-300">
                          {p.sex} {p.age ? `• ${p.age} yrs` : p.dateOfBirth ? `• DOB: ${p.dateOfBirth}` : ''}
                        </td>
                        <td className="p-3 font-mono text-slate-600 dark:text-slate-300">
                          {p.mobile || '—'}
                        </td>
                        <td className="p-3 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedPatient(p);
                            }}
                            className="text-xs px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded font-medium"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Selected Patient Details Drawer (1 col) */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-6 flex flex-col justify-between">
          {selectedPatient ? (
            <div className="space-y-6">
              <div className="flex justify-between items-start border-b border-slate-100 dark:border-slate-700 pb-4">
                <div>
                  <span className="text-xs font-mono font-bold px-2 py-0.5 bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300 rounded">
                    {selectedPatient.patientNumber}
                  </span>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                    {selectedPatient.fullName}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Status: <span className="text-emerald-600 font-semibold">{selectedPatient.status}</span>
                  </p>
                </div>

                <button
                  onClick={() => handleOpenEdit(selectedPatient)}
                  className="px-3 py-1.5 text-xs bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded font-medium transition"
                >
                  ✏️ Edit Profile
                </button>
              </div>

              {/* Patient Demographics */}
              <div className="space-y-3 text-sm">
                <div className="flex justify-between py-1 border-b border-slate-50 dark:border-slate-750">
                  <span className="text-slate-500 dark:text-slate-400">Gender:</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200">{selectedPatient.sex}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-50 dark:border-slate-750">
                  <span className="text-slate-500 dark:text-slate-400">Age / DOB:</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200">
                    {selectedPatient.age ? `${selectedPatient.age} years` : '—'}{' '}
                    {selectedPatient.dateOfBirth ? `(${selectedPatient.dateOfBirth})` : ''}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-50 dark:border-slate-750">
                  <span className="text-slate-500 dark:text-slate-400">Primary Mobile:</span>
                  <span className="font-mono font-medium text-slate-800 dark:text-slate-200">
                    {selectedPatient.mobile || '—'}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-50 dark:border-slate-750">
                  <span className="text-slate-500 dark:text-slate-400">Alternate Contact:</span>
                  <span className="font-mono text-slate-800 dark:text-slate-200">
                    {selectedPatient.alternateMobile || '—'}
                  </span>
                </div>
                <div className="py-1 border-b border-slate-50 dark:border-slate-750">
                  <span className="text-slate-500 dark:text-slate-400 block text-xs mb-0.5">Address:</span>
                  <span className="text-slate-800 dark:text-slate-200">{selectedPatient.address || '—'}</span>
                </div>
                <div className="py-1">
                  <span className="text-slate-500 dark:text-slate-400 block text-xs mb-0.5">Emergency Contact:</span>
                  <span className="text-slate-800 dark:text-slate-200">
                    {selectedPatient.emergencyContactName ? (
                      <>
                        {selectedPatient.emergencyContactName}{' '}
                        {selectedPatient.emergencyContactPhone && (
                          <span className="font-mono text-xs text-slate-500">
                            ({selectedPatient.emergencyContactPhone})
                          </span>
                        )}
                      </>
                    ) : (
                      '—'
                    )}
                  </span>
                </div>
              </div>

              {/* Action: Book Appointment */}
              {onBookAppointment && (
                <button
                  onClick={() => onBookAppointment(selectedPatient)}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg shadow transition flex items-center justify-center gap-2 text-sm mt-4"
                >
                  <span>📅</span> Book Appointment for Patient
                </button>
              )}
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-400">
              <span className="text-4xl block mb-2">👈</span>
              <p className="font-medium text-slate-600 dark:text-slate-300">Select a Patient</p>
              <p className="text-xs mt-1">Click any patient row in the table to view their complete profile.</p>
            </div>
          )}
        </div>
      </div>

      {/* Registration Modal with Duplicate Warning Dialog */}
      {isRegisterOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 w-full max-w-xl rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-5 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>➕</span> New Patient Registration
              </h3>
              <button
                onClick={() => setIsRegisterOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              {formError && (
                <div className="p-3 bg-rose-50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-800 rounded-lg text-sm text-rose-700 dark:text-rose-300">
                  {formError}
                </div>
              )}

              {/* Duplicate Detection Alert & Decision Flow */}
              {showDuplicateWarning && duplicateMatches.length > 0 && (
                <div className="p-4 bg-amber-50 dark:bg-amber-900/40 border-2 border-amber-400 rounded-xl space-y-3">
                  <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200 font-bold text-sm">
                    <span className="text-lg">⚠️</span> Possible Existing Patient Found!
                  </div>
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    We detected matching patient records in the clinic directory. Please verify to avoid creating duplicate records:
                  </p>

                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {duplicateMatches.map((m) => (
                      <div
                        key={m.patient.id}
                        className="p-3 bg-white dark:bg-slate-800 rounded-lg border border-amber-200 dark:border-amber-700 flex justify-between items-center"
                      >
                        <div>
                          <div className="font-bold text-sm text-slate-900 dark:text-white">
                            {m.patient.fullName}{' '}
                            <span className="font-mono text-xs text-blue-600 dark:text-blue-400">
                              ({m.patient.patientNumber})
                            </span>
                          </div>
                          <div className="text-xs text-slate-500">
                            Mobile: <span className="font-mono">{m.patient.mobile || 'None'}</span> • {m.patient.sex} •{' '}
                            {m.matchReason}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setSelectedPatient(m.patient);
                            setIsRegisterOpen(false);
                          }}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded shadow transition"
                        >
                          Use Existing
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="pt-2 flex justify-end gap-2 border-t border-amber-200 dark:border-amber-700/60">
                    <button
                      type="button"
                      onClick={() => handleSavePatient(true)}
                      disabled={formSubmitting}
                      className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded transition"
                    >
                      {formSubmitting ? 'Creating...' : 'Ignore & Create New Patient'}
                    </button>
                  </div>
                </div>
              )}

              {/* Registration Form Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={registerForm.fullName}
                    onChange={(e) => setRegisterForm({ ...registerForm, fullName: e.target.value })}
                    placeholder="e.g. Rahul Sharma"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Gender *
                  </label>
                  <select
                    value={registerForm.sex}
                    onChange={(e) => setRegisterForm({ ...registerForm, sex: e.target.value as 'MALE' | 'FEMALE' | 'OTHER' })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Age (Years)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="130"
                    value={registerForm.age}
                    onChange={(e) => setRegisterForm({ ...registerForm, age: e.target.value })}
                    placeholder="e.g. 32"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Mobile Number
                  </label>
                  <input
                    type="tel"
                    value={registerForm.mobile}
                    onChange={(e) => setRegisterForm({ ...registerForm, mobile: e.target.value })}
                    placeholder="10-digit mobile number"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Date of Birth
                  </label>
                  <input
                    type="date"
                    value={registerForm.dateOfBirth}
                    onChange={(e) => setRegisterForm({ ...registerForm, dateOfBirth: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Address / Area
                  </label>
                  <input
                    type="text"
                    value={registerForm.address}
                    onChange={(e) => setRegisterForm({ ...registerForm, address: e.target.value })}
                    placeholder="e.g. 14 MG Road, Ward 5"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsRegisterOpen(false)}
                className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleSavePatient(false)}
                disabled={formSubmitting}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg shadow transition disabled:opacity-50"
              >
                {formSubmitting ? 'Verifying & Saving...' : 'Save Patient'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Patient Modal */}
      {isEditOpen && selectedPatient && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="p-5 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>✏️</span> Edit Profile ({selectedPatient.patientNumber})
              </h3>
              <button
                onClick={() => setIsEditOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
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
                  Full Name *
                </label>
                <input
                  type="text"
                  value={editForm.fullName}
                  onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Gender</label>
                  <select
                    value={editForm.sex}
                    onChange={(e) => setEditForm({ ...editForm, sex: e.target.value as 'MALE' | 'FEMALE' | 'OTHER' })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-sm"
                  >
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Age</label>
                  <input
                    type="number"
                    value={editForm.age}
                    onChange={(e) => setEditForm({ ...editForm, age: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Mobile</label>
                <input
                  type="tel"
                  value={editForm.mobile}
                  onChange={(e) => setEditForm({ ...editForm, mobile: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Address</label>
                <input
                  type="text"
                  value={editForm.address}
                  onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
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
                onClick={handleUpdatePatient}
                disabled={formSubmitting}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg shadow disabled:opacity-50"
              >
                {formSubmitting ? 'Updating...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
