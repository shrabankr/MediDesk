import {
  LicenseStatus,
  SafeUser,
  SessionUser,
  RoleName,
  AuditEvent,
  Patient,
  Doctor,
  DoctorSchedule,
  Appointment,
  AppointmentStatus,
  DuplicatePatientMatch,
  ClinicalVisit,
  ClinicalVisitStatus,
  Vitals,
  Allergy,
  AllergyStatus,
  AllergyCategory,
  AllergySeverity,
  MedicalHistory,
  MedicalHistoryCategory,
  Diagnosis,
  DiagnosisType,
  DiagnosisStatus,
  Prescription,
  PrescriptionStatus,
  PrescriptionVersion,
  PrescriptionItem,
  DosageForm,
  RouteOfAdministration,
  DurationUnit,
  FollowUp,
  FollowUpStatus,
  ClinicalCorrection
} from '@medidesk/domain';

export type {
  SafeUser,
  SessionUser,
  AuditEvent,
  Patient,
  Doctor,
  DoctorSchedule,
  Appointment,
  AppointmentStatus,
  DuplicatePatientMatch,
  ClinicalVisit,
  ClinicalVisitStatus,
  Vitals,
  Allergy,
  AllergyStatus,
  AllergyCategory,
  AllergySeverity,
  MedicalHistory,
  MedicalHistoryCategory,
  Diagnosis,
  DiagnosisType,
  DiagnosisStatus,
  Prescription,
  PrescriptionStatus,
  PrescriptionVersion,
  PrescriptionItem,
  DosageForm,
  RouteOfAdministration,
  DurationUnit,
  FollowUp,
  FollowUpStatus,
  ClinicalCorrection
};

export interface IPCResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type ApiResponse<T = unknown> = IPCResponse<T>;

export function createSuccessResult<T>(data: T): IPCResponse<T> {
  return { success: true, data };
}

export function createErrorResult<T = unknown>(code: string, message: string, details?: unknown): IPCResponse<T> {
  return { success: false, error: { code, message, details } };
}

export interface LoginResponseData {
  user: SessionUser;
  token?: string;
  expiresAt?: string;
  sessionToken?: string;
}

export interface UserPermissionsData {
  userId: string;
  roles: string[];
  permissions: string[];
}

