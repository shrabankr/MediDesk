import { Vitals, RecordVitalsDTO } from '../entities/Vitals.js';

export interface IVitalsRepository {
  create(dto: RecordVitalsDTO): Promise<Vitals>;
  findById(id: string, organizationId: string): Promise<Vitals | null>;
  findByVisitId(visitId: string, organizationId: string): Promise<Vitals[]>;
  listByPatient(patientId: string, organizationId: string, limit?: number): Promise<Vitals[]>;
  getLatestByPatient(patientId: string, organizationId: string): Promise<Vitals | null>;
}
