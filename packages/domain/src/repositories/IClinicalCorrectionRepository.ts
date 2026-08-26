import { ClinicalCorrection, RecordClinicalCorrectionDTO } from '../entities/ClinicalCorrection.js';

export interface IClinicalCorrectionRepository {
  create(dto: RecordClinicalCorrectionDTO): Promise<ClinicalCorrection>;
  listByResource(resourceType: string, resourceId: string, organizationId: string): Promise<ClinicalCorrection[]>;
}
