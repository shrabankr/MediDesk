import {
  ClinicalVisit,
  SessionUser,
  PermissionCode,
  AuditAction,
  AuditResult,
  ClinicalVisitNotFoundError,
  VisitCompletedLockedError,
  InvalidVisitTransitionError,
  IClinicalVisitRepository,
  IPatientRepository,
  IDoctorRepository,
  IAppointmentRepository,
  IClinicalCorrectionRepository,
  PatientNotFoundError,
  DoctorNotFoundError,
  DoctorInactiveError,
  AuthorizationError,
  ValidationError
} from '@medidesk/domain';
import { IAuditService } from '@medidesk/audit';
import { RBACEngine } from '@medidesk/authorization';
import {
  CreateClinicalVisitSchema,
  UpdateClinicalVisitSchema,
  CreateClinicalVisitInput,
  UpdateClinicalVisitInput,
  RequestClinicalCorrectionSchema,
  RequestClinicalCorrectionInput,
  validateSchema
} from '@medidesk/validation';

export class ClinicalVisitService {
  private visitRepo: IClinicalVisitRepository;
  private patientRepo: IPatientRepository;
  private doctorRepo: IDoctorRepository;
  private appointmentRepo?: IAppointmentRepository;
  private correctionRepo?: IClinicalCorrectionRepository;
  private auditService: IAuditService;
  private rbac: RBACEngine;

  constructor(
    visitRepo: IClinicalVisitRepository,
    patientRepo: IPatientRepository,
    doctorRepo: IDoctorRepository,
    auditService: IAuditService,
    rbac: RBACEngine,
    appointmentRepo?: IAppointmentRepository,
    correctionRepo?: IClinicalCorrectionRepository
  ) {
    this.visitRepo = visitRepo;
    this.patientRepo = patientRepo;
    this.doctorRepo = doctorRepo;
    this.auditService = auditService;
    this.rbac = rbac;
    this.appointmentRepo = appointmentRepo;
    this.correctionRepo = correctionRepo;
  }

  private assertPermission(actor: SessionUser, permission: PermissionCode): void {
    const hasPermission = this.rbac.evaluatePermission(actor.roles, permission);
    if (!hasPermission) {
      throw new AuthorizationError(`Access Denied: Missing '${permission}' permission.`);
    }
  }

  public async createVisit(input: CreateClinicalVisitInput, actor: SessionUser): Promise<ClinicalVisit> {
    this.assertPermission(actor, PermissionCode.CLINICAL_CREATE);

    const validated = validateSchema(CreateClinicalVisitSchema, input);
    if (!validated.success) {
      throw new ValidationError('Validation failed for clinical visit creation', validated.errors);
    }

    const { organizationId, patientId, doctorId, appointmentId, chiefComplaint, historyOfPresentIllness, examinationNotes, clinicalAssessment } = validated.data;

    // 1. Verify Patient exists
    const patient = await this.patientRepo.findById(patientId);
    if (!patient || patient.organizationId !== organizationId) {
      throw new PatientNotFoundError(patientId);
    }

    // 2. Verify Doctor exists and is ACTIVE
    const doctor = await this.doctorRepo.findById(doctorId);
    if (!doctor || doctor.organizationId !== organizationId) {
      throw new DoctorNotFoundError(doctorId);
    }
    if (doctor.status !== 'ACTIVE') {
      throw new DoctorInactiveError(doctor.displayName);
    }

    // 3. Create Visit
    const created = await this.visitRepo.create({
      organizationId,
      patientId,
      doctorId,
      appointmentId: appointmentId || undefined,
      chiefComplaint: chiefComplaint || undefined,
      historyOfPresentIllness: historyOfPresentIllness || undefined,
      examinationNotes: examinationNotes || undefined,
      clinicalAssessment: clinicalAssessment || undefined,
      createdBy: actor.id
    });

    // 4. Update Appointment status to IN_CONSULTATION if linked
    if (appointmentId && this.appointmentRepo) {
      try {
        await this.appointmentRepo.updateStatus(appointmentId, 'IN_CONSULTATION', actor.id);
      } catch {
        // Continue if appointment already transitioned
      }
    }

    await this.auditService.logEvent({
      actor: { id: actor.id, username: actor.username, role: actor.roles[0], roles: actor.roles },
      action: AuditAction.VISIT_CREATED,
      resource: `visit/${created.id}`,
      result: AuditResult.SUCCESS,
      metadata: {
        visitId: created.id,
        patientId,
        doctorId,
        appointmentId
      }
    });

    return created;
  }

  public async getVisitById(visitId: string, organizationId: string, actor: SessionUser): Promise<ClinicalVisit> {
    this.assertPermission(actor, PermissionCode.CLINICAL_READ);

    const visit = await this.visitRepo.findById(visitId, organizationId);
    if (!visit) {
      throw new ClinicalVisitNotFoundError(visitId);
    }
    return visit;
  }

  public async listVisitsByPatient(patientId: string, organizationId: string, actor: SessionUser, limit = 50): Promise<ClinicalVisit[]> {
    this.assertPermission(actor, PermissionCode.CLINICAL_READ);

    const patient = await this.patientRepo.findById(patientId);
    if (!patient || patient.organizationId !== organizationId) {
      throw new PatientNotFoundError(patientId);
    }

    return this.visitRepo.listByPatient(patientId, organizationId, limit);
  }

