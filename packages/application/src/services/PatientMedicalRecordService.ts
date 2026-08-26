import {
  Vitals,
  Allergy,
  MedicalHistory,
  Diagnosis,
  FollowUp,
  FollowUpStatus,
  SessionUser,
  PermissionCode,
  AuditAction,
  AuditResult,
  IVitalsRepository,
  IAllergyRepository,
  IMedicalHistoryRepository,
  IDiagnosisRepository,
  IFollowUpRepository,
  IPatientRepository,
  PatientNotFoundError,
  AuthorizationError,
  ValidationError
} from '@medidesk/domain';
import { IAuditService } from '@medidesk/audit';
import { RBACEngine } from '@medidesk/authorization';
import {
  RecordVitalsSchema,
  RecordAllergySchema,
  UpdateAllergySchema,
  RecordMedicalHistorySchema,
  UpdateMedicalHistorySchema,
  RecordDiagnosisSchema,
  UpdateDiagnosisSchema,
  ScheduleFollowUpSchema,
  UpdateFollowUpStatusSchema,
  RecordVitalsInput,
  RecordAllergyInput,
  UpdateAllergyInput,
  RecordMedicalHistoryInput,
  UpdateMedicalHistoryInput,
  RecordDiagnosisInput,
  UpdateDiagnosisInput,
  ScheduleFollowUpInput,
  UpdateFollowUpStatusInput,
  validateSchema
} from '@medidesk/validation';

export class PatientMedicalRecordService {
  private vitalsRepo: IVitalsRepository;
  private allergyRepo: IAllergyRepository;
  private historyRepo: IMedicalHistoryRepository;
  private diagnosisRepo: IDiagnosisRepository;
  private followUpRepo: IFollowUpRepository;
  private patientRepo: IPatientRepository;
  private auditService: IAuditService;
  private rbac: RBACEngine;

  constructor(
    vitalsRepo: IVitalsRepository,
    allergyRepo: IAllergyRepository,
    historyRepo: IMedicalHistoryRepository,
    diagnosisRepo: IDiagnosisRepository,
    followUpRepo: IFollowUpRepository,
    patientRepo: IPatientRepository,
    auditService: IAuditService,
    rbac: RBACEngine
  ) {
    this.vitalsRepo = vitalsRepo;
    this.allergyRepo = allergyRepo;
    this.historyRepo = historyRepo;
    this.diagnosisRepo = diagnosisRepo;
    this.followUpRepo = followUpRepo;
    this.patientRepo = patientRepo;
    this.auditService = auditService;
    this.rbac = rbac;
  }

  private assertPermission(actor: SessionUser, permission: PermissionCode): void {
    const hasPermission = this.rbac.evaluatePermission(actor.roles, permission);
    if (!hasPermission) {
      throw new AuthorizationError(`Access Denied: Missing '${permission}' permission.`);
    }
  }

  // ==========================================
  // VITALS
  // ==========================================
  public async recordVitals(input: RecordVitalsInput, actor: SessionUser): Promise<Vitals> {
    this.assertPermission(actor, PermissionCode.VITALS_CREATE);

    const validated = validateSchema(RecordVitalsSchema, input);
    if (!validated.success) {
      throw new ValidationError('Validation failed for vitals recording', validated.errors);
    }

    const { organizationId, patientId, clinicalVisitId, temperature, temperatureUnit, pulseRate, respiratoryRate, systolicBp, diastolicBp, oxygenSaturationSpo2, weightKg, heightCm, bmi, notes } = validated.data;

    const patient = await this.patientRepo.findById(patientId);
    if (!patient || patient.organizationId !== organizationId) {
      throw new PatientNotFoundError(patientId);
    }

    const created = await this.vitalsRepo.create({
      organizationId,
      patientId,
      clinicalVisitId,
      temperature,
      temperatureUnit,
      pulseRate,
      respiratoryRate,
      systolicBp,
      diastolicBp,
      oxygenSaturationSpo2,
      weightKg,
      heightCm,
      bmi,
      notes,
      recordedBy: actor.id
    });

    await this.auditService.logEvent({
      actor: { id: actor.id, username: actor.username, role: actor.roles[0], roles: actor.roles },
      action: AuditAction.VITALS_CREATED,
      resource: `vitals/${created.id}`,
      result: AuditResult.SUCCESS,
      metadata: {
        vitalsId: created.id,
        patientId,
        clinicalVisitId
      }
    });

    return created;
  }

