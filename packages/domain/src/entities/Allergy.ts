export type AllergyStatus = 'KNOWN' | 'DENIED' | 'UNKNOWN';
export type AllergyCategory = 'DRUG' | 'FOOD' | 'ENVIRONMENTAL' | 'OTHER';
export type AllergySeverity = 'MILD' | 'MODERATE' | 'SEVERE' | 'LIFE_THREATENING';

export interface Allergy {
  id: string;
  organizationId: string;
  patientId: string;
  status: AllergyStatus;
  allergenName?: string;
  category: AllergyCategory;
  severity: AllergySeverity;
  reaction?: string;
  notes?: string;
  recordedAt: Date;
  recordedBy?: string;
  updatedAt: Date;
  updatedBy?: string;
}

export type RecordAllergyDTO = {
  id?: string;
  organizationId: string;
  patientId: string;
  status: AllergyStatus;
  allergenName?: string;
  category?: AllergyCategory;
  severity?: AllergySeverity;
  reaction?: string;
  notes?: string;
  recordedBy?: string;
};
