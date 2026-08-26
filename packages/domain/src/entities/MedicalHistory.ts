export type MedicalHistoryCategory =
  | 'PAST_MEDICAL'
  | 'PAST_SURGICAL'
  | 'FAMILY'
  | 'SOCIAL'
  | 'MEDICATION_HISTORY';

export interface MedicalHistory {
  id: string;
  organizationId: string;
  patientId: string;
  category: MedicalHistoryCategory;
  description: string;
  diagnosedDate?: string;
  isActive: boolean;
  notes?: string;
  recordedAt: Date;
  recordedBy?: string;
  updatedAt: Date;
  updatedBy?: string;
}

export type RecordMedicalHistoryDTO = {
  id?: string;
  organizationId: string;
  patientId: string;
  category: MedicalHistoryCategory;
  description: string;
  diagnosedDate?: string;
  isActive?: boolean;
  notes?: string;
  recordedBy?: string;
};
