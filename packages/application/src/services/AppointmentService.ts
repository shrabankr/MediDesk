import {
  IAppointmentRepository,
  IPatientRepository,
  IDoctorRepository,
  Appointment,
  AppointmentStatus,
  SessionUser,
  AuditAction,
  AuditResult,
  AuthorizationError,
  ValidationError,
  PatientNotFoundError,
  DoctorNotFoundError,
  DoctorInactiveError,
  AppointmentNotFoundError,
  AppointmentConflictError,
  OutsideDoctorScheduleError,
  InvalidAppointmentTransitionError,
  PermissionCode
} from '@medidesk/domain';
import { RBACEngine } from '@medidesk/authorization';
import { AuditService } from '@medidesk/audit';
import { Logger } from '@medidesk/shared';
import {
  CreateAppointmentInput,
  UpdateAppointmentInput,
  ChangeAppointmentStatusInput,
  ListAppointmentsInput,
  GetWaitingQueueInput,
  CreateAppointmentSchema,
  UpdateAppointmentSchema,
  ChangeAppointmentStatusSchema,
  ListAppointmentsSchema,
  GetWaitingQueueSchema,
  validateSchema
} from '@medidesk/validation';

function computeEndTime(startTime: string, durationMinutes: number): string {
  const [hours, mins] = startTime.split(':').map((v) => parseInt(v, 10));
  const totalMins = hours * 60 + mins + durationMinutes;
  const endHours = Math.floor(totalMins / 60) % 24;
  const endMins = totalMins % 60;
  return `${String(endHours).padStart(2, '0')}:${String(endMins).padStart(2, '0')}`;
}

const ALLOWED_STATUS_TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  SCHEDULED: ['CHECKED_IN', 'WAITING', 'CANCELLED', 'NO_SHOW'],
  CHECKED_IN: ['WAITING', 'IN_CONSULTATION', 'CANCELLED'],
  WAITING: ['IN_CONSULTATION', 'CANCELLED'],
  IN_CONSULTATION: ['COMPLETED', 'WAITING'],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: []
};

export class AppointmentService {
  private appointmentRepo: IAppointmentRepository;
  private patientRepo: IPatientRepository;
  private doctorRepo: IDoctorRepository;
  private auditService: AuditService;
  private rbacEngine: RBACEngine;
  private logger: Logger;

  constructor(
    appointmentRepo: IAppointmentRepository,
    patientRepo: IPatientRepository,
    doctorRepo: IDoctorRepository,
    auditService: AuditService,
    rbacEngine: RBACEngine
  ) {
    this.appointmentRepo = appointmentRepo;
    this.patientRepo = patientRepo;
    this.doctorRepo = doctorRepo;
    this.auditService = auditService;
    this.rbacEngine = rbacEngine;
    this.logger = new Logger('AppointmentService');
  }

  private assertPermission(actor: SessionUser, permission: string): void {
    const hasPermission = this.rbacEngine.evaluatePermission(actor.roles, permission);
    if (!hasPermission) {
      this.logger.warn(`Access Denied: Actor '${actor.username}' lacks permission '${permission}'`);
      throw new AuthorizationError(`Access Denied: Missing '${permission}' permission.`);
    }
  }