  public async getVitalsByPatient(patientId: string, organizationId: string, actor: SessionUser, limit = 50): Promise<Vitals[]> {
    this.assertPermission(actor, PermissionCode.VITALS_READ);
    const patient = await this.patientRepo.findById(patientId);
    if (!patient || patient.organizationId !== organizationId) {
      return [];
    }
    return this.vitalsRepo.listByPatient(patientId, organizationId, limit);
  }

  public async getVitalsByVisit(visitId: string, organizationId: string, actor: SessionUser): Promise<Vitals[]> {
    this.assertPermission(actor, PermissionCode.VITALS_READ);
    return this.vitalsRepo.findByVisitId(visitId, organizationId);
  }

  public async getLatestVitalsByPatient(patientId: string, organizationId: string, actor: SessionUser): Promise<Vitals | null> {
    this.assertPermission(actor, PermissionCode.VITALS_READ);
    const patient = await this.patientRepo.findById(patientId);
    if (!patient || patient.organizationId !== organizationId) {
      return null;
    }
    return this.vitalsRepo.getLatestByPatient(patientId, organizationId);
  }

  // ==========================================
  // ALLERGIES
  // ==========================================
  public async recordAllergy(input: RecordAllergyInput, actor: SessionUser): Promise<Allergy> {
    this.assertPermission(actor, PermissionCode.ALLERGY_CREATE);

    const validated = validateSchema(RecordAllergySchema, input);
    if (!validated.success) {
      throw new ValidationError('Validation failed for allergy recording', validated.errors);
    }

    const { organizationId, patientId, status, allergenName, category, severity, reaction, notes } = validated.data;

    const patient = await this.patientRepo.findById(patientId);
    if (!patient || patient.organizationId !== organizationId) {
      throw new PatientNotFoundError(patientId);
    }

    const created = await this.allergyRepo.create({
      organizationId,
      patientId,
      status,
      allergenName,
      category,
      severity,
      reaction,
      notes,
      recordedBy: actor.id
    });

    await this.auditService.logEvent({
      actor: { id: actor.id, username: actor.username, role: actor.roles[0], roles: actor.roles },
      action: AuditAction.ALLERGY_CREATED,
      resource: `allergy/${created.id}`,
      result: AuditResult.SUCCESS,
      metadata: {
        allergyId: created.id,
        patientId,
        status,
        category
      }
    });

    return created;
  }

  public async listAllergiesByPatient(patientId: string, organizationId: string, actor: SessionUser): Promise<Allergy[]> {
    this.assertPermission(actor, PermissionCode.ALLERGY_READ);
    const patient = await this.patientRepo.findById(patientId);
    if (!patient || patient.organizationId !== organizationId) {
      return [];
    }
    return this.allergyRepo.listByPatient(patientId, organizationId);
  }

  public async updateAllergy(input: UpdateAllergyInput, actor: SessionUser): Promise<Allergy> {
    this.assertPermission(actor, PermissionCode.ALLERGY_UPDATE);

    const validated = validateSchema(UpdateAllergySchema, input);
    if (!validated.success) {
      throw new ValidationError('Validation failed for allergy update', validated.errors);
    }

    const { allergyId, organizationId, status, allergenName, category, severity, reaction, notes } = validated.data;
    const updated = await this.allergyRepo.update(
      allergyId,
      organizationId,
      { status, allergenName, category, severity, reaction, notes },
      actor.id
    );

    await this.auditService.logEvent({
      actor: { id: actor.id, username: actor.username, role: actor.roles[0], roles: actor.roles },
      action: AuditAction.ALLERGY_UPDATED,
      resource: `allergy/${allergyId}`,
      result: AuditResult.SUCCESS,
      metadata: {
        allergyId,
        patientId: updated.patientId,
        status: updated.status
      }
    });

    return updated;
  }

