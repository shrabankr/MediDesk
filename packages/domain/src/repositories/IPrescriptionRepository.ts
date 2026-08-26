import {
  Prescription,
  PrescriptionVersion,
  CreatePrescriptionDTO,
  RevisePrescriptionDTO
} from '../entities/Prescription.js';

export interface IPrescriptionRepository {
  create(dto: CreatePrescriptionDTO): Promise<Prescription>;
  findById(id: string, organizationId: string): Promise<Prescription | null>;
  findByVisitId(visitId: string, organizationId: string): Promise<Prescription | null>;
  listByPatient(patientId: string, organizationId: string, limit?: number): Promise<Prescription[]>;
  sign(id: string, organizationId: string, signedBy: string): Promise<Prescription>;
  revise(dto: RevisePrescriptionDTO, organizationId: string): Promise<Prescription>;
  cancel(id: string, organizationId: string, cancelledBy: string, reason?: string): Promise<Prescription>;
  getVersions(prescriptionId: string, organizationId: string): Promise<PrescriptionVersion[]>;
}
