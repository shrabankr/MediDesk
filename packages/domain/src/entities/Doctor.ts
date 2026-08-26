export type DoctorStatus = 'ACTIVE' | 'INACTIVE';

export interface DoctorSchedule {
  id: string;
  doctorId: string;
  dayOfWeek: number; // 0=Sunday, 1=Monday, ..., 6=Saturday
  startTime: string; // HH:MM (24h)
  endTime: string;   // HH:MM (24h)
  slotDurationMinutes: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Doctor {
  id: string;
  organizationId: string;
  userId?: string; // Optional linkage to user login
  displayName: string;
  qualification: string;
  specialization: string;
  registrationNumber?: string;
  mobile?: string;
  consultationFee: number;
  status: DoctorStatus;
  schedules?: DoctorSchedule[];
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  updatedBy?: string;
}
