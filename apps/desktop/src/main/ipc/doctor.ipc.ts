import { ipcMain } from 'electron';
import { DoctorService, AuthenticationService } from '@medidesk/application';
import {
  IPC_CHANNELS,
  IPCResponse,
  Doctor,
  DoctorSchedule,
  CreateDoctorRequest,
  UpdateDoctorRequest,
  SetDoctorSchedulesRequest
} from '@medidesk/shared';
import {
  CreateDoctorIPCRequestSchema,
  UpdateDoctorIPCRequestSchema,
  SetDoctorSchedulesIPCRequestSchema,
  validateSchema
} from '@medidesk/validation';
import { Logger } from '@medidesk/shared';

const logger = new Logger('DoctorIPC');

export function registerDoctorIpcHandlers(
  doctorService: DoctorService,
  authService: AuthenticationService
): void {
  // 1. List Doctors
  ipcMain.handle(
    IPC_CHANNELS.DOCTOR_LIST,
    async (
      _event,
      payload: { organizationId: string; activeOnly?: boolean; sessionToken: string }
    ): Promise<IPCResponse<Doctor[]>> => {
      try {
        const actor = authService.getSessionUser(payload?.sessionToken);
        if (!actor) {
          return {
            success: false,
            error: { code: 'UNAUTHORIZED', message: 'Valid session required.' }
          };
        }

        const doctors = await doctorService.listDoctors(payload.organizationId, actor, {
          activeOnly: payload.activeOnly
        });
        return { success: true, data: doctors };
      } catch (error) {
        logger.warn(`Doctor list error: ${(error as Error).message}`);
        return {
          success: false,
          error: { code: (error as Error).name || 'DOCTOR_ERROR', message: (error as Error).message }
        };
      }
    }
  );

  // 2. Create Doctor
  ipcMain.handle(
    IPC_CHANNELS.DOCTOR_CREATE,
    async (
      _event,
      payload: { input: CreateDoctorRequest; sessionToken: string }
    ): Promise<IPCResponse<Doctor>> => {
      try {
        const actor = authService.getSessionUser(payload?.sessionToken);
        if (!actor) {
          return {
            success: false,
            error: { code: 'UNAUTHORIZED', message: 'Valid session required.' }
          };
        }

        const validated = validateSchema(CreateDoctorIPCRequestSchema, payload?.input);
        if (!validated.success) {
          return {
            success: false,
            error: { code: 'VALIDATION_ERROR', message: 'Invalid doctor creation data', details: validated.errors }
          };
        }

        const doctor = await doctorService.createDoctor(validated.data, actor);
        return { success: true, data: doctor };
      } catch (error) {
        logger.warn(`Doctor creation error: ${(error as Error).message}`);
        return {
          success: false,
          error: { code: (error as Error).name || 'DOCTOR_CREATE_ERROR', message: (error as Error).message }
        };
      }
    }
  );

  // 3. Get Doctor By ID
  ipcMain.handle(
    IPC_CHANNELS.DOCTOR_GET_BY_ID,
    async (
      _event,
      payload: { doctorId: string; organizationId: string; sessionToken: string }
    ): Promise<IPCResponse<Doctor>> => {
      try {
        const actor = authService.getSessionUser(payload?.sessionToken);
        if (!actor) {
          return {
            success: false,
            error: { code: 'UNAUTHORIZED', message: 'Valid session required.' }
          };
        }

        const doctor = await doctorService.getDoctorById(payload.doctorId, payload.organizationId, actor);
        return { success: true, data: doctor };
      } catch (error) {
        return {
          success: false,
          error: { code: (error as Error).name || 'DOCTOR_NOT_FOUND', message: (error as Error).message }
        };
      }
    }
  );

  // 4. Update Doctor
  ipcMain.handle(
    IPC_CHANNELS.DOCTOR_UPDATE,
    async (
      _event,
      payload: { input: UpdateDoctorRequest; organizationId: string; sessionToken: string }
    ): Promise<IPCResponse<Doctor>> => {
      try {
        const actor = authService.getSessionUser(payload?.sessionToken);
        if (!actor) {
          return {
            success: false,
            error: { code: 'UNAUTHORIZED', message: 'Valid session required.' }
          };
        }

        const validated = validateSchema(UpdateDoctorIPCRequestSchema, payload?.input);
        if (!validated.success) {
          return {
            success: false,
            error: { code: 'VALIDATION_ERROR', message: 'Invalid doctor update data', details: validated.errors }
          };
        }

        const updated = await doctorService.updateDoctor(validated.data, payload.organizationId, actor);
        return { success: true, data: updated };
      } catch (error) {
        logger.warn(`Doctor update error: ${(error as Error).message}`);
        return {
          success: false,
          error: { code: (error as Error).name || 'DOCTOR_UPDATE_ERROR', message: (error as Error).message }
        };
      }
    }
  );

  // 5. Deactivate Doctor
  ipcMain.handle(
    IPC_CHANNELS.DOCTOR_DEACTIVATE,
    async (
      _event,
      payload: { doctorId: string; organizationId: string; sessionToken: string }
    ): Promise<IPCResponse<Doctor>> => {
      try {
        const actor = authService.getSessionUser(payload?.sessionToken);
        if (!actor) {
          return {
            success: false,
            error: { code: 'UNAUTHORIZED', message: 'Valid session required.' }
          };
        }

        const deactivated = await doctorService.deactivateDoctor(payload.doctorId, payload.organizationId, actor);
        return { success: true, data: deactivated };
      } catch (error) {
        logger.warn(`Doctor deactivation error: ${(error as Error).message}`);
        return {
          success: false,
          error: { code: (error as Error).name || 'DOCTOR_DEACTIVATE_ERROR', message: (error as Error).message }
        };
      }
    }
  );

  // 6. Set Doctor Schedules
  ipcMain.handle(
    IPC_CHANNELS.DOCTOR_SET_SCHEDULES,
    async (
      _event,
      payload: { input: SetDoctorSchedulesRequest; organizationId: string; sessionToken: string }
    ): Promise<IPCResponse<DoctorSchedule[]>> => {
      try {
        const actor = authService.getSessionUser(payload?.sessionToken);
        if (!actor) {
          return {
            success: false,
            error: { code: 'UNAUTHORIZED', message: 'Valid session required.' }
          };
        }

        const validated = validateSchema(SetDoctorSchedulesIPCRequestSchema, payload?.input);
        if (!validated.success) {
          return {
            success: false,
            error: { code: 'VALIDATION_ERROR', message: 'Invalid doctor schedule data', details: validated.errors }
          };
        }

        const schedules = await doctorService.setDoctorSchedules(validated.data, payload.organizationId, actor);
        return { success: true, data: schedules };
      } catch (error) {
        logger.warn(`Doctor schedules error: ${(error as Error).message}`);
        return {
          success: false,
          error: { code: (error as Error).name || 'SCHEDULE_ERROR', message: (error as Error).message }
        };
      }
    }
  );

  // 7. Get Doctor Schedules
  ipcMain.handle(
    IPC_CHANNELS.DOCTOR_GET_SCHEDULES,
    async (
      _event,
      payload: { doctorId: string; organizationId: string; sessionToken: string }
    ): Promise<IPCResponse<DoctorSchedule[]>> => {
      try {
        const actor = authService.getSessionUser(payload?.sessionToken);
        if (!actor) {
          return {
            success: false,
            error: { code: 'UNAUTHORIZED', message: 'Valid session required.' }
          };
        }

        const schedules = await doctorService.getDoctorSchedules(payload.doctorId, payload.organizationId, actor);
        return { success: true, data: schedules };
      } catch (error) {
        return {
          success: false,
          error: { code: (error as Error).name || 'SCHEDULE_ERROR', message: (error as Error).message }
        };
      }
    }
  );
}
