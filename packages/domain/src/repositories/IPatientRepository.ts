import { Patient, DuplicatePatientMatch, PatientStatus } from '../entities/Patient.js';

export interface CreatePatientDTO {
  organizationId: string;
  fullName: string;
  dateOfBirth?: string;
  age?: number;
  sex: 'MALE' | 'FEMALE' | 'OTHER';
  mobile?: string;
  alternateMobile?: string;
  address?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  createdBy?: string;
}

export interface UpdatePatientDTO {
  fullName?: string;
  dateOfBirth?: string;
  age?: number;
  sex?: 'MALE' | 'FEMALE' | 'OTHER';
  mobile?: string;
  alternateMobile?: string;
  address?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  status?: PatientStatus;
  mergedIntoPatientId?: string;
  updatedBy?: string;
}

export interface PatientSearchParams {
  organizationId: string;
  query?: string;
  status?: PatientStatus;
  limit?: number;
  offset?: number;
}

export interface IPatientRepository {
  create(dto: CreatePatientDTO): Promise<Patient>;
  findById(id: string): Promise<Patient | null>;
  findByPatientNumber(organizationId: string, patientNumber: string): Promise<Patient | null>;
  search(params: PatientSearchParams): Promise<Patient[]>;
  findPotentialDuplicates(organizationId: string, criteria: {
    fullName: string;
    mobile?: string;
    dateOfBirth?: string;
    sex?: string;
    excludePatientId?: string;
  }): Promise<DuplicatePatientMatch[]>;
  update(id: string, dto: UpdatePatientDTO): Promise<Patient>;
  count(organizationId: string): Promise<number>;
  getNextPatientNumber(organizationId: string): Promise<string>;
}
