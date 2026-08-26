import { FollowUp, ScheduleFollowUpDTO, FollowUpStatus } from '../entities/FollowUp.js';

export interface IFollowUpRepository {
  create(dto: ScheduleFollowUpDTO): Promise<FollowUp>;
  findById(id: string, organizationId: string): Promise<FollowUp | null>;
  findByVisitId(visitId: string, organizationId: string): Promise<FollowUp[]>;
  listByPatient(patientId: string, organizationId: string): Promise<FollowUp[]>;
  listDueFollowUps(organizationId: string, fromDate: string, toDate: string, doctorId?: string): Promise<FollowUp[]>;
  updateStatus(id: string, organizationId: string, status: FollowUpStatus, updatedBy?: string): Promise<FollowUp>;
}