export const IPC_CHANNELS = {
  // System & Status
  GET_SYSTEM_STATUS: 'app:get-system-status',
  GET_INITIALIZATION_STATE: 'app:get-initialization-state',
  INITIALIZE_SYSTEM: 'app:initialize-system',

  // Config & Diagnostics
  GET_ENVIRONMENT_INFO: 'config:get-environment-info',

  // Authentication & Session
  AUTH_LOGIN: 'auth:login',
  AUTH_LOGOUT: 'auth:logout',
  AUTH_GET_CURRENT_USER: 'auth:get-current-user',
  AUTH_RECOVER_OWNER: 'auth:recover-owner',

  // User Management
  USER_LIST: 'user:list',
  USER_CREATE: 'user:create',
  USER_CREATE_OWNER_RECOVERY: 'user:create-owner-recovery',
  USER_UPDATE: 'user:update',
  USER_RESET_PASSWORD: 'user:reset-password',
  USER_TOGGLE_STATUS: 'user:toggle-status',

  // RBAC & Permissions
  RBAC_GET_USER_PERMISSIONS: 'rbac:get-user-permissions',

  // Audit
  LOG_AUDIT_EVENT: 'audit:log-event',
  GET_RECENT_AUDIT_EVENTS: 'audit:get-recent-events',

  // Phase 3: Patients
  PATIENT_SEARCH: 'patient:search',
  PATIENT_CHECK_DUPLICATES: 'patient:check-duplicates',
  PATIENT_CREATE: 'patient:create',
  PATIENT_GET_BY_ID: 'patient:get-by-id',
  PATIENT_UPDATE: 'patient:update',

  // Phase 3: Doctors
  DOCTOR_LIST: 'doctor:list',
  DOCTOR_CREATE: 'doctor:create',
  DOCTOR_GET_BY_ID: 'doctor:get-by-id',
  DOCTOR_UPDATE: 'doctor:update',
  DOCTOR_SET_SCHEDULES: 'doctor:set-schedules',
  DOCTOR_GET_SCHEDULES: 'doctor:get-schedules',
  DOCTOR_DEACTIVATE: 'doctor:deactivate',

  // Phase 3: Appointments
  APPOINTMENT_CREATE: 'appointment:create',
  APPOINTMENT_GET_BY_ID: 'appointment:get-by-id',
  APPOINTMENT_UPDATE: 'appointment:update',
  APPOINTMENT_CHANGE_STATUS: 'appointment:change-status',
  APPOINTMENT_LIST: 'appointment:list',
  APPOINTMENT_GET_WAITING_QUEUE: 'appointment:get-waiting-queue',
  APPOINTMENT_GET_QUEUE: 'appointment:get-waiting-queue',
  APPOINTMENT_GET_TODAY_METRICS: 'appointment:get-today-metrics',
  APPOINTMENT_GET_METRICS: 'appointment:get-today-metrics',

  // Phase 4: Clinical Visits
  CLINICAL_VISIT_CREATE: 'clinical:create-visit',
  CLINICAL_VISIT_GET_BY_ID: 'clinical:get-visit-by-id',
  CLINICAL_VISIT_LIST_BY_PATIENT: 'clinical:list-visits-by-patient',
  CLINICAL_VISIT_UPDATE: 'clinical:update-visit',
  CLINICAL_VISIT_COMPLETE: 'clinical:complete-visit',
  CLINICAL_VISIT_CANCEL: 'clinical:cancel-visit',
  CLINICAL_VISIT_CORRECT: 'clinical:correct-visit',

  // Phase 4: Vitals
  VITALS_RECORD: 'vitals:record',
  VITALS_GET_BY_PATIENT: 'vitals:get-by-patient',
  VITALS_GET_BY_VISIT: 'vitals:get-by-visit',
  VITALS_GET_LATEST: 'vitals:get-latest',

  // Phase 4: Allergies
  ALLERGY_RECORD: 'allergy:record',
  ALLERGY_LIST_BY_PATIENT: 'allergy:list-by-patient',
  ALLERGY_UPDATE: 'allergy:update',

  // Phase 4: Medical History
  HISTORY_RECORD: 'history:record',
  HISTORY_LIST_BY_PATIENT: 'history:list-by-patient',
  HISTORY_UPDATE: 'history:update',

  // Phase 4: Diagnosis
  DIAGNOSIS_RECORD: 'diagnosis:record',
  DIAGNOSIS_LIST_BY_PATIENT: 'diagnosis:list-by-patient',
  DIAGNOSIS_LIST_BY_VISIT: 'diagnosis:list-by-visit',
  DIAGNOSIS_UPDATE: 'diagnosis:update',

  // Phase 4: Prescriptions
  PRESCRIPTION_CREATE: 'prescription:create',
  PRESCRIPTION_GET_BY_ID: 'prescription:get-by-id',
  PRESCRIPTION_GET_BY_VISIT: 'prescription:get-by-visit',
  PRESCRIPTION_LIST_BY_PATIENT: 'prescription:list-by-patient',
  PRESCRIPTION_SIGN: 'prescription:sign',
  PRESCRIPTION_REVISE: 'prescription:revise',
  PRESCRIPTION_CANCEL: 'prescription:cancel',
  PRESCRIPTION_GET_VERSIONS: 'prescription:get-versions',

  // Phase 4: Follow-ups
  FOLLOWUP_SCHEDULE: 'followup:schedule',
  FOLLOWUP_LIST_BY_PATIENT: 'followup:list-by-patient',
  FOLLOWUP_LIST_DUE: 'followup:list-due',
  FOLLOWUP_UPDATE_STATUS: 'followup:update-status',

  // Phase 5: Medicines & Products
  MEDICINE_CREATE: 'medicine:create',
  MEDICINE_UPDATE: 'medicine:update',
  MEDICINE_SEARCH: 'medicine:search',
  MEDICINE_GET_BY_ID: 'medicine:get-by-id',
  PRODUCT_CREATE: 'product:create',
  PRODUCT_UPDATE: 'product:update',
  PRODUCT_SEARCH: 'product:search',
  PRODUCT_GET_BY_BARCODE: 'product:get-by-barcode',
  PRODUCT_GET_BY_ID: 'product:get-by-id',
  MANUFACTURER_CREATE: 'manufacturer:create',
  MANUFACTURER_LIST: 'manufacturer:list',

  // Phase 5: Suppliers & Purchases
  SUPPLIER_CREATE: 'supplier:create',
  SUPPLIER_UPDATE: 'supplier:update',
  SUPPLIER_SEARCH: 'supplier:search',
  SUPPLIER_LIST: 'supplier:list',
  PURCHASE_CREATE: 'purchase:create',
  PURCHASE_GET_BY_ID: 'purchase:get-by-id',
  PURCHASE_LIST: 'purchase:list',
  PURCHASE_CANCEL: 'purchase:cancel',

  // Phase 5: Inventory & Batches
  INVENTORY_GET_BATCHES: 'inventory:get-batches',
  INVENTORY_FEFO_ALLOCATE: 'inventory:fefo-allocate',
  INVENTORY_ADJUST_STOCK: 'inventory:adjust-stock',
  INVENTORY_GET_EXPIRING_SOON: 'inventory:get-expiring-soon',
  INVENTORY_GET_EXPIRED: 'inventory:get-expired',
  INVENTORY_GET_LOW_STOCK: 'inventory:get-low-stock',
  INVENTORY_GET_MOVEMENTS: 'inventory:get-movements',

  // Phase 5: Sales, POS & Returns
  SALE_CREATE: 'sale:create',
  SALE_GET_BY_ID: 'sale:get-by-id',
  SALE_GET_BY_BILL: 'sale:get-by-bill',
  SALE_LIST: 'sale:list',
  SALE_LIST_BY_PATIENT: 'sale:list-by-patient',
  SALE_CANCEL: 'sale:cancel',
  SALE_RETURN: 'sale:return',
  SALE_MATCH_PRESCRIPTION: 'sale:match-prescription',
  REPORT_DAILY_SALES: 'report:daily-sales',

  // Phase 6: System Utilities, Backup & Restore
  BACKUP_CREATE: 'system:backup-create',
  BACKUP_LIST: 'system:backup-list',
  BACKUP_VERIFY: 'system:backup-verify',
  BACKUP_RESTORE: 'system:backup-restore',
  BACKUP_UPLOAD_GDRIVE: 'system:backup-upload-gdrive',
  BACKUP_GET_SETTINGS: 'system:backup-get-settings',
  BACKUP_UPDATE_SETTINGS: 'system:backup-update-settings',
  BACKUP_RETRY_CLOUD: 'system:backup-retry-cloud',
  BACKUP_LIST_CLOUD: 'system:backup-list-cloud',
  BACKUP_CONNECT_GDRIVE: 'system:backup-connect-gdrive',
  BACKUP_DISCONNECT_GDRIVE: 'system:backup-disconnect-gdrive',

  // Phase 6: Licensing
  LICENSE_GET_STATUS: 'system:license-get-status',
  LICENSE_ACTIVATE: 'system:license-activate',
  LICENSE_CHECK_TRIAL: 'system:license-check-trial',

  // Phase 6: Printing & Hardware
  PRINT_PRESCRIPTION: 'print:prescription',
  PRINT_INVOICE: 'print:invoice',
  PRINT_RECEIPT: 'print:receipt',
  PRINT_TEST: 'print:test',
  PRINT_GET_CONFIG: 'print:get-config',
  PRINT_SAVE_CONFIG: 'print:save-config',

  // Phase 6: Diagnostics & Support
  DIAGNOSTICS_RUN: 'system:diagnostics-run',
  DIAGNOSTICS_EXPORT_BUNDLE: 'system:diagnostics-export-bundle',

  // Phase 7: LAN & Multi-Computer Mode
  LAN_GET_CONFIG: 'lan:get-config',
  LAN_SAVE_CONFIG: 'lan:save-config',
  LAN_START_SERVER: 'lan:start-server',
  LAN_STOP_SERVER: 'lan:stop-server',
  LAN_GENERATE_PIN: 'lan:generate-pin',
  LAN_REGISTER_DEVICE: 'lan:register-device',
  LAN_APPROVE_DEVICE: 'lan:approve-device',
  LAN_REVOKE_DEVICE: 'lan:revoke-device',
  LAN_LIST_DEVICES: 'lan:list-devices',
  LAN_GET_STATUS: 'lan:get-status',

  // Phase 8: Multi-tier Packaging, Smart Alerts, Dashboards, Document Dispatch & Backup Scheduling
  PACKAGING_CREATE: 'packaging:create',
  PACKAGING_GET_BY_PRODUCT: 'packaging:get-by-product',
  PACKAGING_UPDATE: 'packaging:update',
  PACKAGING_DELETE: 'packaging:delete',
  PACKAGING_CONVERT: 'packaging:convert',
  ALERTS_GET_ACTIVE: 'alerts:get-active',
  ALERTS_ACKNOWLEDGE: 'alerts:acknowledge',
  ALERTS_RESOLVE: 'alerts:resolve',
  ALERTS_CONFIGURE_POLICY: 'alerts:configure-policy',
  ALERTS_GET_CONFIGS: 'alerts:get-configs',
  DASHBOARD_GET_LAYOUT: 'dashboard:get-layout',
  DASHBOARD_SAVE_LAYOUT: 'dashboard:save-layout',
  DOCUMENT_DISPATCH: 'document:dispatch',
  BACKUP_GET_SCHEDULE: 'system:backup-get-schedule',
  BACKUP_UPDATE_SCHEDULE: 'system:backup-update-schedule'
} as const;

