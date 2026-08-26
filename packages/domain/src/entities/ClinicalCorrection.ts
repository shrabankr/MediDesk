export type ClinicalCorrectionResourceType = 'CLINICAL_VISIT' | 'PRESCRIPTION';

export interface ClinicalCorrection {
  id: string;
  organizationId: string;
  resourceType: ClinicalCorrectionResourceType;
  resourceId: string;
  priorStateJson: string;
  correctedStateJson: string;
  reason: string;
  requestedBy: string;
  approvedBy?: string;
  createdAt: Date;
}

export type RecordClinicalCorrectionDTO = {
  id?: string;
  organizationId: string;
  resourceType: ClinicalCorrectionResourceType;
  resourceId: string;
  priorStateJson: string;
  correctedStateJson: string;
  reason: string;
  requestedBy: string;
  approvedBy?: string;
};