  // ==========================================
  // MEDICAL HISTORY
  // ==========================================
  public async recordMedicalHistory(input: RecordMedicalHistoryInput, actor: SessionUser): Promise<MedicalHistory> {
    this.assertPermission(actor, PermissionCode.HISTORY_CREATE);

    const validated = validateSchema(RecordMedicalHistorySchema, input);
    if (!validated.success) {
      throw new ValidationError('Validation failed for medical history recording', validated.errors);
    }

    const { organizationId, patientId, category, description, diagnosedDate, isActive, notes } = validated.data;
    const patient = await this.patientRepo.findById(patientId);
    if (!patient || patient.organizationId !== organizationId) {
      throw new PatientNotFoundError(patientId);
    }

    const created = await this.historyRepo.create({
      organizationId,
      patientId,
      category,
      description,
      diagnosedDate,
      isActive,
      notes,
      recordedBy: actor.id
    });

    await this.auditService.logEvent({
      actor: { id: actor.id, username: actor.username, role: actor.roles[0], roles: actor.roles },
      action: AuditAction.MEDICAL_HISTORY_CREATED,
      resource: `history/${created.id}`,
      result: AuditResult.SUCCESS,
      metadata: {
        historyId: created.id,
        patientId,
        category
      }
    });

    return created;
  }

  public async listMedicalHistoryByPatient(patientId: string, organizationId: string, actor: SessionUser): Promise<MedicalHistory[]> {
    this.assertPermission(actor, PermissionCode.HISTORY_READ);
    const patient = await this.patientRepo.findById(patientId);
    if (!patient || patient.organizationId !== organizationId) {
      return [];
    }
    return this.historyRepo.listByPatient(patientId, organizationId);
  }

  public async updateMedicalHistory(input: UpdateMedicalHistoryInput, actor: SessionUser): Promise<MedicalHistory> {
    this.assertPermission(actor, PermissionCode.HISTORY_UPDATE);

    const validated = validateSchema(UpdateMedicalHistorySchema, input);
    if (!validated.success) {
      throw new ValidationError('Validation failed for medical history update', validated.errors);
    }

    const { historyId, organizationId, category, description, diagnosedDate, isActive, notes } = validated.data;
    const updated = await this.historyRepo.update(
      historyId,
      organizationId,
      { category, description, diagnosedDate, isActive, notes },
      actor.id
    );

    await this.auditService.logEvent({
      actor: { id: actor.id, username: actor.username, role: actor.roles[0], roles: actor.roles },
      action: AuditAction.MEDICAL_HISTORY_UPDATED,
      resource: `history/${historyId}`,
      result: AuditResult.SUCCESS,
      metadata: {
        historyId,
        patientId: updated.patientId
      }
    });

    return updated;
  }

  // ==========================================
  // DIAGNOSIS
  // ==========================================
  public async recordDiagnosis(input: RecordDiagnosisInput, actor: SessionUser): Promise<Diagnosis> {
    this.assertPermission(actor, PermissionCode.DIAGNOSIS_CREATE);

    const validated = validateSchema(RecordDiagnosisSchema, input);
    if (!validated.success) {
      throw new ValidationError('Validation failed for diagnosis recording', validated.errors);
    }

    const { organizationId, patientId, clinicalVisitId, doctorId, diagnosisText, type, status, codeSystem, codeValue, notes } = validated.data;
    const patient = await this.patientRepo.findById(patientId);
    if (!patient || patient.organizationId !== organizationId) {
      throw new PatientNotFoundError(patientId);
    }

    const created = await this.diagnosisRepo.create({
      organizationId,
      patientId,
      clinicalVisitId,
      doctorId,
      diagnosisText,
      type,
      status,
      codeSystem,
      codeValue,
      notes,
      recordedBy: actor.id
    });

    await this.auditService.logEvent({
      actor: { id: actor.id, username: actor.username, role: actor.roles[0], roles: actor.roles },
      action: AuditAction.DIAGNOSIS_CREATED,
      resource: `diagnosis/${created.id}`,
      result: AuditResult.SUCCESS,
      metadata: {
        diagnosisId: created.id,
        patientId,
        type
      }
    });

    return created;
  }

  public async listDiagnosesByPatient(patientId: string, organizationId: string, actor: SessionUser): Promise<Diagnosis[]> {
    this.assertPermission(actor, PermissionCode.DIAGNOSIS_READ);
    const patient = await this.patientRepo.findById(patientId);
    if (!patient || patient.organizationId !== organizationId) {
      return [];
    }
    return this.diagnosisRepo.listByPatient(patientId, organizationId);
  }

