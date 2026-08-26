import { ipcMain } from 'electron';
import {
  IPC_CHANNELS,
  IPCResponse,
  Prescription,
  PrescriptionVersion,
  CreatePrescriptionRequest,
  RevisePrescriptionRequest,
  createSuccessResult,
  createErrorResult,
  Logger
} from '@medidesk/shared';
import {
  PrescriptionService,
  AuthenticationService
} from '@medidesk/application';

const logger = new Logger('PrescriptionIPC');

export function registerPrescriptionIpcHandlers(
  prescriptionService: PrescriptionService,
  authService: AuthenticationService
): void {
  const authenticate = (sessionToken: string) => {
    const user = authService.getSessionUser(sessionToken);
    if (!user) {
      throw new Error('Authentication required. Session is invalid or expired.');
    }
    return user;
  };

  // 1. Create Prescription (Draft)
  ipcMain.handle(
    IPC_CHANNELS.PRESCRIPTION_CREATE,
    async (_event, input: CreatePrescriptionRequest, sessionToken: string): Promise<IPCResponse<Prescription>> => {
      try {
        const actor = authenticate(sessionToken);
        const rx = await prescriptionService.createPrescription(
          {
            ...input,
            items: input.items.map((i) => ({
              ...i,
              isSubstitutionAllowed: i.isSubstitutionAllowed !== undefined ? i.isSubstitutionAllowed : true
            }))
          },
          actor,
          { ignoreAllergyWarning: input.ignoreAllergyWarning }
        );
        return createSuccessResult(rx);
      } catch (error) {
        logger.warn(`Prescription create failed: ${(error as Error).message}`);
        return createErrorResult((error as Error).name || 'PRESCRIPTION_CREATE_ERROR', (error as Error).message);
      }
    }
  );

  // 2. Get Prescription by ID
  ipcMain.handle(
    IPC_CHANNELS.PRESCRIPTION_GET_BY_ID,
    async (_event, prescriptionId: string, organizationId: string, sessionToken: string): Promise<IPCResponse<Prescription>> => {
      try {
        const actor = authenticate(sessionToken);
        const rx = await prescriptionService.getPrescriptionById(prescriptionId, organizationId, actor);
        return createSuccessResult(rx);
      } catch (error) {
        return createErrorResult((error as Error).name || 'PRESCRIPTION_READ_ERROR', (error as Error).message);
      }
    }
  );

  // 3. Get Prescription by Visit ID
  ipcMain.handle(
    IPC_CHANNELS.PRESCRIPTION_GET_BY_VISIT,
    async (_event, visitId: string, organizationId: string, sessionToken: string): Promise<IPCResponse<Prescription | null>> => {
      try {
        const actor = authenticate(sessionToken);
        const rx = await prescriptionService.getPrescriptionByVisitId(visitId, organizationId, actor);
        return createSuccessResult(rx);
      } catch (error) {
        return createErrorResult((error as Error).name || 'PRESCRIPTION_READ_ERROR', (error as Error).message);
      }
    }
  );

  // 4. List Prescriptions by Patient
  ipcMain.handle(
    IPC_CHANNELS.PRESCRIPTION_LIST_BY_PATIENT,
    async (_event, patientId: string, organizationId: string, sessionToken: string, limit?: number): Promise<IPCResponse<Prescription[]>> => {
      try {
        const actor = authenticate(sessionToken);
        const list = await prescriptionService.listPrescriptionsByPatient(patientId, organizationId, actor, limit);
        return createSuccessResult(list);
      } catch (error) {
        return createErrorResult((error as Error).name || 'PRESCRIPTION_READ_ERROR', (error as Error).message);
      }
    }
  );

  // 5. Sign Prescription
  ipcMain.handle(
    IPC_CHANNELS.PRESCRIPTION_SIGN,
    async (_event, prescriptionId: string, organizationId: string, sessionToken: string): Promise<IPCResponse<Prescription>> => {
      try {
        const actor = authenticate(sessionToken);
        const signed = await prescriptionService.signPrescription({ prescriptionId, organizationId }, actor);
        return createSuccessResult(signed);
      } catch (error) {
        return createErrorResult((error as Error).name || 'PRESCRIPTION_SIGN_ERROR', (error as Error).message);
      }
    }
  );

  // 6. Revise / Version Prescription
  ipcMain.handle(
    IPC_CHANNELS.PRESCRIPTION_REVISE,
    async (_event, input: RevisePrescriptionRequest, organizationId: string, sessionToken: string): Promise<IPCResponse<Prescription>> => {
      try {
        const actor = authenticate(sessionToken);
        const revised = await prescriptionService.revisePrescription(
          {
            ...input,
            organizationId,
            items: input.items.map((i) => ({
              ...i,
              isSubstitutionAllowed: i.isSubstitutionAllowed !== undefined ? i.isSubstitutionAllowed : true
            }))
          },
          actor,
          { ignoreAllergyWarning: input.ignoreAllergyWarning }
        );
        return createSuccessResult(revised);
      } catch (error) {
        return createErrorResult((error as Error).name || 'PRESCRIPTION_REVISE_ERROR', (error as Error).message);
      }
    }
  );

  // 7. Cancel Prescription
  ipcMain.handle(
    IPC_CHANNELS.PRESCRIPTION_CANCEL,
    async (_event, prescriptionId: string, organizationId: string, sessionToken: string, reason?: string): Promise<IPCResponse<Prescription>> => {
      try {
        const actor = authenticate(sessionToken);
        const cancelled = await prescriptionService.cancelPrescription({ prescriptionId, organizationId, reason }, actor);
        return createSuccessResult(cancelled);
      } catch (error) {
        return createErrorResult((error as Error).name || 'PRESCRIPTION_CANCEL_ERROR', (error as Error).message);
      }
    }
  );

  // 8. Get Prescription Versions
  ipcMain.handle(
    IPC_CHANNELS.PRESCRIPTION_GET_VERSIONS,
    async (_event, prescriptionId: string, organizationId: string, sessionToken: string): Promise<IPCResponse<PrescriptionVersion[]>> => {
      try {
        const actor = authenticate(sessionToken);
        const versions = await prescriptionService.getPrescriptionVersions(prescriptionId, organizationId, actor);
        return createSuccessResult(versions);
      } catch (error) {
        return createErrorResult((error as Error).name || 'PRESCRIPTION_READ_ERROR', (error as Error).message);
      }
    }
  );
}