  public async updateVisit(input: UpdateClinicalVisitInput, actor: SessionUser): Promise<ClinicalVisit> {
    this.assertPermission(actor, PermissionCode.CLINICAL_UPDATE);

    const validated = validateSchema(UpdateClinicalVisitSchema, input);
    if (!validated.success) {
      throw new ValidationError('Validation failed for clinical visit update', validated.errors);
    }

    const { visitId, organizationId, chiefComplaint, historyOfPresentIllness, examinationNotes, clinicalAssessment, status } = validated.data;

    const existing = await this.visitRepo.findById(visitId, organizationId);
    if (!existing) {
      throw new ClinicalVisitNotFoundError(visitId);
    }

    // Locked check: completed visits cannot be modified directly
    if (existing.status === 'COMPLETED') {
      throw new VisitCompletedLockedError(visitId);
    }

    if (existing.status === 'CANCELLED') {
      throw new InvalidVisitTransitionError('CANCELLED', status || 'UPDATED');
    }

    const updated = await this.visitRepo.update(visitId, organizationId, {
      chiefComplaint,
      historyOfPresentIllness,
      examinationNotes,
      clinicalAssessment,
      status,
      updatedBy: actor.id
    });

    await this.auditService.logEvent({
      actor: { id: actor.id, username: actor.username, role: actor.roles[0], roles: actor.roles },
      action: AuditAction.VISIT_UPDATED,
      resource: `visit/${visitId}`,
      result: AuditResult.SUCCESS,
      metadata: {
        visitId,
        patientId: existing.patientId,
        status: updated.status
      }
    });

    return updated;
  }

  public async completeVisit(visitId: string, organizationId: string, actor: SessionUser): Promise<ClinicalVisit> {
    this.assertPermission(actor, PermissionCode.CLINICAL_COMPLETE);

    const existing = await this.visitRepo.findById(visitId, organizationId);
    if (!existing) {
      throw new ClinicalVisitNotFoundError(visitId);
    }

    if (existing.status === 'COMPLETED') {
      return existing; // Already completed
    }

    if (existing.status === 'CANCELLED') {
      throw new InvalidVisitTransitionError('CANCELLED', 'COMPLETED');
    }

    const completed = await this.visitRepo.complete(visitId, organizationId, actor.id);

    // Update appointment status to COMPLETED if linked
    if (existing.appointmentId && this.appointmentRepo) {
      try {
        await this.appointmentRepo.updateStatus(existing.appointmentId, 'COMPLETED', actor.id);
      } catch {
        // Continue
      }
    }

    await this.auditService.logEvent({
      actor: { id: actor.id, username: actor.username, role: actor.roles[0], roles: actor.roles },
      action: AuditAction.VISIT_COMPLETED,
      resource: `visit/${visitId}`,
      result: AuditResult.SUCCESS,
      metadata: {
        visitId,
        patientId: existing.patientId,
        doctorId: existing.doctorId
      }
    });

    return completed;
  }

  public async cancelVisit(visitId: string, organizationId: string, actor: SessionUser): Promise<ClinicalVisit> {
    this.assertPermission(actor, PermissionCode.CLINICAL_UPDATE);

    const existing = await this.visitRepo.findById(visitId, organizationId);
    if (!existing) {
      throw new ClinicalVisitNotFoundError(visitId);
    }

    if (existing.status === 'COMPLETED') {
      throw new VisitCompletedLockedError(visitId);
    }

    const cancelled = await this.visitRepo.cancel(visitId, organizationId, actor.id);

    await this.auditService.logEvent({
      actor: { id: actor.id, username: actor.username, role: actor.roles[0], roles: actor.roles },
      action: AuditAction.VISIT_CANCELLED,
      resource: `visit/${visitId}`,
      result: AuditResult.SUCCESS,
      metadata: {
        visitId,
        patientId: existing.patientId
      }
    });

    return cancelled;
  }

  public async correctVisit(input: RequestClinicalCorrectionInput, actor: SessionUser): Promise<ClinicalVisit> {
    this.assertPermission(actor, PermissionCode.CLINICAL_CORRECT);

    const validated = validateSchema(RequestClinicalCorrectionSchema, input);
    if (!validated.success) {
      throw new ValidationError('Validation failed for clinical correction', validated.errors);
    }

    const { organizationId, resourceId, correctedPayload, reason } = validated.data;

    const existing = await this.visitRepo.findById(resourceId, organizationId);
    if (!existing) {
      throw new ClinicalVisitNotFoundError(resourceId);
    }

    const priorStateJson = JSON.stringify(existing);
    const correctedStateJson = JSON.stringify(correctedPayload);

    // Save correction snapshot
    if (this.correctionRepo) {
      await this.correctionRepo.create({
        organizationId,
        resourceType: 'CLINICAL_VISIT',
        resourceId,
        priorStateJson,
        correctedStateJson,
        reason,
        requestedBy: actor.id,
        approvedBy: actor.id
      });
    }

    // Apply correction updates
    const updated = await this.visitRepo.update(resourceId, organizationId, {
      chiefComplaint: typeof correctedPayload.chiefComplaint === 'string' ? correctedPayload.chiefComplaint : undefined,
      historyOfPresentIllness: typeof correctedPayload.historyOfPresentIllness === 'string' ? correctedPayload.historyOfPresentIllness : undefined,
      examinationNotes: typeof correctedPayload.examinationNotes === 'string' ? correctedPayload.examinationNotes : undefined,
      clinicalAssessment: typeof correctedPayload.clinicalAssessment === 'string' ? correctedPayload.clinicalAssessment : undefined,
      updatedBy: actor.id
    });

    await this.auditService.logEvent({
      actor: { id: actor.id, username: actor.username, role: actor.roles[0], roles: actor.roles },
      action: AuditAction.CLINICAL_CORRECTION_APPLIED,
      resource: `visit/${resourceId}`,
      result: AuditResult.SUCCESS,
      metadata: {
        visitId: resourceId,
        patientId: existing.patientId,
        reason
      }
    });

    return updated;
  }
}
