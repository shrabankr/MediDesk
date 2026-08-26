import { ipcMain } from 'electron';
import { AppointmentService, AuthenticationService } from '@medidesk/application';
import {
  IPC_CHANNELS,
  IPCResponse,
  Appointment,
  TodayMetricsData,
  CreateAppointmentRequest,
  UpdateAppointmentRequest,
  ChangeAppointmentStatusRequest,
  ListAppointmentsRequest,
  GetWaitingQueueRequest
} from '@medidesk/shared';
import {
  CreateAppointmentIPCRequestSchema,
  UpdateAppointmentIPCRequestSchema,
  ChangeAppointmentStatusIPCRequestSchema,
  ListAppointmentsIPCRequestSchema,
  GetWaitingQueueIPCRequestSchema,
  validateSchema
} from '@medidesk/validation';
import { Logger } from '@medidesk/shared';

const logger = new Logger('AppointmentIPC');

export function registerAppointmentIpcHandlers(
  appointmentService: AppointmentService,
  authService: AuthenticationService
): void {
  // 1. Create / Book Appointment
  ipcMain.handle(
    IPC_CHANNELS.APPOINTMENT_CREATE,
    async (
      _event,
      payload: { input: CreateAppointmentRequest; sessionToken: string }
    ): Promise<IPCResponse<Appointment>> => {
      try {
        const actor = authService.getSessionUser(payload?.sessionToken);
        if (!actor) {
          return {
            success: false,
            error: { code: 'UNAUTHORIZED', message: 'Valid session required.' }
          };
        }

        const validated = validateSchema(CreateAppointmentIPCRequestSchema, payload?.input);
        if (!validated.success) {
          return {
            success: false,
            error: { code: 'VALIDATION_ERROR', message: 'Invalid appointment booking data', details: validated.errors }
          };
        }

        const appointment = await appointmentService.bookAppointment(validated.data, actor);
        return { success: true, data: appointment };
      } catch (error) {
        logger.warn(`Appointment booking error: ${(error as Error).message}`);
        return {
          success: false,
          error: { code: (error as Error).name || 'APPOINTMENT_CREATE_ERROR', message: (error as Error).message }
        };
      }
    }
  );

  // 2. List Appointments
  ipcMain.handle(
    IPC_CHANNELS.APPOINTMENT_LIST,
    async (
      _event,
      payload: { input: ListAppointmentsRequest; sessionToken: string }
    ): Promise<IPCResponse<Appointment[]>> => {
      try {
        const actor = authService.getSessionUser(payload?.sessionToken);
        if (!actor) {
          return {
            success: false,
            error: { code: 'UNAUTHORIZED', message: 'Valid session required.' }
          };
        }

        const validated = validateSchema(ListAppointmentsIPCRequestSchema, payload?.input);
        if (!validated.success) {
          return {
            success: false,
            error: { code: 'VALIDATION_ERROR', message: 'Invalid appointment search query', details: validated.errors }
          };
        }

        const list = await appointmentService.listAppointments(validated.data, actor);
        return { success: true, data: list };
      } catch (error) {
        logger.warn(`Appointment listing error: ${(error as Error).message}`);
        return {
          success: false,
          error: { code: (error as Error).name || 'APPOINTMENT_LIST_ERROR', message: (error as Error).message }
        };
      }
    }
  );

  // 3. Get Waiting Queue
  ipcMain.handle(
    IPC_CHANNELS.APPOINTMENT_GET_QUEUE,
    async (
      _event,
      payload: { input: GetWaitingQueueRequest; sessionToken: string }
    ): Promise<IPCResponse<Appointment[]>> => {
      try {
        const actor = authService.getSessionUser(payload?.sessionToken);
        if (!actor) {
          return {
            success: false,
            error: { code: 'UNAUTHORIZED', message: 'Valid session required.' }
          };
        }

        const validated = validateSchema(GetWaitingQueueIPCRequestSchema, payload?.input);
        if (!validated.success) {
          return {
            success: false,
            error: { code: 'VALIDATION_ERROR', message: 'Invalid waiting queue request', details: validated.errors }
          };
        }

        const queue = await appointmentService.getWaitingQueue(validated.data, actor);
        return { success: true, data: queue };
      } catch (error) {
        logger.warn(`Waiting queue error: ${(error as Error).message}`);
        return {
          success: false,
          error: { code: (error as Error).name || 'QUEUE_ERROR', message: (error as Error).message }
        };
      }
    }
  );

  // 4. Change Appointment Status
  ipcMain.handle(
    IPC_CHANNELS.APPOINTMENT_CHANGE_STATUS,
    async (
      _event,
      payload: { input: ChangeAppointmentStatusRequest; organizationId: string; sessionToken: string }
    ): Promise<IPCResponse<Appointment>> => {
      try {
        const actor = authService.getSessionUser(payload?.sessionToken);
        if (!actor) {
          return {
            success: false,
            error: { code: 'UNAUTHORIZED', message: 'Valid session required.' }
          };
        }

        const validated = validateSchema(ChangeAppointmentStatusIPCRequestSchema, payload?.input);
        if (!validated.success) {
          return {
            success: false,
            error: { code: 'VALIDATION_ERROR', message: 'Invalid status change payload', details: validated.errors }
          };
        }

        const updated = await appointmentService.changeAppointmentStatus(
          validated.data,
          payload.organizationId,
          actor
        );
        return { success: true, data: updated };
      } catch (error) {
        logger.warn(`Appointment status change error: ${(error as Error).message}`);
        return {
          success: false,
          error: { code: (error as Error).name || 'STATUS_CHANGE_ERROR', message: (error as Error).message }
        };
      }
    }
  );

  // 5. Get Appointment By ID
  ipcMain.handle(
    IPC_CHANNELS.APPOINTMENT_GET_BY_ID,
    async (
      _event,
      payload: { appointmentId: string; organizationId: string; sessionToken: string }
    ): Promise<IPCResponse<Appointment>> => {
      try {
        const actor = authService.getSessionUser(payload?.sessionToken);
        if (!actor) {
          return {
            success: false,
            error: { code: 'UNAUTHORIZED', message: 'Valid session required.' }
          };
        }

        const appointment = await appointmentService.getAppointmentById(
          payload.appointmentId,
          payload.organizationId,
          actor
        );
        return { success: true, data: appointment };
      } catch (error) {
        return {
          success: false,
          error: { code: (error as Error).name || 'APPOINTMENT_NOT_FOUND', message: (error as Error).message }
        };
      }
    }
  );

  // 6. Update Appointment
  ipcMain.handle(
    IPC_CHANNELS.APPOINTMENT_UPDATE,
    async (
      _event,
      payload: { input: UpdateAppointmentRequest; organizationId: string; sessionToken: string }
    ): Promise<IPCResponse<Appointment>> => {
      try {
        const actor = authService.getSessionUser(payload?.sessionToken);
        if (!actor) {
          return {
            success: false,
            error: { code: 'UNAUTHORIZED', message: 'Valid session required.' }
          };
        }

        const validated = validateSchema(UpdateAppointmentIPCRequestSchema, payload?.input);
        if (!validated.success) {
          return {
            success: false,
            error: { code: 'VALIDATION_ERROR', message: 'Invalid appointment update payload', details: validated.errors }
          };
        }

        const updated = await appointmentService.updateAppointment(
          validated.data,
          payload.organizationId,
          actor
        );
        return { success: true, data: updated };
      } catch (error) {
        logger.warn(`Appointment update error: ${(error as Error).message}`);
        return {
          success: false,
          error: { code: (error as Error).name || 'APPOINTMENT_UPDATE_ERROR', message: (error as Error).message }
        };
      }
    }
  );

  // 7. Get Today Metrics
  ipcMain.handle(
    IPC_CHANNELS.APPOINTMENT_GET_METRICS,
    async (
      _event,
      payload: { organizationId: string; appointmentDate: string; doctorId?: string; sessionToken: string }
    ): Promise<IPCResponse<TodayMetricsData>> => {
      try {
        const actor = authService.getSessionUser(payload?.sessionToken);
        if (!actor) {
          return {
            success: false,
            error: { code: 'UNAUTHORIZED', message: 'Valid session required.' }
          };
        }

        const metrics = await appointmentService.getTodayMetrics(
          payload.organizationId,
          payload.appointmentDate,
          actor,
          payload.doctorId
        );
        return { success: true, data: metrics };
      } catch (error) {
        logger.warn(`Metrics error: ${(error as Error).message}`);
        return {
          success: false,
          error: { code: (error as Error).name || 'METRICS_ERROR', message: (error as Error).message }
        };
      }
    }
  );
}
