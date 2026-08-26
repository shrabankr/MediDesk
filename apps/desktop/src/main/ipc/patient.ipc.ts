import { ipcMain } from 'electron';
import { PatientService, AuthenticationService } from '@medidesk/application';
import {
  IPC_CHANNELS,
  IPCResponse,
  Patient,
  DuplicatePatientMatch,
  CreatePatientRequest,
  UpdatePatientRequest,
  SearchPatientRequest,
  CheckDuplicatesRequest
} from '@medidesk/shared';
import {
  CreatePatientIPCRequestSchema,
  UpdatePatientIPCRequestSchema,
  SearchPatientIPCRequestSchema,
  CheckDuplicatesIPCRequestSchema,
  validateSchema
} from '@medidesk/validation';
import { Logger } from '@medidesk/shared';

const logger = new Logger('PatientIPC');

export function registerPatientIpcHandlers(
  patientService: PatientService,
  authService: AuthenticationService
): void {
  // 1. Search Patients
  ipcMain.handle(
    IPC_CHANNELS.PATIENT_SEARCH,
    async (
      _event,
      payload: { input: SearchPatientRequest; sessionToken: string }
    ): Promise<IPCResponse<Patient[]>> => {
      try {
        const actor = authService.getSessionUser(payload?.sessionToken);
        if (!actor) {
          return {
            success: false,
            error: { code: 'UNAUTHORIZED', message: 'Valid session required.' }
          };
        }

        const validated = validateSchema(SearchPatientIPCRequestSchema, payload?.input);
        if (!validated.success) {
          return {
            success: false,
            error: { code: 'VALIDATION_ERROR', message: 'Invalid patient search query', details: validated.errors }
          };
        }

        const results = await patientService.searchPatients(validated.data, actor);
        return { success: true, data: results };
      } catch (error) {
        logger.warn(`Patient search error: ${(error as Error).message}`);
        return {
          success: false,
          error: { code: (error as Error).name || 'PATIENT_ERROR', message: (error as Error).message }
        };
      }
    }
  );

  // 2. Check Duplicates
  ipcMain.handle(
    IPC_CHANNELS.PATIENT_CHECK_DUPLICATES,
    async (
      _event,
      payload: { input: CheckDuplicatesRequest; sessionToken: string }
    ): Promise<IPCResponse<DuplicatePatientMatch[]>> => {
      try {
        const actor = authService.getSessionUser(payload?.sessionToken);
        if (!actor) {
          return {
            success: false,
            error: { code: 'UNAUTHORIZED', message: 'Valid session required.' }
          };
        }

        const validated = validateSchema(CheckDuplicatesIPCRequestSchema, payload?.input);
        if (!validated.success) {
          return {
            success: false,
            error: { code: 'VALIDATION_ERROR', message: 'Invalid duplicate check payload', details: validated.errors }
          };
        }

        const matches = await patientService.checkDuplicates(validated.data, actor);
        return { success: true, data: matches };
      } catch (error) {
        logger.warn(`Duplicate check error: ${(error as Error).message}`);
        return {
          success: false,
          error: { code: (error as Error).name || 'DUPLICATE_CHECK_ERROR', message: (error as Error).message }
        };
      }
    }
  );

  // 3. Create / Register Patient
  ipcMain.handle(
    IPC_CHANNELS.PATIENT_CREATE,
    async (
      _event,
      payload: { input: CreatePatientRequest; sessionToken: string }
    ): Promise<IPCResponse<Patient>> => {
      try {
        const actor = authService.getSessionUser(payload?.sessionToken);
        if (!actor) {
          return {
            success: false,
            error: { code: 'UNAUTHORIZED', message: 'Valid session required.' }
          };
        }

        const validated = validateSchema(CreatePatientIPCRequestSchema, payload?.input);
        if (!validated.success) {
          return {
            success: false,
            error: { code: 'VALIDATION_ERROR', message: 'Invalid patient registration data', details: validated.errors }
          };
        }

        const patient = await patientService.registerPatient(validated.data, actor, {
          forceCreateOnDuplicate: payload?.input?.forceCreateOnDuplicate
        });
        return { success: true, data: patient };
      } catch (error) {
        logger.warn(`Patient creation error: ${(error as Error).message}`);
        return {
          success: false,
          error: {
            code: (error as Error).name || 'PATIENT_CREATE_ERROR',
            message: (error as Error).message,
            details: (error as { duplicates?: unknown }).duplicates
          }
        };
      }
    }
  );

  // 4. Get Patient By ID
  ipcMain.handle(
    IPC_CHANNELS.PATIENT_GET_BY_ID,
    async (
      _event,
      payload: { patientId: string; organizationId: string; sessionToken: string }
    ): Promise<IPCResponse<Patient>> => {
      try {
        const actor = authService.getSessionUser(payload?.sessionToken);
        if (!actor) {
          return {
            success: false,
            error: { code: 'UNAUTHORIZED', message: 'Valid session required.' }
          };
        }

        const patient = await patientService.getPatientById(payload.patientId, payload.organizationId, actor);
        return { success: true, data: patient };
      } catch (error) {
        return {
          success: false,
          error: { code: (error as Error).name || 'PATIENT_NOT_FOUND', message: (error as Error).message }
        };
      }
    }
  );

  // 5. Update Patient
  ipcMain.handle(
    IPC_CHANNELS.PATIENT_UPDATE,
    async (
      _event,
      payload: { input: UpdatePatientRequest; organizationId: string; sessionToken: string }
    ): Promise<IPCResponse<Patient>> => {
      try {
        const actor = authService.getSessionUser(payload?.sessionToken);
        if (!actor) {
          return {
            success: false,
            error: { code: 'UNAUTHORIZED', message: 'Valid session required.' }
          };
        }

        const validated = validateSchema(UpdatePatientIPCRequestSchema, payload?.input);
        if (!validated.success) {
          return {
            success: false,
            error: { code: 'VALIDATION_ERROR', message: 'Invalid patient update data', details: validated.errors }
          };
        }

        const updated = await patientService.updatePatient(validated.data, payload.organizationId, actor);
        return { success: true, data: updated };
      } catch (error) {
        logger.warn(`Patient update error: ${(error as Error).message}`);
        return {
          success: false,
          error: { code: (error as Error).name || 'PATIENT_UPDATE_ERROR', message: (error as Error).message }
        };
      }
    }
  );
}
