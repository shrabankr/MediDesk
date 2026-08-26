import React, { useState, useEffect, useCallback } from 'react';
import {
  Appointment,
  AppointmentStatus,
  Doctor,
  Patient,
  TodayMetricsData,
  SessionUser
} from '@medidesk/shared';

interface AppointmentManagementViewProps {
  currentUser: SessionUser;
  initialPatientForBooking?: Patient | null;
  onClearInitialPatient?: () => void;
}

export const AppointmentManagementView: React.FC<AppointmentManagementViewProps> = ({
  currentUser,
  initialPatientForBooking,
  onClearInitialPatient
}) => {
  const [activeTab, setActiveTab] = useState<'queue' | 'calendar'>('queue');
  const [todayDate, setTodayDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('');
  const [doctors, setDoctors] = useState<Doctor[]>([]);

  // Queue Data
  const [queue, setQueue] = useState<Appointment[]>([]);
  const [metrics, setMetrics] = useState<TodayMetricsData>({
    total: 0,
    scheduled: 0,
    checkedIn: 0,
    waiting: 0,
    inConsultation: 0,
    completed: 0,
    cancelled: 0,
    noShow: 0
  });
  const [loading, setLoading] = useState(false);

  // Calendar / All Appointments Data
  const [appointmentsList, setAppointmentsList] = useState<Appointment[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('');

  // Booking Modal State
  const [isBookOpen, setIsBookOpen] = useState(false);
  const [patientSearchQuery, setPatientSearchQuery] = useState('');
  const [patientSearchResults, setPatientSearchResults] = useState<Patient[]>([]);
  const [selectedPatientForBooking, setSelectedPatientForBooking] = useState<Patient | null>(null);

  const [bookingForm, setBookingForm] = useState({
    doctorId: '',
    appointmentDate: new Date().toISOString().split('T')[0],
    startTime: '10:00',
    durationMinutes: 15,
    visitPurpose: '',
    notes: ''
  });
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [bookingSubmitting, setBookingSubmitting] = useState(false);

  const sessionToken = localStorage.getItem('medidesk_session_token') || '';

  // 1. Load active doctors
  const loadDoctors = useCallback(async () => {
    if (!window.mediDeskBridge) return;
    try {
      const res = await window.mediDeskBridge.listDoctors(currentUser.organizationId, sessionToken, true);
      if (res.success && res.data) {
        const docList = res.data;
        setDoctors(docList);
        if (docList.length > 0 && !bookingForm.doctorId) {
          setBookingForm((prev) => ({ ...prev, doctorId: docList[0].id }));
        }
      }
    } catch (err) {
      console.error('Failed to load doctors:', err);
    }
  }, [currentUser.organizationId, sessionToken, bookingForm.doctorId]);

  // 2. Load Waiting Queue & Metrics
  const loadQueueAndMetrics = useCallback(async () => {
    if (!window.mediDeskBridge) return;
    setLoading(true);
    try {
      const [queueRes, metricsRes] = await Promise.all([
        window.mediDeskBridge.getWaitingQueue(
          {
            organizationId: currentUser.organizationId,
            appointmentDate: todayDate,
            doctorId: selectedDoctorId || undefined
          },
          sessionToken
        ),
        window.mediDeskBridge.getTodayMetrics(
          currentUser.organizationId,
          todayDate,
          sessionToken,
          selectedDoctorId || undefined
        )
      ]);

      if (queueRes.success && queueRes.data) {
        setQueue(queueRes.data);
      }
      if (metricsRes.success && metricsRes.data) {
        setMetrics(metricsRes.data);
      }
    } catch (err) {
      console.error('Failed to load queue:', err);
    } finally {
      setLoading(false);
    }
  }, [currentUser.organizationId, todayDate, selectedDoctorId, sessionToken]);

  // 3. Load Calendar / Filtered Appointments
  const loadCalendarAppointments = useCallback(async () => {
    if (!window.mediDeskBridge) return;
    setLoading(true);
    try {
      const res = await window.mediDeskBridge.listAppointments(
        {
          organizationId: currentUser.organizationId,
          startDate: todayDate,
          endDate: todayDate,
          doctorId: selectedDoctorId || undefined,
          status: (filterStatus as AppointmentStatus) || undefined
        },
        sessionToken
      );
      if (res.success && res.data) {
        setAppointmentsList(res.data);
      }
    } catch (err) {
      console.error('Failed to load appointments:', err);
    } finally {
      setLoading(false);
    }
  }, [currentUser.organizationId, todayDate, selectedDoctorId, filterStatus, sessionToken]);

  useEffect(() => {
    loadDoctors();
  }, [loadDoctors]);

  useEffect(() => {
    if (activeTab === 'queue') {
      loadQueueAndMetrics();
    } else {
      loadCalendarAppointments();
    }
  }, [activeTab, loadQueueAndMetrics, loadCalendarAppointments]);

  // Handle external patient booking trigger
  useEffect(() => {
    if (initialPatientForBooking) {
      setSelectedPatientForBooking(initialPatientForBooking);
      setPatientSearchQuery(`${initialPatientForBooking.fullName} (${initialPatientForBooking.patientNumber})`);
      setIsBookOpen(true);
      if (onClearInitialPatient) onClearInitialPatient();
    }
  }, [initialPatientForBooking, onClearInitialPatient]);

  // Patient Search Autocomplete inside Booking Modal
  const handleSearchPatientsForBooking = async (q: string) => {
    setPatientSearchQuery(q);
    if (!q.trim() || !window.mediDeskBridge) {
      setPatientSearchResults([]);
      return;
    }

    try {
      const res = await window.mediDeskBridge.searchPatients(
        { organizationId: currentUser.organizationId, query: q.trim(), limit: 5 },
        sessionToken
      );
      if (res.success && res.data) {
        setPatientSearchResults(res.data);
      }
    } catch (err) {
      console.error('Search failed:', err);
    }
  };

  const handleStatusChange = async (appointmentId: string, status: AppointmentStatus) => {
    if (!window.mediDeskBridge) return;
    try {
      const res = await window.mediDeskBridge.changeAppointmentStatus(
        { appointmentId, status },
        currentUser.organizationId,
        sessionToken
      );
      if (res.success) {
        loadQueueAndMetrics();
        if (activeTab === 'calendar') loadCalendarAppointments();
      } else {
        alert(res.error?.message || 'Failed to update status');
      }
    } catch (err: unknown) {
      alert((err as Error).message || 'Error occurred');
    }
  };

  const handleBookSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatientForBooking) {
      setBookingError('Please search and select a patient first.');
      return;
    }
    if (!bookingForm.doctorId) {
      setBookingError('Please select a doctor.');
      return;
    }

    setBookingSubmitting(true);
    setBookingError(null);

    if (!window.mediDeskBridge) {
      setBookingError('MediDesk Electron Bridge is unavailable.');
      setBookingSubmitting(false);
      return;
    }

    try {
      const res = await window.mediDeskBridge.createAppointment(
        {
          organizationId: currentUser.organizationId,
          patientId: selectedPatientForBooking.id,
          doctorId: bookingForm.doctorId,
          appointmentDate: bookingForm.appointmentDate,
          startTime: bookingForm.startTime,
          durationMinutes: bookingForm.durationMinutes,
          visitPurpose: bookingForm.visitPurpose.trim() || undefined,
          notes: bookingForm.notes.trim() || undefined
        },
        sessionToken
      );

      if (res.success && res.data) {
        setIsBookOpen(false);
        setSelectedPatientForBooking(null);
        setPatientSearchQuery('');
        setBookingForm({
          doctorId: doctors[0]?.id || '',
          appointmentDate: todayDate,
          startTime: '10:00',
          durationMinutes: 15,
          visitPurpose: '',
          notes: ''
        });
        loadQueueAndMetrics();
        if (activeTab === 'calendar') loadCalendarAppointments();
      } else {
        setBookingError(res.error?.message || 'Failed to book appointment');
      }
    } catch (err: unknown) {
      setBookingError((err as Error).message || 'An unexpected error occurred');
    } finally {
      setBookingSubmitting(false);
    }
  };

  const getStatusBadge = (status: AppointmentStatus): string => {
    switch (status) {
      case 'SCHEDULED':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300';
      case 'CHECKED_IN':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300';
      case 'WAITING':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300';
      case 'IN_CONSULTATION':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 animate-pulse';
      case 'COMPLETED':
        return 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300';
      case 'CANCELLED':
        return 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300';
      case 'NO_SHOW':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400';
      default:
        return 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Metric Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span>📅</span> Appointments & Waiting Queue
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Real-time daily patient queue, doctor schedules, and instant conflict detection.
          </p>
        </div>

        <button
          onClick={() => {
            setBookingError(null);
            setIsBookOpen(true);
          }}
          className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg shadow transition flex items-center gap-2"
        >
          <span>➕</span> Book New Appointment
        </button>
      </div>

      {/* Date & Doctor Filter Controls */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('queue')}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition ${
              activeTab === 'queue'
                ? 'bg-blue-600 text-white shadow'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            📋 Today's Queue
          </button>
          <button
            onClick={() => setActiveTab('calendar')}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition ${
              activeTab === 'calendar'
                ? 'bg-blue-600 text-white shadow'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            🗓️ All Appointments
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-500">Date:</span>
            <input
              type="date"
              value={todayDate}
              onChange={(e) => setTodayDate(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded text-xs"
            />
          </div>

          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-500">Doctor:</span>
            <select
              value={selectedDoctorId}
              onChange={(e) => setSelectedDoctorId(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded text-xs"
            >
              <option value="">All Practicing Doctors</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.displayName} ({d.specialization})
                </option>
              ))}
            </select>
          </div>

          {activeTab === 'calendar' && (
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-slate-500">Status:</span>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded text-xs"
              >
                <option value="">All Statuses</option>
                <option value="SCHEDULED">Scheduled</option>
                <option value="CHECKED_IN">Checked In</option>
                <option value="WAITING">Waiting</option>
                <option value="IN_CONSULTATION">In Consultation</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
                <option value="NO_SHOW">No Show</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Metrics Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm text-center">
          <span className="text-xs text-slate-500 block">Total Today</span>
          <span className="text-xl font-extrabold text-slate-900 dark:text-white">{metrics.total}</span>
        </div>
        <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-xl border border-blue-200 dark:border-blue-800 text-center">
          <span className="text-xs text-blue-700 dark:text-blue-300 block">Scheduled</span>
          <span className="text-xl font-extrabold text-blue-700 dark:text-blue-300">{metrics.scheduled}</span>
        </div>
        <div className="bg-purple-50 dark:bg-purple-900/20 p-3 rounded-xl border border-purple-200 dark:border-purple-800 text-center">
          <span className="text-xs text-purple-700 dark:text-purple-300 block">Checked In</span>
          <span className="text-xl font-extrabold text-purple-700 dark:text-purple-300">{metrics.checkedIn}</span>
        </div>
        <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-xl border border-amber-200 dark:border-amber-800 text-center">
          <span className="text-xs text-amber-700 dark:text-amber-300 block">Waiting</span>
          <span className="text-xl font-extrabold text-amber-700 dark:text-amber-300">{metrics.waiting}</span>
        </div>
        <div className="bg-emerald-50 dark:bg-emerald-900/20 p-3 rounded-xl border border-emerald-200 dark:border-emerald-800 text-center">
          <span className="text-xs text-emerald-700 dark:text-emerald-300 block">In Consult</span>
          <span className="text-xl font-extrabold text-emerald-700 dark:text-emerald-300">{metrics.inConsultation}</span>
        </div>
        <div className="bg-slate-50 dark:bg-slate-900/40 p-3 rounded-xl border border-slate-200 dark:border-slate-700 text-center">
          <span className="text-xs text-slate-500 block">Completed</span>
          <span className="text-xl font-extrabold text-slate-700 dark:text-slate-300">{metrics.completed}</span>
        </div>
        <div className="bg-rose-50 dark:bg-rose-900/20 p-3 rounded-xl border border-rose-200 dark:border-rose-800 text-center">
          <span className="text-xs text-rose-700 dark:text-rose-300 block">Cancelled / No-Show</span>
          <span className="text-xl font-extrabold text-rose-700 dark:text-rose-300">
            {metrics.cancelled + metrics.noShow}
          </span>
        </div>
      </div>

      {/* Main Table View */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            {activeTab === 'queue' ? "Today's Patient Queue" : 'Appointments List'} (
            {activeTab === 'queue' ? queue.length : appointmentsList.length})
          </span>
          {loading && <span className="text-xs text-blue-500 animate-pulse">Loading...</span>}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead className="bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 text-xs uppercase font-semibold border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="p-3 w-16 text-center"># Token</th>
                <th className="p-3">Patient</th>
                <th className="p-3">Doctor</th>
                <th className="p-3">Time</th>
                <th className="p-3">Purpose</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Queue Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {(activeTab === 'queue' ? queue : appointmentsList).length === 0 && !loading ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-slate-500">
                    <span className="text-4xl block mb-2">📭</span>
                    <p className="font-medium">No appointments scheduled for this selection</p>
                  </td>
                </tr>
              ) : (
                (activeTab === 'queue' ? queue : appointmentsList).map((apt) => (
                  <tr key={apt.id} className="hover:bg-slate-50 dark:hover:bg-slate-750 transition">
                    <td className="p-3 text-center font-mono font-bold text-base text-blue-600 dark:text-blue-400">
                      #{apt.queueNumber}
                    </td>
                    <td className="p-3">
                      <div className="font-bold text-slate-900 dark:text-white">{apt.patientName || 'Unknown'}</div>
                      <div className="text-xs font-mono text-slate-500">
                        {apt.patientNumber} {apt.patientMobile ? `• ${apt.patientMobile}` : ''}
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="font-medium text-slate-800 dark:text-slate-200">{apt.doctorName}</div>
                      <div className="text-xs text-slate-400">{apt.doctorSpecialization}</div>
                    </td>
                    <td className="p-3 font-mono text-slate-700 dark:text-slate-300">
                      {apt.startTime}–{apt.endTime}
                    </td>
                    <td className="p-3 text-slate-600 dark:text-slate-300 text-xs">
                      {apt.visitPurpose || 'General Consultation'}
                    </td>
                    <td className="p-3">
                      <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${getStatusBadge(apt.status)}`}>
                        {apt.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="p-3 text-right space-x-1.5">
                      {/* State Machine Transition Actions */}
                      {apt.status === 'SCHEDULED' && (
                        <>
                          <button
                            onClick={() => handleStatusChange(apt.id, 'CHECKED_IN')}
                            className="px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded text-xs font-medium"
                          >
                            Check In
                          </button>
                          <button
                            onClick={() => handleStatusChange(apt.id, 'CANCELLED')}
                            className="px-2 py-1 bg-slate-100 hover:bg-rose-100 text-rose-600 rounded text-xs"
                          >
                            Cancel
                          </button>
                        </>
                      )}

                      {apt.status === 'CHECKED_IN' && (
                        <>
                          <button
                            onClick={() => handleStatusChange(apt.id, 'WAITING')}
                            className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-xs font-medium"
                          >
                            Mark Waiting
                          </button>
                          <button
                            onClick={() => handleStatusChange(apt.id, 'IN_CONSULTATION')}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-medium"
                          >
                            Start Consult
                          </button>
                        </>
                      )}

                      {apt.status === 'WAITING' && (
                        <button
                          onClick={() => handleStatusChange(apt.id, 'IN_CONSULTATION')}
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-medium"
                        >
                          Start Consult
                        </button>
                      )}

                      {apt.status === 'IN_CONSULTATION' && (
                        <button
                          onClick={() => handleStatusChange(apt.id, 'COMPLETED')}
                          className="px-3 py-1 bg-slate-800 hover:bg-slate-900 text-white rounded text-xs font-medium"
                        >
                          ✓ Complete
                        </button>
                      )}

                      {(apt.status === 'COMPLETED' || apt.status === 'CANCELLED' || apt.status === 'NO_SHOW') && (
                        <span className="text-xs text-slate-400 italic">Finished</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Book Appointment Modal */}
      {isBookOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="p-5 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>📅</span> Schedule Patient Appointment
              </h3>
              <button
                onClick={() => setIsBookOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleBookSubmit} className="p-6 space-y-4">
              {bookingError && (
                <div className="p-3 bg-rose-50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-800 rounded-lg text-sm text-rose-700 dark:text-rose-300">
                  {bookingError}
                </div>
              )}

              {/* Patient Selector Autocomplete */}
              <div className="relative">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Select Patient *
                </label>
                <input
                  type="text"
                  placeholder="Type name, mobile, or ID to search..."
                  value={patientSearchQuery}
                  onChange={(e) => handleSearchPatientsForBooking(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-sm"
                />

                {patientSearchResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl z-20 max-h-40 overflow-y-auto">
                    {patientSearchResults.map((p) => (
                      <div
                        key={p.id}
                        onClick={() => {
                          setSelectedPatientForBooking(p);
                          setPatientSearchQuery(`${p.fullName} (${p.patientNumber})`);
                          setPatientSearchResults([]);
                        }}
                        className="p-2.5 hover:bg-blue-50 dark:hover:bg-slate-700 cursor-pointer text-xs border-b last:border-0 border-slate-100 dark:border-slate-750 flex justify-between"
                      >
                        <span className="font-bold text-slate-900 dark:text-white">{p.fullName}</span>
                        <span className="font-mono text-blue-600 dark:text-blue-400">{p.patientNumber}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Doctor Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Consulting Doctor *
                </label>
                <select
                  value={bookingForm.doctorId}
                  onChange={(e) => setBookingForm({ ...bookingForm, doctorId: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-sm"
                >
                  {doctors.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.displayName} ({d.specialization}) — Fee: ₹{d.consultationFee}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date & Time */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Appointment Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={bookingForm.appointmentDate}
                    onChange={(e) => setBookingForm({ ...bookingForm, appointmentDate: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Start Time *
                  </label>
                  <input
                    type="time"
                    required
                    value={bookingForm.startTime}
                    onChange={(e) => setBookingForm({ ...bookingForm, startTime: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Visit Purpose
                </label>
                <input
                  type="text"
                  placeholder="e.g. Fever checkup, follow-up, general consult"
                  value={bookingForm.visitPurpose}
                  onChange={(e) => setBookingForm({ ...bookingForm, visitPurpose: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-sm"
                />
              </div>

              <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex justify-end gap-3 -mx-6 -mb-6 mt-4">
                <button
                  type="button"
                  onClick={() => setIsBookOpen(false)}
                  className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={bookingSubmitting}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg shadow disabled:opacity-50"
                >
                  {bookingSubmitting ? 'Verifying & Booking...' : 'Confirm Appointment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
