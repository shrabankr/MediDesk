export type Sex = 'MALE' | 'FEMALE' | 'OTHER';

export type PatientStatus = 'ACTIVE' | 'INACTIVE' | 'MERGED';

export interface Patient {
  id: string;
  organizationId: string;
  patientNumber: string; // e.g. MD-000001
  fullName: string;
  normalizedName: string;
  dateOfBirth?: string; // YYYY-MM-DD
  age?: number;
  sex: Sex;
  mobile?: string;
  normalizedMobile?: string;
  alternateMobile?: string;
  address?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  status: PatientStatus;
  mergedIntoPatientId?: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  updatedBy?: string;
}

export interface DuplicatePatientMatch {
  patient: Patient;
  confidence: 'STRONG' | 'MEDIUM' | 'LOW';
  matchReason: string;
}
