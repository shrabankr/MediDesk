import { Diagnosis, RecordDiagnosisDTO } from '../entities/Diagnosis.js';

export interface IDiagnosisRepository {
  create(dto: RecordDiagnosisDTO): Promise<Diagnosis>;
  findById(id: string, organizationId: string): Promise<Diagnosis | null>;
  findByVisitId(visitId: string, organizationId: string): Promise<Diagnosis[]>;
  listByPatient(patientId: string, organizationId: string): Promise<Diagnosis[]>;
  update(id: string, organizationId: string, dto: Partial<RecordDiagnosisDTO>): Promise<Diagnosis>;
}
