export type FollowUpStatus = 'PENDING' | 'COMPLETED' | 'CANCELLED';

export interface FollowUp {
  id: string;
  organizationId: string;
  patientId: string;
  doctorId: string;
  clinicalVisitId?: string;
  followUpDate: string; // YYYY-MM-DD
  instructions?: string;
  notes?: string;
  status: FollowUpStatus;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  updatedBy?: string;
}

export type ScheduleFollowUpDTO = {
  id?: string;
  organizationId: string;
  patientId: string;
  doctorId: string;
  clinicalVisitId?: string;
  followUpDate: string;
  instructions?: string;
  notes?: string;
  createdBy?: string;
};
