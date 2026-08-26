import {
  Prescription,
  PrescriptionVersion,
  SessionUser,
  PermissionCode,
  AuditAction,
  AuditResult,
  PrescriptionNotFoundError,
  DrugAllergyWarningError,
  IPrescriptionRepository,
  IPatientRepository,
  IDoctorRepository,
  IAllergyRepository,
  PatientNotFoundError,
  DoctorNotFoundError,
  DoctorInactiveError,
  AuthorizationError,
  ValidationError
} from '@medidesk/domain';
import { IAuditService } from '@medidesk/audit';
import { RBACEngine } from '@medidesk/authorization';
import {
  CreatePrescriptionSchema,
  RevisePrescriptionSchema,
  SignPrescriptionSchema,
  CancelPrescriptionSchema,
  CreatePrescriptionInput,
  RevisePrescriptionInput,
  SignPrescriptionInput,
  CancelPrescriptionInput,
  validateSchema
} from '@medidesk/validation';

export class PrescriptionService {
  private rxRepo: IPrescriptionRepository;
  private patientRepo: IPatientRepository;
  private doctorRepo: IDoctorRepository;
  private allergyRepo?: IAllergyRepository;
  private auditService: IAuditService;
  private rbac: RBACEngine;

  constructor(
    rxRepo: IPrescriptionRepository,
    patientRepo: IPatientRepository,
    doctorRepo: IDoctorRepository,
    auditService: IAuditService,
    rbac: RBACEngine,
    allergyRepo?: IAllergyRepository
  ) {
    this.rxRepo = rxRepo;
    this.patientRepo = patientRepo;
    this.doctorRepo = doctorRepo;
    this.auditService = auditService;
    this.rbac = rbac;
    this.allergyRepo = allergyRepo;
  }

  private assertPermission(actor: SessionUser, permission: PermissionCode): void {
    const hasPermission = this.rbac.evaluatePermission(actor.roles, permission);
    if (!hasPermission) {
      throw new AuthorizationError(`Access Denied: Missing '${permission}' permission.`);
    }
  }

  private async checkAllergies(patientId: string, organizationId: string, items: { medicineName: string }[], ignoreWarning = false): Promise<void> {
    if (ignoreWarning || !this.allergyRepo) return;

    const allergies = await this.allergyRepo.listByPatient(patientId, organizationId);
    const activeDrugAllergies = allergies.filter((a) => a.status === 'KNOWN' && a.category === 'DRUG' && a.allergenName);

    for (const item of items) {
      const medLower = item.medicineName.toLowerCase();
      const match = activeDrugAllergies.find((a) => a.allergenName && medLower.includes(a.allergenName.toLowerCase()));
      if (match && match.allergenName) {
        throw new DrugAllergyWarningError(item.medicineName, match.allergenName);
      }
    }
  }

  public async createPrescription(
    input: CreatePrescriptionInput,
    actor: SessionUser,
    options?: { ignoreAllergyWarning?: boolean }
  ): Promise<Prescription> {
    this.assertPermission(actor, PermissionCode.PRESCRIPTION_CREATE);

    const validated = validateSchema(CreatePrescriptionSchema, input);
    if (!validated.success) {
      throw new ValidationError('Validation failed for prescription creation', validated.errors);
    }

    const { organizationId, patientId, doctorId, clinicalVisitId, items, notes } = validated.data;

    // 1. Verify Patient
    const patient = await this.patientRepo.findById(patientId);
    if (!patient || patient.organizationId !== organizationId) {
      throw new PatientNotFoundError(patientId);
    }

    // 2. Verify Doctor
    const doctor = await this.doctorRepo.findById(doctorId);
    if (!doctor || doctor.organizationId !== organizationId) {
      throw new DoctorNotFoundError(doctorId);
    }
    if (doctor.status !== 'ACTIVE') {
      throw new DoctorInactiveError(doctor.displayName);
    }

    // 3. Check for Drug Allergy Conflicts
    await this.checkAllergies(patientId, organizationId, items, options?.ignoreAllergyWarning);

    // 4. Create Prescription
    const created = await this.rxRepo.create({
      organizationId,
      patientId,
      doctorId,
      clinicalVisitId: clinicalVisitId || undefined,
      items,
      notes: notes || undefined,
      createdBy: actor.id
    });

    await this.auditService.logEvent({
      actor: { id: actor.id, username: actor.username, role: actor.roles[0], roles: actor.roles },
      action: AuditAction.PRESCRIPTION_CREATED,
      resource: `prescription/${created.id}`,
      result: AuditResult.SUCCESS,
      metadata: {
        prescriptionId: created.id,
        patientId,
        doctorId,
        itemCount: items.length
      }
    });

    return created;
  }

  public async getPrescriptionById(prescriptionId: string, organizationId: string, actor: SessionUser): Promise<Prescription> {
    this.assertPermission(actor, PermissionCode.PRESCRIPTION_READ);

    const rx = await this.rxRepo.findById(prescriptionId, organizationId);
    if (!rx) {
      throw new PrescriptionNotFoundError(prescriptionId);
    }
    return rx;
  }

