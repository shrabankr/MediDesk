export type AppointmentStatus =
  | 'SCHEDULED'
  | 'CHECKED_IN'
  | 'WAITING'
  | 'IN_CONSULTATION'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'NO_SHOW';

export interface Appointment {
  id: string;
  organizationId: string;
  patientId: string;
  doctorId: string;
  appointmentDate: string; // YYYY-MM-DD
  startTime: string;       // HH:MM
  endTime: string;         // HH:MM
  durationMinutes: number;
  status: AppointmentStatus;
  queueNumber: number;
  visitPurpose?: string;
  notes?: string;          // Strictly non-clinical notes
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  updatedBy?: string;

  // Joined presentation data (optional)
  patientName?: string;
  patientNumber?: string;
  patientMobile?: string;
  doctorName?: string;
  doctorSpecialization?: string;
}