  public async bookAppointment(input: CreateAppointmentInput, actor: SessionUser): Promise<Appointment> {
    this.assertPermission(actor, PermissionCode.APPOINTMENT_CREATE);

    const validated = validateSchema(CreateAppointmentSchema, input);
    if (!validated.success) {
      throw new ValidationError('Validation failed for booking appointment', validated.errors);
    }

    const { organizationId, patientId, doctorId, appointmentDate, startTime, durationMinutes, visitPurpose, notes } =
      validated.data;

    // 1. Verify Patient
    const patient = await this.patientRepo.findById(patientId);
    if (!patient || patient.organizationId !== organizationId) {
      throw new PatientNotFoundError(patientId);
    }

    // 2. Verify Doctor & Active Status
    const doctor = await this.doctorRepo.findById(doctorId);
    if (!doctor || doctor.organizationId !== organizationId) {
      throw new DoctorNotFoundError(doctorId);
    }
    if (doctor.status !== 'ACTIVE') {
      throw new DoctorInactiveError(doctor.displayName);
    }

    // 3. Compute End Time
    const duration = durationMinutes ?? 15;
    const endTime = computeEndTime(startTime, duration);

    // 4. Validate Doctor Schedule (if doctor has schedules configured)
    const dateObj = new Date(`${appointmentDate}T00:00:00Z`);
    const dayOfWeek = dateObj.getUTCDay(); // 0=Sunday..6=Saturday
    const schedules = await this.doctorRepo.getSchedules(doctorId);
    const daySchedules = schedules.filter((s) => s.dayOfWeek === dayOfWeek && s.isActive);

    if (schedules.length > 0) {
      if (daySchedules.length === 0) {
        throw new OutsideDoctorScheduleError(
          `Dr. ${doctor.displayName} is not scheduled to consult on ${dateObj.toLocaleDateString('en-US', { weekday: 'long' })}.`
        );
      }

      const isWithinAnySlot = daySchedules.some((s) => startTime >= s.startTime && endTime <= s.endTime);
      if (!isWithinAnySlot) {
        const slotDescriptions = daySchedules.map((s) => `${s.startTime}–${s.endTime}`).join(', ');
        throw new OutsideDoctorScheduleError(
          `Selected time (${startTime}–${endTime}) is outside Dr. ${doctor.displayName}'s working hours on this day (${slotDescriptions}).`
        );
      }
    }

    // 5. Conflict Check (overlapping appointments for the same doctor on same date)
    const conflicts = await this.appointmentRepo.findDoctorConflicts(doctorId, appointmentDate, startTime, endTime);
    if (conflicts.length > 0) {
      const conflict = conflicts[0];
      throw new AppointmentConflictError(
        `Dr. ${doctor.displayName} already has an appointment (${conflict.patientName ?? 'Patient'}) scheduled from ${conflict.startTime} to ${conflict.endTime}.`
      );
    }

    // 6. Create Appointment
    const created = await this.appointmentRepo.create({
      organizationId,
      patientId,
      doctorId,
      appointmentDate,
      startTime,
      endTime,
      durationMinutes,
      status: 'SCHEDULED',
      visitPurpose: visitPurpose || undefined,
      notes: notes || undefined,
      createdBy: actor.id
    });

    await this.auditService.logEvent({
      actor: { id: actor.id, username: actor.username, role: actor.roles[0], roles: actor.roles },
      action: AuditAction.APPOINTMENT_CREATED,
      resource: `appointment/${created.id}`,
      result: AuditResult.SUCCESS,
      metadata: {
        appointmentId: created.id,
        patientId,
        doctorId,
        appointmentDate,
        startTime,
        endTime,
        queueNumber: created.queueNumber
      }
    });

    this.logger.info(`Appointment booked: #${created.queueNumber} on ${appointmentDate} ${startTime} (Doctor: ${doctorId}, Patient: ${patient.patientNumber}) by ${actor.username}`);
    return created;
  }

  public async updateAppointment(input: UpdateAppointmentInput, organizationId: string, actor: SessionUser): Promise<Appointment> {
    this.assertPermission(actor, PermissionCode.APPOINTMENT_UPDATE);

    const validated = validateSchema(UpdateAppointmentSchema, input);
    if (!validated.success) {
      throw new ValidationError('Validation failed for updating appointment', validated.errors);
    }

    const { appointmentId, ...updateData } = validated.data;
    const existing = await this.appointmentRepo.findById(appointmentId);
    if (!existing || existing.organizationId !== organizationId) {
      throw new AppointmentNotFoundError(appointmentId);
    }

    const doctorId = updateData.doctorId ?? existing.doctorId;
    const appointmentDate = updateData.appointmentDate ?? existing.appointmentDate;
    const startTime = updateData.startTime ?? existing.startTime;
    const duration = updateData.durationMinutes ?? existing.durationMinutes;
    const endTime = computeEndTime(startTime, duration);

    // If time/doctor/date changed, check conflicts
    if (updateData.startTime || updateData.doctorId || updateData.appointmentDate || updateData.durationMinutes) {
      const conflicts = await this.appointmentRepo.findDoctorConflicts(
        doctorId,
        appointmentDate,
        startTime,
        endTime,
        appointmentId
      );
      if (conflicts.length > 0) {
        const conflict = conflicts[0];
        throw new AppointmentConflictError(
          `Conflict detected: Dr. already has an appointment from ${conflict.startTime} to ${conflict.endTime}.`
        );
      }
    }

    const updated = await this.appointmentRepo.update(appointmentId, {
      ...updateData,
      endTime,
      updatedBy: actor.id
    });

    await this.auditService.logEvent({
      actor: { id: actor.id, username: actor.username, role: actor.roles[0], roles: actor.roles },
      action: AuditAction.APPOINTMENT_UPDATED,
      resource: `appointment/${appointmentId}`,
      result: AuditResult.SUCCESS,
      metadata: { appointmentId, modifiedFields: Object.keys(updateData) }
    });

    return updated;
  }

