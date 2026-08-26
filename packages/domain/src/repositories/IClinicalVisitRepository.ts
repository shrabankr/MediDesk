import { ClinicalVisit, CreateClinicalVisitDTO, UpdateClinicalVisitDTO } from '../entities/ClinicalVisit.js';

export interface IClinicalVisitRepository {
  create(dto: CreateClinicalVisitDTO): Promise<ClinicalVisit>;
  findById(id: string, organizationId: string): Promise<ClinicalVisit | null>;
  findByAppointmentId(appointmentId: string, organizationId: string): Promise<ClinicalVisit | null>;
  listByPatient(patientId: string, organizationId: string, limit?: number): Promise<ClinicalVisit[]>;
  update(id: string, organizationId: string, dto: UpdateClinicalVisitDTO): Promise<ClinicalVisit>;
  complete(id: string, organizationId: string, completedBy: string): Promise<ClinicalVisit>;
  cancel(id: string, organizationId: string, cancelledBy: string): Promise<ClinicalVisit>;
}