export interface SystemStatusData {
  appName: string;
  version: string;
  database: {
    status: string;
    databasePath: string;
    appliedMigrations: number;
  };
  application: {
    status: string;
    initialized: boolean;
    uptimeSeconds: number;
  };
  network: {
    mode: string;
    internetRequired: boolean;
    isOnline: boolean;
  };
  licensing: {
    status: string;
    trialDaysRemaining: number;
  };
  security: {
    contextIsolation: boolean;
    nodeIntegration: boolean;
    sandbox: boolean;
  };
  environment: string;
}

export interface InitializationStateData {
  isInitialized: boolean;
  organizationCount: number;
  userCount: number;
}

export interface InitializeSystemRequest {
  organizationName?: string;
  organizationCode?: string;
  currency?: string;
  timezone?: string;
  adminUsername?: string;
  adminEmail?: string;
  adminFullName?: string;
  adminPassword?: string;
  maintenanceToken?: string;
  organization?: {
    name: string;
    code: string;
    currency?: string;
    timezone?: string;
  };
  initialOwner?: {
    username: string;
    email: string;
    fullName: string;
    password: string;
  };
  developerToken?: string;
}

export interface EnvironmentInfoData {
  nodeVersion: string;
  electronVersion: string;
  chromeVersion: string;
  platform: string;
  arch: string;
  licenseStatus: LicenseStatus;
  trialDaysRemaining: number;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface OwnerRecoveryRequest {
  username: string;
  recoveryToken: string;
  newPassword: string;
}

export interface CreateUserRequest {
  organizationId?: string;
  username: string;
  email: string;
  fullName: string;
  password: string;
  roles: RoleName[];
}

export interface CreateOwnerRecoveryUserRequest {
  recoveryToken: string;
  username: string;
  email: string;
  fullName: string;
  password: string;
}

export interface UpdateUserRequest {
  userId: string;
  email?: string;
  fullName?: string;
  roles?: RoleName[];
}

export interface ResetPasswordRequest {
  userId: string;
  newPassword: string;
}

export interface ToggleUserStatusRequest {
  userId: string;
  isActive: boolean;
}

export interface AuditEventPayload {
  action: string;
  resource: string;
  result: 'SUCCESS' | 'FAILURE' | 'DENIED';
  metadata?: Record<string, unknown>;
}

// Phase 3 Requests
export interface SearchPatientRequest {
  organizationId: string;
  query?: string;
  limit?: number;
  offset?: number;
}

export interface CheckDuplicatesRequest {
  organizationId: string;
  fullName: string;
  mobile?: string;
  dateOfBirth?: string;
  sex?: string;
  excludePatientId?: string;
}

export interface CreatePatientRequest {
  organizationId: string;
  fullName: string;
  dateOfBirth?: string;
  age?: number;
  sex: 'MALE' | 'FEMALE' | 'OTHER';
  mobile?: string;
  alternateMobile?: string;
  address?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  forceCreateOnDuplicate?: boolean;
}

export interface UpdatePatientRequest {
  patientId: string;
  fullName?: string;
  dateOfBirth?: string;
  age?: number;
  sex?: 'MALE' | 'FEMALE' | 'OTHER';
  mobile?: string;
  alternateMobile?: string;
  address?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  status?: 'ACTIVE' | 'INACTIVE';
}

export interface CreateDoctorRequest {
  organizationId: string;
  displayName: string;
  qualification: string;
  specialization: string;
  registrationNumber?: string;
  mobile?: string;
  consultationFee?: number;
  userId?: string;
}

export interface UpdateDoctorRequest {
  doctorId: string;
  displayName?: string;
  qualification?: string;
  specialization?: string;
  registrationNumber?: string;
  mobile?: string;
  consultationFee?: number;
  status?: 'ACTIVE' | 'INACTIVE';
  userId?: string;
}

export interface SetDoctorSchedulesRequest {
  doctorId: string;
  schedules: Array<{
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    slotDurationMinutes?: number;
    isActive?: boolean;
  }>;
}

export interface CreateAppointmentRequest {
  organizationId: string;
  patientId: string;
  doctorId: string;
  appointmentDate: string;
  startTime: string;
  durationMinutes?: number;
  visitPurpose?: string;
  notes?: string;
}

export interface UpdateAppointmentRequest {
  appointmentId: string;
  doctorId?: string;
  appointmentDate?: string;
  startTime?: string;
  durationMinutes?: number;
  visitPurpose?: string;
  notes?: string;
}

export interface ChangeAppointmentStatusRequest {
  appointmentId: string;
  status: AppointmentStatus;
}

export interface ListAppointmentsRequest {
  organizationId: string;
  startDate?: string;
  endDate?: string;
  doctorId?: string;
  patientId?: string;
  status?: AppointmentStatus;
  limit?: number;
  offset?: number;
}

export interface GetWaitingQueueRequest {
  organizationId: string;
  appointmentDate: string;
  doctorId?: string;
}

export interface TodayMetricsData {
  total: number;
  scheduled: number;
  checkedIn: number;
  waiting: number;
  inConsultation: number;
  completed: number;
  cancelled: number;
  noShow: number;
}

// Phase 4 Requests
export interface CreateClinicalVisitRequest {
  organizationId: string;
  patientId: string;
  doctorId: string;
  appointmentId?: string;
  visitDateTime?: string;
  chiefComplaint?: string;
  historyOfPresentIllness?: string;
  examinationNotes?: string;
  clinicalAssessment?: string;
}

export interface UpdateClinicalVisitRequest {
  visitId: string;
  chiefComplaint?: string;
  historyOfPresentIllness?: string;
  examinationNotes?: string;
  clinicalAssessment?: string;
  status?: ClinicalVisitStatus;
}

export interface CorrectClinicalVisitRequest {
  visitId: string;
  reason: string;
  correctedPayload: Record<string, unknown>;
}

export interface RecordVitalsRequest {
  organizationId: string;
  patientId: string;
  clinicalVisitId?: string;
  temperature?: number;
  temperatureUnit?: 'CELSIUS' | 'FAHRENHEIT';
  pulseRate?: number;
  respiratoryRate?: number;
  systolicBp?: number;
  diastolicBp?: number;
  oxygenSaturationSpo2?: number;
  weightKg?: number;
  heightCm?: number;
  bmi?: number;
  notes?: string;
}

export interface RecordAllergyRequest {
  organizationId: string;
  patientId: string;
  status: AllergyStatus;
  allergenName?: string;
  category?: AllergyCategory;
  severity?: AllergySeverity;
  reaction?: string;
  notes?: string;
}

export interface UpdateAllergyRequest {
  allergyId: string;
  status?: AllergyStatus;
  allergenName?: string;
  category?: AllergyCategory;
  severity?: AllergySeverity;
  reaction?: string;
  notes?: string;
}

export interface RecordMedicalHistoryRequest {
  organizationId: string;
  patientId: string;
  category: MedicalHistoryCategory;
  description: string;
  diagnosedDate?: string;
  isActive?: boolean;
  notes?: string;
}

export interface UpdateMedicalHistoryRequest {
  historyId: string;
  category?: MedicalHistoryCategory;
  description?: string;
  diagnosedDate?: string;
  isActive?: boolean;
  notes?: string;
}

export interface RecordDiagnosisRequest {
  organizationId: string;
  patientId: string;
  clinicalVisitId?: string;
  doctorId: string;
  diagnosisText: string;
  type?: DiagnosisType;
  status?: DiagnosisStatus;
  codeSystem?: string;
  codeValue?: string;
  notes?: string;
}

export interface UpdateDiagnosisRequest {
  diagnosisId: string;
  diagnosisText?: string;
  type?: DiagnosisType;
  status?: DiagnosisStatus;
  notes?: string;
}

export interface CreatePrescriptionRequest {
  organizationId: string;
  patientId: string;
  doctorId: string;
  clinicalVisitId?: string;
  items: Array<{
    medicineName: string;
    genericName?: string;
    strength?: string;
    dosageForm: DosageForm;
    route: RouteOfAdministration;
    frequency: string;
    durationValue?: number;
    durationUnit: DurationUnit;
    instructions?: string;
    quantity?: number;
    isSubstitutionAllowed?: boolean;
  }>;
  notes?: string;
  ignoreAllergyWarning?: boolean;
}

export interface RevisePrescriptionRequest {
  prescriptionId: string;
  reasonForChange: string;
  items: Array<{
    medicineName: string;
    genericName?: string;
    strength?: string;
    dosageForm: DosageForm;
    route: RouteOfAdministration;
    frequency: string;
    durationValue?: number;
    durationUnit: DurationUnit;
    instructions?: string;
    quantity?: number;
    isSubstitutionAllowed?: boolean;
  }>;
  notes?: string;
  ignoreAllergyWarning?: boolean;
}

export interface ScheduleFollowUpRequest {
  organizationId: string;
  patientId: string;
  doctorId: string;
  clinicalVisitId?: string;
  followUpDate: string;
  instructions?: string;
  notes?: string;
}

export interface UpdateFollowUpStatusRequest {
  followUpId: string;
  status: FollowUpStatus;
}
