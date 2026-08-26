import {
  IPatientRepository,
  Patient,
  DuplicatePatientMatch,
  SessionUser,
  AuditAction,
  AuditResult,
  AuthorizationError,
  ValidationError,
  PatientNotFoundError,
  DuplicatePatientWarningError,
  PermissionCode
} from '@medidesk/domain';
import { RBACEngine } from '@medidesk/authorization';
import { AuditService } from '@medidesk/audit';
import { Logger } from '@medidesk/shared';
import {
  CreatePatientInput,
  UpdatePatientInput,
  SearchPatientInput,
  CheckDuplicatesInput,
  CreatePatientSchema,
  UpdatePatientSchema,
  SearchPatientSchema,
  CheckDuplicatesSchema,
  validateSchema
} from '@medidesk/validation';

export class PatientService {
  private patientRepo: IPatientRepository;
  private auditService: AuditService;
  private rbacEngine: RBACEngine;
  private logger: Logger;

  constructor(
    patientRepo: IPatientRepository,
    auditService: AuditService,
    rbacEngine: RBACEngine
  ) {
    this.patientRepo = patientRepo;
    this.auditService = auditService;
    this.rbacEngine = rbacEngine;
    this.logger = new Logger('PatientService');
  }

  private assertPermission(actor: SessionUser, permission: string): void {
    const hasPermission = this.rbacEngine.evaluatePermission(actor.roles, permission);
    if (!hasPermission) {
      this.logger.warn(`Access Denied: Actor '${actor.username}' lacks permission '${permission}'`);
      throw new AuthorizationError(`Access Denied: Missing '${permission}' permission.`);
    }
  }

  public async checkDuplicates(input: CheckDuplicatesInput, actor: SessionUser): Promise<DuplicatePatientMatch[]> {
    this.assertPermission(actor, PermissionCode.PATIENT_READ);

    const validated = validateSchema(CheckDuplicatesSchema, input);
    if (!validated.success) {
      throw new ValidationError('Validation failed for duplicate check', validated.errors);
    }

    return this.patientRepo.findPotentialDuplicates(validated.data.organizationId, {
      fullName: validated.data.fullName,
      mobile: validated.data.mobile,
      dateOfBirth: validated.data.dateOfBirth,
      sex: validated.data.sex,
      excludePatientId: validated.data.excludePatientId
    });
  }

  public async registerPatient(
    input: CreatePatientInput,
    actor: SessionUser,
    options?: { forceCreateOnDuplicate?: boolean }
  ): Promise<Patient> {
    this.assertPermission(actor, PermissionCode.PATIENT_CREATE);

    const validated = validateSchema(CreatePatientSchema, input);
    if (!validated.success) {
      throw new ValidationError('Validation failed for patient registration', validated.errors);
    }

    const { organizationId, fullName, mobile, dateOfBirth, sex } = validated.data;

    // Check potential duplicate records
    if (!options?.forceCreateOnDuplicate) {
      const duplicates = await this.patientRepo.findPotentialDuplicates(organizationId, {
        fullName,
        mobile,
        dateOfBirth,
        sex
      });

      const hasStrongOrMediumMatch = duplicates.some((d) => d.confidence === 'STRONG' || d.confidence === 'MEDIUM');
      if (hasStrongOrMediumMatch) {
        await this.auditService.logEvent({
          actor: { id: actor.id, username: actor.username, role: actor.roles[0], roles: actor.roles },
          action: AuditAction.PATIENT_DUPLICATE_WARNING,
          resource: 'patient/registration',
          result: AuditResult.SUCCESS,
          metadata: {
            matchesFound: duplicates.length,
            matchPatientIds: duplicates.map((d) => d.patient.id)
          }
        });

        throw new DuplicatePatientWarningError(
          `Possible existing patient records detected (${duplicates.length} match${duplicates.length > 1 ? 'es' : ''}). Please review before creating a new record.`,
          duplicates
        );
      }
    }

    const created = await this.patientRepo.create({
      organizationId,
      fullName,
      dateOfBirth: validated.data.dateOfBirth || undefined,
      age: validated.data.age,
      sex: validated.data.sex,
      mobile: validated.data.mobile || undefined,
      alternateMobile: validated.data.alternateMobile || undefined,
      address: validated.data.address || undefined,
      emergencyContactName: validated.data.emergencyContactName || undefined,
      emergencyContactPhone: validated.data.emergencyContactPhone || undefined,
      createdBy: actor.id
    });

    await this.auditService.logEvent({
      actor: { id: actor.id, username: actor.username, role: actor.roles[0], roles: actor.roles },
      action: AuditAction.PATIENT_CREATED,
      resource: `patient/${created.id}`,
      result: AuditResult.SUCCESS,
      metadata: {
        patientId: created.id,
        patientNumber: created.patientNumber,
        forcedOnDuplicate: Boolean(options?.forceCreateOnDuplicate)
      }
    });

    this.logger.info(`Patient registered: ${created.patientNumber} by ${actor.username}`);
    return created;
  }

  public async searchPatients(input: SearchPatientInput, actor: SessionUser): Promise<Patient[]> {
    this.assertPermission(actor, PermissionCode.PATIENT_READ);

    const validated = validateSchema(SearchPatientSchema, input);
    if (!validated.success) {
      throw new ValidationError('Validation failed for patient search', validated.errors);
    }

    return this.patientRepo.search(validated.data);
  }

  public async getPatientById(patientId: string, organizationId: string, actor: SessionUser): Promise<Patient> {
    this.assertPermission(actor, PermissionCode.PATIENT_READ);

    const patient = await this.patientRepo.findById(patientId);
    if (!patient || patient.organizationId !== organizationId) {
      throw new PatientNotFoundError(patientId);
    }

    return patient;
  }

  public async updatePatient(input: UpdatePatientInput, organizationId: string, actor: SessionUser): Promise<Patient> {
    this.assertPermission(actor, PermissionCode.PATIENT_UPDATE);

    const validated = validateSchema(UpdatePatientSchema, input);
    if (!validated.success) {
      throw new ValidationError('Validation failed for patient update', validated.errors);
    }

    const { patientId, ...updateData } = validated.data;
    const existing = await this.patientRepo.findById(patientId);
    if (!existing || existing.organizationId !== organizationId) {
      throw new PatientNotFoundError(patientId);
    }

    const updated = await this.patientRepo.update(patientId, {
      ...updateData,
      updatedBy: actor.id
    });

    await this.auditService.logEvent({
      actor: { id: actor.id, username: actor.username, role: actor.roles[0], roles: actor.roles },
      action: AuditAction.PATIENT_UPDATED,
      resource: `patient/${patientId}`,
      result: AuditResult.SUCCESS,
      metadata: {
        patientId,
        patientNumber: existing.patientNumber,
        modifiedFields: Object.keys(updateData)
      }
    });

    this.logger.info(`Patient updated: ${existing.patientNumber} by ${actor.username}`);
    return updated;
  }
}