  public async getPrescriptionByVisitId(visitId: string, organizationId: string, actor: SessionUser): Promise<Prescription | null> {
    this.assertPermission(actor, PermissionCode.PRESCRIPTION_READ);
    return this.rxRepo.findByVisitId(visitId, organizationId);
  }

  public async listPrescriptionsByPatient(patientId: string, organizationId: string, actor: SessionUser, limit = 50): Promise<Prescription[]> {
    this.assertPermission(actor, PermissionCode.PRESCRIPTION_READ);

    const patient = await this.patientRepo.findById(patientId);
    if (!patient || patient.organizationId !== organizationId) {
      throw new PatientNotFoundError(patientId);
    }

    return this.rxRepo.listByPatient(patientId, organizationId, limit);
  }

  public async signPrescription(input: SignPrescriptionInput, actor: SessionUser): Promise<Prescription> {
    this.assertPermission(actor, PermissionCode.PRESCRIPTION_SIGN);

    const validated = validateSchema(SignPrescriptionSchema, input);
    if (!validated.success) {
      throw new ValidationError('Validation failed for signing prescription', validated.errors);
    }

    const { prescriptionId, organizationId } = validated.data;
    const existing = await this.rxRepo.findById(prescriptionId, organizationId);
    if (!existing) {
      throw new PrescriptionNotFoundError(prescriptionId);
    }

    const signed = await this.rxRepo.sign(prescriptionId, organizationId, actor.id);

    await this.auditService.logEvent({
      actor: { id: actor.id, username: actor.username, role: actor.roles[0], roles: actor.roles },
      action: AuditAction.PRESCRIPTION_SIGNED,
      resource: `prescription/${prescriptionId}`,
      result: AuditResult.SUCCESS,
      metadata: {
        prescriptionId,
        patientId: existing.patientId,
        versionNumber: signed.currentVersionNumber
      }
    });

    return signed;
  }

  public async revisePrescription(
    input: RevisePrescriptionInput,
    actor: SessionUser,
    options?: { ignoreAllergyWarning?: boolean }
  ): Promise<Prescription> {
    this.assertPermission(actor, PermissionCode.PRESCRIPTION_UPDATE);

    const validated = validateSchema(RevisePrescriptionSchema, input);
    if (!validated.success) {
      throw new ValidationError('Validation failed for revising prescription', validated.errors);
    }

    const { prescriptionId, organizationId, reasonForChange, items, notes } = validated.data;
    const existing = await this.rxRepo.findById(prescriptionId, organizationId);
    if (!existing) {
      throw new PrescriptionNotFoundError(prescriptionId);
    }

    // Check allergies
    await this.checkAllergies(existing.patientId, organizationId, items, options?.ignoreAllergyWarning);

    const revised = await this.rxRepo.revise(
      {
        prescriptionId,
        reasonForChange,
        items,
        notes: notes || undefined,
        updatedBy: actor.id
      },
      organizationId
    );

    await this.auditService.logEvent({
      actor: { id: actor.id, username: actor.username, role: actor.roles[0], roles: actor.roles },
      action: AuditAction.PRESCRIPTION_VERSION_CREATED,
      resource: `prescription/${prescriptionId}`,
      result: AuditResult.SUCCESS,
      metadata: {
        prescriptionId,
        patientId: existing.patientId,
        newVersionNumber: revised.currentVersionNumber,
        reason: reasonForChange
      }
    });

    return revised;
  }

  public async cancelPrescription(input: CancelPrescriptionInput, actor: SessionUser): Promise<Prescription> {
    this.assertPermission(actor, PermissionCode.PRESCRIPTION_CANCEL);

    const validated = validateSchema(CancelPrescriptionSchema, input);
    if (!validated.success) {
      throw new ValidationError('Validation failed for cancelling prescription', validated.errors);
    }

    const { prescriptionId, organizationId, reason } = validated.data;
    const existing = await this.rxRepo.findById(prescriptionId, organizationId);
    if (!existing) {
      throw new PrescriptionNotFoundError(prescriptionId);
    }

    const cancelled = await this.rxRepo.cancel(prescriptionId, organizationId, actor.id, reason);

    await this.auditService.logEvent({
      actor: { id: actor.id, username: actor.username, role: actor.roles[0], roles: actor.roles },
      action: AuditAction.PRESCRIPTION_CANCELLED,
      resource: `prescription/${prescriptionId}`,
      result: AuditResult.SUCCESS,
      metadata: {
        prescriptionId,
        patientId: existing.patientId,
        reason
      }
    });

    return cancelled;
  }

  public async getPrescriptionVersions(prescriptionId: string, organizationId: string, actor: SessionUser): Promise<PrescriptionVersion[]> {
    this.assertPermission(actor, PermissionCode.PRESCRIPTION_READ);
    return this.rxRepo.getVersions(prescriptionId, organizationId);
  }
}