  public async changeAppointmentStatus(
    input: ChangeAppointmentStatusInput,
    organizationId: string,
    actor: SessionUser
  ): Promise<Appointment> {
    const validated = validateSchema(ChangeAppointmentStatusSchema, input);
    if (!validated.success) {
      throw new ValidationError('Validation failed for status change', validated.errors);
    }

    const { appointmentId, status: targetStatus } = validated.data;

    // RBAC Permission Check by target state
    if (targetStatus === 'CHECKED_IN') {
      const hasCheckin = this.rbacEngine.evaluatePermission(actor.roles, PermissionCode.APPOINTMENT_CHECKIN);
      const hasUpdate = this.rbacEngine.evaluatePermission(actor.roles, PermissionCode.APPOINTMENT_UPDATE);
      if (!hasCheckin && !hasUpdate) {
        throw new AuthorizationError("Access Denied: Missing 'appointment.checkin' permission.");
      }
    } else if (targetStatus === 'CANCELLED') {
      const hasCancel = this.rbacEngine.evaluatePermission(actor.roles, PermissionCode.APPOINTMENT_CANCEL);
      const hasUpdate = this.rbacEngine.evaluatePermission(actor.roles, PermissionCode.APPOINTMENT_UPDATE);
      if (!hasCancel && !hasUpdate) {
        throw new AuthorizationError("Access Denied: Missing 'appointment.cancel' permission.");
      }
    } else {
      const hasQueue = this.rbacEngine.evaluatePermission(actor.roles, PermissionCode.APPOINTMENT_QUEUE_MANAGE);
      const hasUpdate = this.rbacEngine.evaluatePermission(actor.roles, PermissionCode.APPOINTMENT_UPDATE);
      if (!hasQueue && !hasUpdate) {
        throw new AuthorizationError("Access Denied: Missing 'appointment.queue.manage' permission.");
      }
    }

    const existing = await this.appointmentRepo.findById(appointmentId);
    if (!existing || existing.organizationId !== organizationId) {
      throw new AppointmentNotFoundError(appointmentId);
    }

    // State machine check
    const currentStatus = existing.status;
    const allowedTargets = ALLOWED_STATUS_TRANSITIONS[currentStatus] || [];
    if (!allowedTargets.includes(targetStatus)) {
      throw new InvalidAppointmentTransitionError(currentStatus, targetStatus);
    }

    const updated = await this.appointmentRepo.updateStatus(appointmentId, targetStatus, actor.id);

    let auditAction: AuditAction = AuditAction.APPOINTMENT_STATUS_CHANGED;
    if (targetStatus === 'CHECKED_IN') auditAction = AuditAction.APPOINTMENT_CHECKED_IN;
    if (targetStatus === 'CANCELLED') auditAction = AuditAction.APPOINTMENT_CANCELLED;

    await this.auditService.logEvent({
      actor: { id: actor.id, username: actor.username, role: actor.roles[0], roles: actor.roles },
      action: auditAction,
      resource: `appointment/${appointmentId}`,
      result: AuditResult.SUCCESS,
      metadata: {
        appointmentId,
        previousStatus: currentStatus,
        newStatus: targetStatus
      }
    });

    this.logger.info(`Appointment ${appointmentId} status changed: ${currentStatus} -> ${targetStatus} by ${actor.username}`);
    return updated;
  }

  public async getWaitingQueue(input: GetWaitingQueueInput, actor: SessionUser): Promise<Appointment[]> {
    this.assertPermission(actor, PermissionCode.APPOINTMENT_READ);

    const validated = validateSchema(GetWaitingQueueSchema, input);
    if (!validated.success) {
      throw new ValidationError('Validation failed for waiting queue query', validated.errors);
    }

    return this.appointmentRepo.listQueueByDate(
      validated.data.organizationId,
      validated.data.appointmentDate,
      validated.data.doctorId
    );
  }

  public async listAppointments(input: ListAppointmentsInput, actor: SessionUser): Promise<Appointment[]> {
    this.assertPermission(actor, PermissionCode.APPOINTMENT_READ);

    const validated = validateSchema(ListAppointmentsSchema, input);
    if (!validated.success) {
      throw new ValidationError('Validation failed for listing appointments', validated.errors);
    }

    return this.appointmentRepo.list(validated.data);
  }

  public async getAppointmentById(appointmentId: string, organizationId: string, actor: SessionUser): Promise<Appointment> {
    this.assertPermission(actor, PermissionCode.APPOINTMENT_READ);

    const appointment = await this.appointmentRepo.findById(appointmentId);
    if (!appointment || appointment.organizationId !== organizationId) {
      throw new AppointmentNotFoundError(appointmentId);
    }

    return appointment;
  }

  public async getTodayMetrics(
    organizationId: string,
    appointmentDate: string,
    actor: SessionUser,
    doctorId?: string
  ) {
    this.assertPermission(actor, PermissionCode.APPOINTMENT_READ);
    return this.appointmentRepo.countTodayMetrics(organizationId, appointmentDate, doctorId);
  }
}
