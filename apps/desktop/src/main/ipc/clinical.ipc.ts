import { ipcMain } from 'electron';
import {
  IPC_CHANNELS,
  IPCResponse,
  ClinicalVisit,
  Vitals,
  Allergy,
  MedicalHistory,
  Diagnosis,
  FollowUp,
  CreateClinicalVisitRequest,
  UpdateClinicalVisitRequest,
  CorrectClinicalVisitRequest,
  RecordVitalsRequest,
  RecordAllergyRequest,
  UpdateAllergyRequest,
  RecordMedicalHistoryRequest,
  UpdateMedicalHistoryRequest,
  RecordDiagnosisRequest,
  ScheduleFollowUpRequest,
  UpdateFollowUpStatusRequest,
  createSuccessResult,
  createErrorResult,
  Logger
} from '@medidesk/shared';
import {
  ClinicalVisitService,
  PatientMedicalRecordService,
  AuthenticationService
} from '@medidesk/application';

const logger = new Logger('ClinicalIPC');

export function registerClinicalIpcHandlers(
  clinicalVisitService: ClinicalVisitService,
  medicalRecordService: PatientMedicalRecordService,
  authService: AuthenticationService
): void {
  const authenticate = (sessionToken: string) => {
    const user = authService.getSessionUser(sessionToken);
    if (!user) {
      throw new Error('Authentication required. Session is invalid or expired.');
    }
    return user;
  };

  // 1. Create Clinical Visit
  ipcMain.handle(
    IPC_CHANNELS.CLINICAL_VISIT_CREATE,
    async (_event, input: CreateClinicalVisitRequest, sessionToken: string): Promise<IPCResponse<ClinicalVisit>> => {
      try {
        const actor = authenticate(sessionToken);
        const visit = await clinicalVisitService.createVisit(input, actor);
        return createSuccessResult(visit);
      } catch (error) {
        logger.warn(`Clinical visit create failed: ${(error as Error).message}`);
        return createErrorResult((error as Error).name || 'CLINICAL_CREATE_ERROR', (error as Error).message);
      }
    }
  );

  // 2. Get Clinical Visit by ID
  ipcMain.handle(
    IPC_CHANNELS.CLINICAL_VISIT_GET_BY_ID,
    async (_event, visitId: string, organizationId: string, sessionToken: string): Promise<IPCResponse<ClinicalVisit>> => {
      try {
        const actor = authenticate(sessionToken);
        const visit = await clinicalVisitService.getVisitById(visitId, organizationId, actor);
        return createSuccessResult(visit);
      } catch (error) {
        return createErrorResult((error as Error).name || 'CLINICAL_READ_ERROR', (error as Error).message);
      }
    }
  );

  // 3. List Visits by Patient
  ipcMain.handle(
    IPC_CHANNELS.CLINICAL_VISIT_LIST_BY_PATIENT,
    async (_event, patientId: string, organizationId: string, sessionToken: string, limit?: number): Promise<IPCResponse<ClinicalVisit[]>> => {
      try {
        const actor = authenticate(sessionToken);
        const visits = await clinicalVisitService.listVisitsByPatient(patientId, organizationId, actor, limit);
        return createSuccessResult(visits);
      } catch (error) {
        return createErrorResult((error as Error).name || 'CLINICAL_READ_ERROR', (error as Error).message);
      }
    }
  );

  // 4. Update Clinical Visit
  ipcMain.handle(
    IPC_CHANNELS.CLINICAL_VISIT_UPDATE,
    async (_event, input: UpdateClinicalVisitRequest, organizationId: string, sessionToken: string): Promise<IPCResponse<ClinicalVisit>> => {
      try {
        const actor = authenticate(sessionToken);
        const updated = await clinicalVisitService.updateVisit({ ...input, organizationId }, actor);
        return createSuccessResult(updated);
      } catch (error) {
        return createErrorResult((error as Error).name || 'CLINICAL_UPDATE_ERROR', (error as Error).message);
      }
    }
  );

  // 5. Complete Clinical Visit
  ipcMain.handle(
    IPC_CHANNELS.CLINICAL_VISIT_COMPLETE,
    async (_event, visitId: string, organizationId: string, sessionToken: string): Promise<IPCResponse<ClinicalVisit>> => {
      try {
        const actor = authenticate(sessionToken);
        const completed = await clinicalVisitService.completeVisit(visitId, organizationId, actor);
        return createSuccessResult(completed);
      } catch (error) {
        return createErrorResult((error as Error).name || 'CLINICAL_COMPLETE_ERROR', (error as Error).message);
      }
    }
  );

  // 6. Cancel Clinical Visit
  ipcMain.handle(
    IPC_CHANNELS.CLINICAL_VISIT_CANCEL,
    async (_event, visitId: string, organizationId: string, sessionToken: string): Promise<IPCResponse<ClinicalVisit>> => {
      try {
        const actor = authenticate(sessionToken);
        const cancelled = await clinicalVisitService.cancelVisit(visitId, organizationId, actor);
        return createSuccessResult(cancelled);
      } catch (error) {
        return createErrorResult((error as Error).name || 'CLINICAL_CANCEL_ERROR', (error as Error).message);
      }
    }
  );

  // 7. Correct Clinical Visit
  ipcMain.handle(
    IPC_CHANNELS.CLINICAL_VISIT_CORRECT,
    async (_event, input: CorrectClinicalVisitRequest, organizationId: string, sessionToken: string): Promise<IPCResponse<ClinicalVisit>> => {
      try {
        const actor = authenticate(sessionToken);
        const corrected = await clinicalVisitService.correctVisit(
          {
            organizationId,
            resourceType: 'CLINICAL_VISIT',
            resourceId: input.visitId,
            correctedPayload: input.correctedPayload,
            reason: input.reason
          },
          actor
        );
        return createSuccessResult(corrected);
      } catch (error) {
        return createErrorResult((error as Error).name || 'CLINICAL_CORRECTION_ERROR', (error as Error).message);
      }
    }
  );

  // 8. Record Vitals
  ipcMain.handle(
    IPC_CHANNELS.VITALS_RECORD,
    async (_event, input: RecordVitalsRequest, sessionToken: string): Promise<IPCResponse<Vitals>> => {
      try {
        const actor = authenticate(sessionToken);
        const vitals = await medicalRecordService.recordVitals(
          {
            ...input,
            temperatureUnit: input.temperatureUnit || 'FAHRENHEIT'
          },
          actor
        );
        return createSuccessResult(vitals);
      } catch (error) {
        return createErrorResult((error as Error).name || 'VITALS_ERROR', (error as Error).message);
      }
    }
  );

  // 9. Get Vitals by Patient
  ipcMain.handle(
    IPC_CHANNELS.VITALS_GET_BY_PATIENT,
    async (_event, patientId: string, organizationId: string, sessionToken: string, limit?: number): Promise<IPCResponse<Vitals[]>> => {
      try {
        const actor = authenticate(sessionToken);
        const list = await medicalRecordService.getVitalsByPatient(patientId, organizationId, actor, limit);
        return createSuccessResult(list);
      } catch (error) {
        return createErrorResult((error as Error).name || 'VITALS_READ_ERROR', (error as Error).message);
      }
    }
  );

  // 10. Get Vitals by Visit
  ipcMain.handle(
    IPC_CHANNELS.VITALS_GET_BY_VISIT,
    async (_event, visitId: string, organizationId: string, sessionToken: string): Promise<IPCResponse<Vitals[]>> => {
      try {
        const actor = authenticate(sessionToken);
        const list = await medicalRecordService.getVitalsByVisit(visitId, organizationId, actor);
        return createSuccessResult(list);
      } catch (error) {
        return createErrorResult((error as Error).name || 'VITALS_READ_ERROR', (error as Error).message);
      }
    }
  );

  // 11. Record Allergy
  ipcMain.handle(
    IPC_CHANNELS.ALLERGY_RECORD,
    async (_event, input: RecordAllergyRequest, sessionToken: string): Promise<IPCResponse<Allergy>> => {
      try {
        const actor = authenticate(sessionToken);
        const allergy = await medicalRecordService.recordAllergy(
          {
            ...input,
            category: input.category || 'DRUG',
            severity: input.severity || 'MODERATE'
          },
          actor
        );
        return createSuccessResult(allergy);
      } catch (error) {
        return createErrorResult((error as Error).name || 'ALLERGY_ERROR', (error as Error).message);
      }
    }
  );

  // 12. List Allergies by Patient
  ipcMain.handle(
    IPC_CHANNELS.ALLERGY_LIST_BY_PATIENT,
    async (_event, patientId: string, organizationId: string, sessionToken: string): Promise<IPCResponse<Allergy[]>> => {
      try {
        const actor = authenticate(sessionToken);
        const list = await medicalRecordService.listAllergiesByPatient(patientId, organizationId, actor);
        return createSuccessResult(list);
      } catch (error) {
        return createErrorResult((error as Error).name || 'ALLERGY_READ_ERROR', (error as Error).message);
      }
    }
  );

  // 13. Update Allergy
  ipcMain.handle(
    IPC_CHANNELS.ALLERGY_UPDATE,
    async (_event, input: UpdateAllergyRequest, organizationId: string, sessionToken: string): Promise<IPCResponse<Allergy>> => {
      try {
        const actor = authenticate(sessionToken);
        const updated = await medicalRecordService.updateAllergy({ ...input, organizationId }, actor);
        return createSuccessResult(updated);
      } catch (error) {
        return createErrorResult((error as Error).name || 'ALLERGY_UPDATE_ERROR', (error as Error).message);
      }
    }
  );

  // 14. Record Medical History
  ipcMain.handle(
    IPC_CHANNELS.HISTORY_RECORD,
    async (_event, input: RecordMedicalHistoryRequest, sessionToken: string): Promise<IPCResponse<MedicalHistory>> => {
      try {
        const actor = authenticate(sessionToken);
        const history = await medicalRecordService.recordMedicalHistory(
          {
            ...input,
            isActive: input.isActive !== undefined ? input.isActive : true
          },
          actor
        );
        return createSuccessResult(history);
      } catch (error) {
        return createErrorResult((error as Error).name || 'HISTORY_ERROR', (error as Error).message);
      }
    }
  );

  // 15. List Medical History by Patient
  ipcMain.handle(
    IPC_CHANNELS.HISTORY_LIST_BY_PATIENT,
    async (_event, patientId: string, organizationId: string, sessionToken: string): Promise<IPCResponse<MedicalHistory[]>> => {
      try {
        const actor = authenticate(sessionToken);
        const list = await medicalRecordService.listMedicalHistoryByPatient(patientId, organizationId, actor);
        return createSuccessResult(list);
      } catch (error) {
        return createErrorResult((error as Error).name || 'HISTORY_READ_ERROR', (error as Error).message);
      }
    }
  );

  // 16. Update Medical History
  ipcMain.handle(
    IPC_CHANNELS.HISTORY_UPDATE,
    async (_event, input: UpdateMedicalHistoryRequest, organizationId: string, sessionToken: string): Promise<IPCResponse<MedicalHistory>> => {
      try {
        const actor = authenticate(sessionToken);
        const updated = await medicalRecordService.updateMedicalHistory({ ...input, organizationId }, actor);
        return createSuccessResult(updated);
      } catch (error) {
        return createErrorResult((error as Error).name || 'HISTORY_UPDATE_ERROR', (error as Error).message);
      }
    }
  );

  // 17. Record Diagnosis
  ipcMain.handle(
    IPC_CHANNELS.DIAGNOSIS_RECORD,
    async (_event, input: RecordDiagnosisRequest, sessionToken: string): Promise<IPCResponse<Diagnosis>> => {
      try {
        const actor = authenticate(sessionToken);
        const diag = await medicalRecordService.recordDiagnosis(
          {
            ...input,
            status: input.status || 'ACTIVE',
            type: input.type || 'PRIMARY'
          },
          actor
        );
        return createSuccessResult(diag);
      } catch (error) {
        return createErrorResult((error as Error).name || 'DIAGNOSIS_ERROR', (error as Error).message);
      }
    }
  );

  // 18. List Diagnoses by Patient
  ipcMain.handle(
    IPC_CHANNELS.DIAGNOSIS_LIST_BY_PATIENT,
    async (_event, patientId: string, organizationId: string, sessionToken: string): Promise<IPCResponse<Diagnosis[]>> => {
      try {
        const actor = authenticate(sessionToken);
        const list = await medicalRecordService.listDiagnosesByPatient(patientId, organizationId, actor);
        return createSuccessResult(list);
      } catch (error) {
        return createErrorResult((error as Error).name || 'DIAGNOSIS_READ_ERROR', (error as Error).message);
      }
    }
  );

  // 19. Schedule Follow-Up
  ipcMain.handle(
    IPC_CHANNELS.FOLLOWUP_SCHEDULE,
    async (_event, input: ScheduleFollowUpRequest, sessionToken: string): Promise<IPCResponse<FollowUp>> => {
      try {
        const actor = authenticate(sessionToken);
        const followUp = await medicalRecordService.scheduleFollowUp(input, actor);
        return createSuccessResult(followUp);
      } catch (error) {
        return createErrorResult((error as Error).name || 'FOLLOWUP_ERROR', (error as Error).message);
      }
    }
  );

  // 20. List Follow-Ups by Patient
  ipcMain.handle(
    IPC_CHANNELS.FOLLOWUP_LIST_BY_PATIENT,
    async (_event, patientId: string, organizationId: string, sessionToken: string): Promise<IPCResponse<FollowUp[]>> => {
      try {
        const actor = authenticate(sessionToken);
        const list = await medicalRecordService.listFollowUpsByPatient(patientId, organizationId, actor);
        return createSuccessResult(list);
      } catch (error) {
        return createErrorResult((error as Error).name || 'FOLLOWUP_READ_ERROR', (error as Error).message);
      }
    }
  );

  // 21. Update Follow-Up Status
  ipcMain.handle(
    IPC_CHANNELS.FOLLOWUP_UPDATE_STATUS,
    async (_event, input: UpdateFollowUpStatusRequest, organizationId: string, sessionToken: string): Promise<IPCResponse<FollowUp>> => {
      try {
        const actor = authenticate(sessionToken);
        const updated = await medicalRecordService.updateFollowUpStatus({ ...input, organizationId }, actor);
        return createSuccessResult(updated);
      } catch (error) {
        return createErrorResult((error as Error).name || 'FOLLOWUP_UPDATE_ERROR', (error as Error).message);
      }
    }
  );
}
