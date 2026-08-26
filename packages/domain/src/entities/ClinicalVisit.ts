export type ClinicalVisitStatus = 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export interface ClinicalVisit {
  id: string;
  organizationId: string;
  patientId: string;
  doctorId: string;
  appointmentId?: string;
  visitDateTime: Date;
  status: ClinicalVisitStatus;
  chiefComplaint?: string;
  historyOfPresentIllness?: string;
  examinationNotes?: string;
  clinicalAssessment?: string;
  completedAt?: Date;
  hasCorrections: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  updatedBy?: string;
}

export type CreateClinicalVisitDTO = {
  id?: string;
  organizationId: string;
  patientId: string;
  doctorId: string;
  appointmentId?: string;
  visitDateTime?: Date;
  status?: ClinicalVisitStatus;
  chiefComplaint?: string;
  historyOfPresentIllness?: string;
  examinationNotes?: string;
  clinicalAssessment?: string;
  createdBy?: string;
};

export type UpdateClinicalVisitDTO = {
  chiefComplaint?: string;
  historyOfPresentIllness?: string;
  examinationNotes?: string;
  clinicalAssessment?: string;
  status?: ClinicalVisitStatus;
  updatedBy?: string;
};
