export type PrescriptionStatus = 'DRAFT' | 'SIGNED' | 'CANCELLED' | 'SUPERSEDED';
export type PrescriptionVersionStatus = 'ACTIVE' | 'SUPERSEDED' | 'CANCELLED';

export type DosageForm =
  | 'TABLET'
  | 'CAPSULE'
  | 'SYRUP'
  | 'INJECTION'
  | 'DROPS'
  | 'OINTMENT'
  | 'INHALER'
  | 'OTHER';

export type RouteOfAdministration =
  | 'ORAL'
  | 'TOPICAL'
  | 'INTRAVENOUS'
  | 'INTRAMUSCULAR'
  | 'INHALATION'
  | 'OPHTHALMIC'
  | 'SUBLINGUAL'
  | 'OTHER';

export type DurationUnit = 'DAYS' | 'WEEKS' | 'MONTHS';

export interface MedicineReference {
  medicineName: string;
  genericName?: string;
  strength?: string;
  dosageForm: DosageForm;
  route: RouteOfAdministration;
}

export interface PrescriptionItem extends MedicineReference {
  id: string;
  prescriptionVersionId: string;
  frequency: string; // e.g. 1-0-1, Once daily, TDS
  durationValue?: number;
  durationUnit: DurationUnit;
  instructions?: string; // e.g. After meals
  quantity?: number;
  isSubstitutionAllowed: boolean;
  createdAt: Date;
}

export interface PrescriptionVersion {
  id: string;
  prescriptionId: string;
  versionNumber: number;
  status: PrescriptionVersionStatus;
  reasonForChange?: string;
  notes?: string;
  items: PrescriptionItem[];
  createdAt: Date;
  createdBy?: string;
}

export interface Prescription {
  id: string;
  organizationId: string;
  patientId: string;
  doctorId: string;
  clinicalVisitId?: string;
  status: PrescriptionStatus;
  currentVersionNumber: number;
  currentVersion?: PrescriptionVersion;
  versions?: PrescriptionVersion[];
  signedAt?: Date;
  signedBy?: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  updatedBy?: string;
}

export type CreatePrescriptionItemDTO = MedicineReference & {
  frequency: string;
  durationValue?: number;
  durationUnit?: DurationUnit;
  instructions?: string;
  quantity?: number;
  isSubstitutionAllowed?: boolean;
};

export type CreatePrescriptionDTO = {
  id?: string;
  organizationId: string;
  patientId: string;
  doctorId: string;
  clinicalVisitId?: string;
  items: CreatePrescriptionItemDTO[];
  notes?: string;
  createdBy?: string;
};

export type RevisePrescriptionDTO = {
  prescriptionId: string;
  reasonForChange: string;
  items: CreatePrescriptionItemDTO[];
  notes?: string;
  updatedBy?: string;
};
