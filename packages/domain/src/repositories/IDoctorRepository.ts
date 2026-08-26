import { Doctor, DoctorSchedule, DoctorStatus } from '../entities/Doctor.js';

export interface CreateDoctorDTO {
  organizationId: string;
  userId?: string;
  displayName: string;
  qualification: string;
  specialization: string;
  registrationNumber?: string;
  mobile?: string;
  consultationFee?: number;
  createdBy?: string;
}

export interface UpdateDoctorDTO {
  displayName?: string;
  qualification?: string;
  specialization?: string;
  registrationNumber?: string;
  mobile?: string;
  consultationFee?: number;
  status?: DoctorStatus;
  userId?: string;
  updatedBy?: string;
}

export interface SetDoctorScheduleItem {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  slotDurationMinutes?: number;
  isActive?: boolean;
}

export interface IDoctorRepository {
  create(dto: CreateDoctorDTO): Promise<Doctor>;
  findById(id: string): Promise<Doctor | null>;
  findByUserId(userId: string): Promise<Doctor | null>;
  listByOrganization(organizationId: string, options?: { activeOnly?: boolean }): Promise<Doctor[]>;
  update(id: string, dto: UpdateDoctorDTO): Promise<Doctor>;
  setSchedules(doctorId: string, schedules: SetDoctorScheduleItem[]): Promise<DoctorSchedule[]>;
  getSchedules(doctorId: string): Promise<DoctorSchedule[]>;
}
