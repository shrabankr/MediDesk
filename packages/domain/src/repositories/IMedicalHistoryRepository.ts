import { MedicalHistory, RecordMedicalHistoryDTO } from '../entities/MedicalHistory.js';

export interface IMedicalHistoryRepository {
  create(dto: RecordMedicalHistoryDTO): Promise<MedicalHistory>;
  findById(id: string, organizationId: string): Promise<MedicalHistory | null>;
  listByPatient(patientId: string, organizationId: string): Promise<MedicalHistory[]>;
  update(id: string, organizationId: string, dto: Partial<RecordMedicalHistoryDTO>, updatedBy?: string): Promise<MedicalHistory>;
}
