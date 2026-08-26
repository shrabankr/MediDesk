export type DiagnosisType = 'PRIMARY' | 'SECONDARY' | 'PROVISIONAL' | 'DIFFERENTIAL';
export type DiagnosisStatus = 'ACTIVE' | 'RESOLVED' | 'RULED_OUT';

export interface Diagnosis {
  id: string;
  organizationId: string;
  patientId: string;
  clinicalVisitId?: string;
  doctorId: string;
  diagnosisText: string;
  type: DiagnosisType;
  status: DiagnosisStatus;
  codeSystem?: string;
  codeValue?: string;
  notes?: string;
  recordedAt: Date;
  recordedBy?: string;
}

export type RecordDiagnosisDTO = {
  id?: string;
  organizationId: string;
  patientId: string;
  clinicalVisitId?: string;
  doctorId: string;
  diagnosisText: string;
  type?: DiagnosisType;
  status?: DiagnosisStatus;
  codeSystem?: string;
  codeValue?: string;
  notes?: string;
  recordedBy?: string;
};
