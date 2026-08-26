import {
  IDoctorRepository,
  Doctor,
  DoctorSchedule,
  SessionUser,
  AuditAction,
  AuditResult,
  AuthorizationError,
  ValidationError,
  DoctorNotFoundError,
  PermissionCode
} from '@medidesk/domain';
import { RBACEngine } from '@medidesk/authorization';
import { AuditService } from '@medidesk/audit';
import { Logger } from '@medidesk/shared';
import {
  CreateDoctorInput,
  UpdateDoctorInput,
  SetDoctorSchedulesInput,
  CreateDoctorSchema,
  UpdateDoctorSchema,
  SetDoctorSchedulesSchema,
  validateSchema
} from '@medidesk/validation';

export class DoctorService {
  private doctorRepo: IDoctorRepository;
  private auditService: AuditService;
  private rbacEngine: RBACEngine;
  private logger: Logger;

  constructor(
    doctorRepo: IDoctorRepository,
    auditService: AuditService,
    rbacEngine: RBACEngine
  ) {
    this.doctorRepo = doctorRepo;
    this.auditService = auditService;
    this.rbacEngine = rbacEngine;
    this.logger = new Logger('DoctorService');
  }

  private assertPermission(actor: SessionUser, permission: string): void {
    const hasPermission = this.rbacEngine.evaluatePermission(actor.roles, permission);
    if (!hasPermission) {
      this.logger.warn(`Access Denied: Actor '${actor.username}' lacks permission '${permission}'`);
      throw new AuthorizationError(`Access Denied: Missing '${permission}' permission.`);
    }
  }

  public async createDoctor(input: CreateDoctorInput, actor: SessionUser): Promise<Doctor> {
    this.assertPermission(actor, PermissionCode.DOCTOR_CREATE);

    const validated = validateSchema(CreateDoctorSchema, input);
    if (!validated.success) {
      throw new ValidationError('Validation failed for creating doctor', validated.errors);
    }

    const { schedules, ...doctorData } = validated.data;
    const created = await this.doctorRepo.create({
      ...doctorData,
      registrationNumber: doctorData.registrationNumber || undefined,
      mobile: doctorData.mobile || undefined,
      createdBy: actor.id
    });

    if (schedules && schedules.length > 0) {
      await this.doctorRepo.setSchedules(created.id, schedules);
      created.schedules = await this.doctorRepo.getSchedules(created.id);
    }

    await this.auditService.logEvent({
      actor: { id: actor.id, username: actor.username, role: actor.roles[0], roles: actor.roles },
      action: AuditAction.DOCTOR_CREATED,
      resource: `doctor/${created.id}`,
      result: AuditResult.SUCCESS,
      metadata: {
        doctorId: created.id,
        displayName: created.displayName,
        specialization: created.specialization
      }
    });

    this.logger.info(`Doctor created: ${created.displayName} by ${actor.username}`);
    return created;
  }

  public async listDoctors(
    organizationId: string,
    actor: SessionUser,
    options?: { activeOnly?: boolean }
  ): Promise<Doctor[]> {
    this.assertPermission(actor, PermissionCode.DOCTOR_READ);
    return this.doctorRepo.listByOrganization(organizationId, options);
  }

  public async getDoctorById(doctorId: string, organizationId: string, actor: SessionUser): Promise<Doctor> {
    this.assertPermission(actor, PermissionCode.DOCTOR_READ);

    const doctor = await this.doctorRepo.findById(doctorId);
    if (!doctor || doctor.organizationId !== organizationId) {
      throw new DoctorNotFoundError(doctorId);
    }

    return doctor;
  }

  public async updateDoctor(input: UpdateDoctorInput, organizationId: string, actor: SessionUser): Promise<Doctor> {
    this.assertPermission(actor, PermissionCode.DOCTOR_UPDATE);

    const validated = validateSchema(UpdateDoctorSchema, input);
    if (!validated.success) {
      throw new ValidationError('Validation failed for updating doctor', validated.errors);
    }

    const { doctorId, ...updateData } = validated.data;
    const existing = await this.doctorRepo.findById(doctorId);
    if (!existing || existing.organizationId !== organizationId) {
      throw new DoctorNotFoundError(doctorId);
    }

    const updated = await this.doctorRepo.update(doctorId, {
      ...updateData,
      registrationNumber: updateData.registrationNumber || undefined,
      mobile: updateData.mobile || undefined,
      updatedBy: actor.id
    });

    await this.auditService.logEvent({
      actor: { id: actor.id, username: actor.username, role: actor.roles[0], roles: actor.roles },
      action: AuditAction.DOCTOR_UPDATED,
      resource: `doctor/${doctorId}`,
      result: AuditResult.SUCCESS,
      metadata: {
        doctorId,
        displayName: updated.displayName,
        modifiedFields: Object.keys(updateData)
      }
    });

    this.logger.info(`Doctor updated: ${updated.displayName} by ${actor.username}`);
    return updated;
  }

  public async deactivateDoctor(doctorId: string, organizationId: string, actor: SessionUser): Promise<Doctor> {
    this.assertPermission(actor, PermissionCode.DOCTOR_DEACTIVATE);

    const existing = await this.doctorRepo.findById(doctorId);
    if (!existing || existing.organizationId !== organizationId) {
      throw new DoctorNotFoundError(doctorId);
    }

    const updated = await this.doctorRepo.update(doctorId, {
      status: 'INACTIVE',
      updatedBy: actor.id
    });

    await this.auditService.logEvent({
      actor: { id: actor.id, username: actor.username, role: actor.roles[0], roles: actor.roles },
      action: AuditAction.DOCTOR_DEACTIVATED,
      resource: `doctor/${doctorId}`,
      result: AuditResult.SUCCESS,
      metadata: { doctorId, displayName: updated.displayName }
    });

    this.logger.info(`Doctor deactivated: ${updated.displayName} by ${actor.username}`);
    return updated;
  }

  public async setDoctorSchedules(
    input: SetDoctorSchedulesInput,
    organizationId: string,
    actor: SessionUser
  ): Promise<DoctorSchedule[]> {
    this.assertPermission(actor, PermissionCode.DOCTOR_UPDATE);

    const validated = validateSchema(SetDoctorSchedulesSchema, input);
    if (!validated.success) {
      throw new ValidationError('Validation failed for doctor schedules', validated.errors);
    }

    const { doctorId, schedules } = validated.data;
    const existing = await this.doctorRepo.findById(doctorId);
    if (!existing || existing.organizationId !== organizationId) {
      throw new DoctorNotFoundError(doctorId);
    }

    const updatedSchedules = await this.doctorRepo.setSchedules(doctorId, schedules);

    await this.auditService.logEvent({
      actor: { id: actor.id, username: actor.username, role: actor.roles[0], roles: actor.roles },
      action: AuditAction.DOCTOR_UPDATED,
      resource: `doctor/${doctorId}/schedules`,
      result: AuditResult.SUCCESS,
      metadata: { doctorId, scheduleCount: updatedSchedules.length }
    });

    this.logger.info(`Updated schedules for doctor: ${existing.displayName} by ${actor.username}`);
    return updatedSchedules;
  }

  public async getDoctorSchedules(doctorId: string, organizationId: string, actor: SessionUser): Promise<DoctorSchedule[]> {
    this.assertPermission(actor, PermissionCode.DOCTOR_READ);

    const existing = await this.doctorRepo.findById(doctorId);
    if (!existing || existing.organizationId !== organizationId) {
      throw new DoctorNotFoundError(doctorId);
    }

    return this.doctorRepo.getSchedules(doctorId);
  }
}
