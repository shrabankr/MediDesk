import { Allergy, RecordAllergyDTO } from '../entities/Allergy.js';

export interface IAllergyRepository {
  create(dto: RecordAllergyDTO): Promise<Allergy>;
  findById(id: string, organizationId: string): Promise<Allergy | null>;
  listByPatient(patientId: string, organizationId: string): Promise<Allergy[]>;
  update(id: string, organizationId: string, dto: Partial<RecordAllergyDTO>, updatedBy?: string): Promise<Allergy>;
  delete(id: string, organizationId: string): Promise<void>;
}
