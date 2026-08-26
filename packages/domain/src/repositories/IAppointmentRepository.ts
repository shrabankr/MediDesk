import { Appointment, AppointmentStatus } from '../entities/Appointment.js';

export interface CreateAppointmentDTO {
  organizationId: string;
  patientId: string;
  doctorId: string;
  appointmentDate: string; // YYYY-MM-DD
  startTime: string;       // HH:MM
  endTime: string;         // HH:MM
  durationMinutes?: number;
  status?: AppointmentStatus;
  queueNumber?: number;
  visitPurpose?: string;
  notes?: string;
  createdBy?: string;
}

export interface UpdateAppointmentDTO {
  doctorId?: string;
  appointmentDate?: string;
  startTime?: string;
  endTime?: string;
  durationMinutes?: number;
  status?: AppointmentStatus;
  queueNumber?: number;
  visitPurpose?: string;
  notes?: string;
  updatedBy?: string;
}

export interface AppointmentFilterParams {
  organizationId: string;
  startDate?: string;
  endDate?: string;
  doctorId?: string;
  patientId?: string;
  status?: AppointmentStatus;
  limit?: number;
  offset?: number;
}

export interface IAppointmentRepository {
  create(dto: CreateAppointmentDTO): Promise<Appointment>;
  findById(id: string): Promise<Appointment | null>;
  list(filter: AppointmentFilterParams): Promise<Appointment[]>;
  listQueueByDate(organizationId: string, appointmentDate: string, doctorId?: string): Promise<Appointment[]>;
  findDoctorConflicts(
    doctorId: string,
    appointmentDate: string,
    startTime: string,
    endTime: string,
    excludeAppointmentId?: string
  ): Promise<Appointment[]>;
  update(id: string, dto: UpdateAppointmentDTO): Promise<Appointment>;
  updateStatus(id: string, status: AppointmentStatus, updatedBy?: string): Promise<Appointment>;
  getNextQueueNumber(organizationId: string, appointmentDate: string, doctorId: string): Promise<number>;
  countTodayMetrics(organizationId: string, appointmentDate: string, doctorId?: string): Promise<{
    total: number;
    scheduled: number;
    checkedIn: number;
    waiting: number;
    inConsultation: number;
    completed: number;
    cancelled: number;
    noShow: number;
  }>;
}