  public async listDiagnosesByVisit(visitId: string, organizationId: string, actor: SessionUser): Promise<Diagnosis[]> {
    this.assertPermission(actor, PermissionCode.DIAGNOSIS_READ);
    return this.diagnosisRepo.findByVisitId(visitId, organizationId);
  }

  public async updateDiagnosis(input: UpdateDiagnosisInput, actor: SessionUser): Promise<Diagnosis> {
    this.assertPermission(actor, PermissionCode.DIAGNOSIS_UPDATE);

    const validated = validateSchema(UpdateDiagnosisSchema, input);
    if (!validated.success) {
      throw new ValidationError('Validation failed for diagnosis update', validated.errors);
    }

    const { diagnosisId, organizationId, diagnosisText, type, status, notes } = validated.data;
    const updated = await this.diagnosisRepo.update(diagnosisId, organizationId, { diagnosisText, type, status, notes });

    await this.auditService.logEvent({
      actor: { id: actor.id, username: actor.username, role: actor.roles[0], roles: actor.roles },
      action: AuditAction.DIAGNOSIS_UPDATED,
      resource: `diagnosis/${diagnosisId}`,
      result: AuditResult.SUCCESS,
      metadata: {
        diagnosisId,
        patientId: updated.patientId,
        status: updated.status
      }
    });

    return updated;
  }

  // ==========================================
  // FOLLOW-UPS
  // ==========================================
  public async scheduleFollowUp(input: ScheduleFollowUpInput, actor: SessionUser): Promise<FollowUp> {
    this.assertPermission(actor, PermissionCode.FOLLOWUP_CREATE);

    const validated = validateSchema(ScheduleFollowUpSchema, input);
    if (!validated.success) {
      throw new ValidationError('Validation failed for scheduling follow-up', validated.errors);
    }

    const { organizationId, patientId, doctorId, clinicalVisitId, followUpDate, instructions, notes } = validated.data;
    const patient = await this.patientRepo.findById(patientId);
    if (!patient || patient.organizationId !== organizationId) {
      throw new PatientNotFoundError(patientId);
    }

    const created = await this.followUpRepo.create({
      organizationId,
      patientId,
      doctorId,
      clinicalVisitId,
      followUpDate,
      instructions,
      notes,
      createdBy: actor.id
    });

    await this.auditService.logEvent({
      actor: { id: actor.id, username: actor.username, role: actor.roles[0], roles: actor.roles },
      action: AuditAction.FOLLOWUP_CREATED,
      resource: `followup/${created.id}`,
      result: AuditResult.SUCCESS,
      metadata: {
        followUpId: created.id,
        patientId,
        doctorId,
        followUpDate
      }
    });

    return created;
  }

  public async listFollowUpsByPatient(patientId: string, organizationId: string, actor: SessionUser): Promise<FollowUp[]> {
    this.assertPermission(actor, PermissionCode.FOLLOWUP_READ);
    const patient = await this.patientRepo.findById(patientId);
    if (!patient || patient.organizationId !== organizationId) {
      return [];
    }
    return this.followUpRepo.listByPatient(patientId, organizationId);
  }

  public async listDueFollowUps(organizationId: string, fromDate: string, toDate: string, actor: SessionUser, doctorId?: string): Promise<FollowUp[]> {
    this.assertPermission(actor, PermissionCode.FOLLOWUP_READ);
    return this.followUpRepo.listDueFollowUps(organizationId, fromDate, toDate, doctorId);
  }

  public async updateFollowUpStatus(input: UpdateFollowUpStatusInput, actor: SessionUser): Promise<FollowUp> {
    this.assertPermission(actor, PermissionCode.FOLLOWUP_UPDATE);

    const validated = validateSchema(UpdateFollowUpStatusSchema, input);
    if (!validated.success) {
      throw new ValidationError('Validation failed for updating follow-up status', validated.errors);
    }

    const { followUpId, organizationId, status } = validated.data;
    const updated = await this.followUpRepo.updateStatus(followUpId, organizationId, status as FollowUpStatus, actor.id);

    await this.auditService.logEvent({
      actor: { id: actor.id, username: actor.username, role: actor.roles[0], roles: actor.roles },
      action: AuditAction.FOLLOWUP_UPDATED,
      resource: `followup/${followUpId}`,
      result: AuditResult.SUCCESS,
      metadata: {
        followUpId,
        patientId: updated.patientId,
        status: updated.status
      }
    });

    return updated;
  }
}
