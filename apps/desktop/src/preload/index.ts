import { contextBridge, ipcRenderer } from 'electron';
import {
  IPC_CHANNELS,
  SystemStatusData,
  InitializationStateData,
  InitializeSystemRequest,
  EnvironmentInfoData,
  SessionUser,
  SafeUser,
  AuditEvent,
  Patient,
  Doctor,
  DoctorSchedule,
  Appointment,
  DuplicatePatientMatch,
  TodayMetricsData,
  ClinicalVisit,
  Vitals,
  Allergy,
  MedicalHistory,
  Diagnosis,
  Prescription,
  PrescriptionVersion,
  FollowUp,
  SearchPatientRequest,
  CheckDuplicatesRequest,
  CreatePatientRequest,
  UpdatePatientRequest,
  CreateDoctorRequest,
  UpdateDoctorRequest,
  SetDoctorSchedulesRequest,
  CreateAppointmentRequest,
  UpdateAppointmentRequest,
  ChangeAppointmentStatusRequest,
  ListAppointmentsRequest,
  GetWaitingQueueRequest,
  CreateClinicalVisitRequest,
  UpdateClinicalVisitRequest,
  CorrectClinicalVisitRequest,
  RecordVitalsRequest,
  RecordAllergyRequest,
  UpdateAllergyRequest,
  RecordMedicalHistoryRequest,
  UpdateMedicalHistoryRequest,
  RecordDiagnosisRequest,
  CreatePrescriptionRequest,
  RevisePrescriptionRequest,
  ScheduleFollowUpRequest,
  UpdateFollowUpStatusRequest,
  CreateUserRequest,
  UpdateUserRequest,
  ResetPasswordRequest,
  ToggleUserStatusRequest,
  IPCResponse,
  LoginResponseData,
  UserPermissionsData
} from '@medidesk/shared';

export const mediDeskBridge = {
  // System & Status
  getSystemStatus: async (): Promise<IPCResponse<SystemStatusData>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.GET_SYSTEM_STATUS);
  },

  getInitializationState: async (): Promise<IPCResponse<InitializationStateData>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.GET_INITIALIZATION_STATE);
  },

  initializeSystem: async (payload: InitializeSystemRequest): Promise<IPCResponse<{ initialized: boolean; organizationId: string }>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.INITIALIZE_SYSTEM, payload);
  },

  // Diagnostics & Environment
  getEnvironmentInfo: async (): Promise<IPCResponse<EnvironmentInfoData>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.GET_ENVIRONMENT_INFO);
  },

  // Authentication & Sessions
  login: async (payload: { username: string; password: string }): Promise<IPCResponse<LoginResponseData>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.AUTH_LOGIN, payload);
  },

  logout: async (sessionToken: string): Promise<IPCResponse<{ loggedOut: boolean }>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.AUTH_LOGOUT, sessionToken);
  },

  getCurrentUser: async (sessionToken: string): Promise<IPCResponse<SessionUser | null>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.AUTH_GET_CURRENT_USER, sessionToken);
  },

  recoverOwnerAccount: async (payload: { username: string; recoveryToken: string; newPassword?: string }): Promise<IPCResponse<{ success: boolean; message: string }>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.AUTH_RECOVER_OWNER, payload);
  },

  // User Management
  listUsers: async (organizationId: string, sessionToken: string): Promise<IPCResponse<SafeUser[]>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.USER_LIST, { organizationId, sessionToken });
  },

  createUser: async (input: CreateUserRequest, sessionToken: string): Promise<IPCResponse<SafeUser>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.USER_CREATE, { input, sessionToken });
  },

  updateUser: async (input: UpdateUserRequest, sessionToken: string): Promise<IPCResponse<SafeUser>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.USER_UPDATE, { input, sessionToken });
  },

  resetPassword: async (input: ResetPasswordRequest, sessionToken: string): Promise<IPCResponse<{ reset: boolean }>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.USER_RESET_PASSWORD, { input, sessionToken });
  },

  toggleUserStatus: async (input: ToggleUserStatusRequest, sessionToken: string): Promise<IPCResponse<SafeUser>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.USER_TOGGLE_STATUS, { input, sessionToken });
  },

  // RBAC & Permissions
  getUserPermissions: async (userId: string, sessionToken: string): Promise<IPCResponse<UserPermissionsData>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.RBAC_GET_USER_PERMISSIONS, { userId, sessionToken });
  },

  // Audit
  logAuditEvent: async (payload: unknown): Promise<IPCResponse<unknown>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.LOG_AUDIT_EVENT, payload);
  },

  getRecentAuditEvents: async (limit?: number): Promise<IPCResponse<AuditEvent[]>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.GET_RECENT_AUDIT_EVENTS, { limit });
  },

  // Phase 3: Patient Management
  searchPatients: async (input: SearchPatientRequest, sessionToken: string): Promise<IPCResponse<Patient[]>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.PATIENT_SEARCH, { input, sessionToken });
  },

  checkDuplicates: async (input: CheckDuplicatesRequest, sessionToken: string): Promise<IPCResponse<DuplicatePatientMatch[]>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.PATIENT_CHECK_DUPLICATES, { input, sessionToken });
  },

  createPatient: async (input: CreatePatientRequest, sessionToken: string): Promise<IPCResponse<Patient>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.PATIENT_CREATE, { input, sessionToken });
  },

  getPatientById: async (patientId: string, organizationId: string, sessionToken: string): Promise<IPCResponse<Patient>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.PATIENT_GET_BY_ID, { patientId, organizationId, sessionToken });
  },

  updatePatient: async (input: UpdatePatientRequest, organizationId: string, sessionToken: string): Promise<IPCResponse<Patient>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.PATIENT_UPDATE, { input, organizationId, sessionToken });
  },

  // Phase 3: Doctor Management
  listDoctors: async (organizationId: string, sessionToken: string, activeOnly?: boolean): Promise<IPCResponse<Doctor[]>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.DOCTOR_LIST, { organizationId, sessionToken, activeOnly });
  },

  createDoctor: async (input: CreateDoctorRequest, sessionToken: string): Promise<IPCResponse<Doctor>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.DOCTOR_CREATE, { input, sessionToken });
  },

  getDoctorById: async (doctorId: string, organizationId: string, sessionToken: string): Promise<IPCResponse<Doctor>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.DOCTOR_GET_BY_ID, { doctorId, organizationId, sessionToken });
  },

  updateDoctor: async (input: UpdateDoctorRequest, organizationId: string, sessionToken: string): Promise<IPCResponse<Doctor>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.DOCTOR_UPDATE, { input, organizationId, sessionToken });
  },

  deactivateDoctor: async (doctorId: string, organizationId: string, sessionToken: string): Promise<IPCResponse<Doctor>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.DOCTOR_DEACTIVATE, { doctorId, organizationId, sessionToken });
  },

  setDoctorSchedules: async (input: SetDoctorSchedulesRequest, organizationId: string, sessionToken: string): Promise<IPCResponse<DoctorSchedule[]>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.DOCTOR_SET_SCHEDULES, { input, organizationId, sessionToken });
  },

  // Phase 3: Appointment & Waiting Queue Management
  listAppointments: async (input: ListAppointmentsRequest, sessionToken: string): Promise<IPCResponse<Appointment[]>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.APPOINTMENT_LIST, { input, sessionToken });
  },

  createAppointment: async (input: CreateAppointmentRequest, sessionToken: string): Promise<IPCResponse<Appointment>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.APPOINTMENT_CREATE, { input, sessionToken });
  },

  getAppointmentById: async (appointmentId: string, organizationId: string, sessionToken: string): Promise<IPCResponse<Appointment>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.APPOINTMENT_GET_BY_ID, { appointmentId, organizationId, sessionToken });
  },

  updateAppointment: async (input: UpdateAppointmentRequest, organizationId: string, sessionToken: string): Promise<IPCResponse<Appointment>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.APPOINTMENT_UPDATE, { input, organizationId, sessionToken });
  },

  changeAppointmentStatus: async (input: ChangeAppointmentStatusRequest, organizationId: string, sessionToken: string): Promise<IPCResponse<Appointment>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.APPOINTMENT_CHANGE_STATUS, { input, organizationId, sessionToken });
  },

  getWaitingQueue: async (input: GetWaitingQueueRequest, sessionToken: string): Promise<IPCResponse<Appointment[]>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.APPOINTMENT_GET_WAITING_QUEUE, { input, sessionToken });
  },

  getTodayMetrics: async (organizationId: string, appointmentDate: string, sessionToken: string, doctorId?: string): Promise<IPCResponse<TodayMetricsData>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.APPOINTMENT_GET_TODAY_METRICS, { organizationId, appointmentDate, sessionToken, doctorId });
  },

  // Phase 4: Clinical Visits
  createClinicalVisit: async (input: CreateClinicalVisitRequest, sessionToken: string): Promise<IPCResponse<ClinicalVisit>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.CLINICAL_VISIT_CREATE, input, sessionToken);
  },

  getClinicalVisitById: async (visitId: string, organizationId: string, sessionToken: string): Promise<IPCResponse<ClinicalVisit>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.CLINICAL_VISIT_GET_BY_ID, visitId, organizationId, sessionToken);
  },

  listClinicalVisitsByPatient: async (patientId: string, organizationId: string, sessionToken: string, limit?: number): Promise<IPCResponse<ClinicalVisit[]>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.CLINICAL_VISIT_LIST_BY_PATIENT, patientId, organizationId, sessionToken, limit);
  },

  updateClinicalVisit: async (input: UpdateClinicalVisitRequest, organizationId: string, sessionToken: string): Promise<IPCResponse<ClinicalVisit>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.CLINICAL_VISIT_UPDATE, input, organizationId, sessionToken);
  },

  completeClinicalVisit: async (visitId: string, organizationId: string, sessionToken: string): Promise<IPCResponse<ClinicalVisit>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.CLINICAL_VISIT_COMPLETE, visitId, organizationId, sessionToken);
  },

  cancelClinicalVisit: async (visitId: string, organizationId: string, sessionToken: string): Promise<IPCResponse<ClinicalVisit>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.CLINICAL_VISIT_CANCEL, visitId, organizationId, sessionToken);
  },

  correctClinicalVisit: async (input: CorrectClinicalVisitRequest, organizationId: string, sessionToken: string): Promise<IPCResponse<ClinicalVisit>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.CLINICAL_VISIT_CORRECT, input, organizationId, sessionToken);
  },

  // Phase 4: Vitals
  recordVitals: async (input: RecordVitalsRequest, sessionToken: string): Promise<IPCResponse<Vitals>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.VITALS_RECORD, input, sessionToken);
  },

  getVitalsByPatient: async (patientId: string, organizationId: string, sessionToken: string, limit?: number): Promise<IPCResponse<Vitals[]>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.VITALS_GET_BY_PATIENT, patientId, organizationId, sessionToken, limit);
  },

  getVitalsByVisit: async (visitId: string, organizationId: string, sessionToken: string): Promise<IPCResponse<Vitals[]>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.VITALS_GET_BY_VISIT, visitId, organizationId, sessionToken);
  },

  // Phase 4: Allergies
  recordAllergy: async (input: RecordAllergyRequest, sessionToken: string): Promise<IPCResponse<Allergy>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.ALLERGY_RECORD, input, sessionToken);
  },

  listAllergiesByPatient: async (patientId: string, organizationId: string, sessionToken: string): Promise<IPCResponse<Allergy[]>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.ALLERGY_LIST_BY_PATIENT, patientId, organizationId, sessionToken);
  },

  updateAllergy: async (input: UpdateAllergyRequest, organizationId: string, sessionToken: string): Promise<IPCResponse<Allergy>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.ALLERGY_UPDATE, input, organizationId, sessionToken);
  },

  // Phase 4: Medical History
  recordMedicalHistory: async (input: RecordMedicalHistoryRequest, sessionToken: string): Promise<IPCResponse<MedicalHistory>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.HISTORY_RECORD, input, sessionToken);
  },

  listMedicalHistoryByPatient: async (patientId: string, organizationId: string, sessionToken: string): Promise<IPCResponse<MedicalHistory[]>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.HISTORY_LIST_BY_PATIENT, patientId, organizationId, sessionToken);
  },

  updateMedicalHistory: async (input: UpdateMedicalHistoryRequest, organizationId: string, sessionToken: string): Promise<IPCResponse<MedicalHistory>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.HISTORY_UPDATE, input, organizationId, sessionToken);
  },

  // Phase 4: Diagnosis
  recordDiagnosis: async (input: RecordDiagnosisRequest, sessionToken: string): Promise<IPCResponse<Diagnosis>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.DIAGNOSIS_RECORD, input, sessionToken);
  },

  listDiagnosesByPatient: async (patientId: string, organizationId: string, sessionToken: string): Promise<IPCResponse<Diagnosis[]>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.DIAGNOSIS_LIST_BY_PATIENT, patientId, organizationId, sessionToken);
  },

  // Phase 4: Prescriptions
  createPrescription: async (input: CreatePrescriptionRequest, sessionToken: string): Promise<IPCResponse<Prescription>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.PRESCRIPTION_CREATE, input, sessionToken);
  },

  getPrescriptionById: async (prescriptionId: string, organizationId: string, sessionToken: string): Promise<IPCResponse<Prescription>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.PRESCRIPTION_GET_BY_ID, prescriptionId, organizationId, sessionToken);
  },

  getPrescriptionByVisitId: async (visitId: string, organizationId: string, sessionToken: string): Promise<IPCResponse<Prescription | null>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.PRESCRIPTION_GET_BY_VISIT, visitId, organizationId, sessionToken);
  },

  listPrescriptionsByPatient: async (patientId: string, organizationId: string, sessionToken: string, limit?: number): Promise<IPCResponse<Prescription[]>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.PRESCRIPTION_LIST_BY_PATIENT, patientId, organizationId, sessionToken, limit);
  },

  signPrescription: async (prescriptionId: string, organizationId: string, sessionToken: string): Promise<IPCResponse<Prescription>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.PRESCRIPTION_SIGN, prescriptionId, organizationId, sessionToken);
  },

  revisePrescription: async (input: RevisePrescriptionRequest, organizationId: string, sessionToken: string): Promise<IPCResponse<Prescription>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.PRESCRIPTION_REVISE, input, organizationId, sessionToken);
  },

  cancelPrescription: async (prescriptionId: string, organizationId: string, sessionToken: string, reason?: string): Promise<IPCResponse<Prescription>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.PRESCRIPTION_CANCEL, prescriptionId, organizationId, sessionToken, reason);
  },

  getPrescriptionVersions: async (prescriptionId: string, organizationId: string, sessionToken: string): Promise<IPCResponse<PrescriptionVersion[]>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.PRESCRIPTION_GET_VERSIONS, prescriptionId, organizationId, sessionToken);
  },

  // Phase 4: Follow-Ups
  scheduleFollowUp: async (input: ScheduleFollowUpRequest, sessionToken: string): Promise<IPCResponse<FollowUp>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.FOLLOWUP_SCHEDULE, input, sessionToken);
  },

  listFollowUpsByPatient: async (patientId: string, organizationId: string, sessionToken: string): Promise<IPCResponse<FollowUp[]>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.FOLLOWUP_LIST_BY_PATIENT, patientId, organizationId, sessionToken);
  },

  updateFollowUpStatus: async (input: UpdateFollowUpStatusRequest, organizationId: string, sessionToken: string): Promise<IPCResponse<FollowUp>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.FOLLOWUP_UPDATE_STATUS, input, organizationId, sessionToken);
  },

  // Phase 5: Medicine Master
  createMedicine: async (input: unknown, sessionToken: string): Promise<IPCResponse<any>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.MEDICINE_CREATE, input, sessionToken);
  },

  updateMedicine: async (id: string, input: unknown, sessionToken: string): Promise<IPCResponse<any>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.MEDICINE_UPDATE, id, input, sessionToken);
  },

  searchMedicines: async (query: string, sessionToken: string, limit?: number): Promise<IPCResponse<any>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.MEDICINE_SEARCH, query, sessionToken, limit);
  },

  getMedicineById: async (id: string, sessionToken: string): Promise<IPCResponse<any>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.MEDICINE_GET_BY_ID, id, sessionToken);
  },

  createManufacturer: async (input: unknown, sessionToken: string): Promise<IPCResponse<any>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.MANUFACTURER_CREATE, input, sessionToken);
  },

  listManufacturers: async (sessionToken: string): Promise<IPCResponse<any>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.MANUFACTURER_LIST, sessionToken);
  },

  createProduct: async (input: unknown, sessionToken: string): Promise<IPCResponse<any>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.PRODUCT_CREATE, input, sessionToken);
  },

  updateProduct: async (id: string, input: unknown, sessionToken: string): Promise<IPCResponse<any>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.PRODUCT_UPDATE, id, input, sessionToken);
  },

  searchProducts: async (query: string, sessionToken: string, limit?: number): Promise<IPCResponse<any>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.PRODUCT_SEARCH, query, sessionToken, limit);
  },

  getProductByBarcode: async (barcode: string, sessionToken: string): Promise<IPCResponse<any>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.PRODUCT_GET_BY_BARCODE, barcode, sessionToken);
  },

  getProductById: async (id: string, sessionToken: string): Promise<IPCResponse<any>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.PRODUCT_GET_BY_ID, id, sessionToken);
  },

  // Phase 5: Suppliers & Purchases
  createSupplier: async (input: unknown, sessionToken: string): Promise<IPCResponse<any>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.SUPPLIER_CREATE, input, sessionToken);
  },

  updateSupplier: async (id: string, input: unknown, sessionToken: string): Promise<IPCResponse<any>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.SUPPLIER_UPDATE, id, input, sessionToken);
  },

  searchSuppliers: async (query: string, sessionToken: string, limit?: number): Promise<IPCResponse<any>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.SUPPLIER_SEARCH, query, sessionToken, limit);
  },

  listSuppliers: async (sessionToken: string, limit?: number, offset?: number): Promise<IPCResponse<any>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.SUPPLIER_LIST, sessionToken, limit, offset);
  },

  createPurchase: async (input: unknown, sessionToken: string): Promise<IPCResponse<any>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.PURCHASE_CREATE, input, sessionToken);
  },

  getPurchaseById: async (id: string, sessionToken: string): Promise<IPCResponse<any>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.PURCHASE_GET_BY_ID, id, sessionToken);
  },

  listPurchases: async (sessionToken: string, limit?: number, offset?: number): Promise<IPCResponse<any>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.PURCHASE_LIST, sessionToken, limit, offset);
  },

  cancelPurchase: async (id: string, sessionToken: string): Promise<IPCResponse<any>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.PURCHASE_CANCEL, id, sessionToken);
  },

  // Phase 5: Inventory & Batches
  getInventoryBatches: async (productId: string, sessionToken: string): Promise<IPCResponse<any>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.INVENTORY_GET_BATCHES, productId, sessionToken);
  },

  allocateFefoStock: async (input: unknown, sessionToken: string): Promise<IPCResponse<any>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.INVENTORY_FEFO_ALLOCATE, input, sessionToken);
  },

  adjustStock: async (input: unknown, sessionToken: string): Promise<IPCResponse<any>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.INVENTORY_ADJUST_STOCK, input, sessionToken);
  },

  getExpiringSoon: async (withinDays: number, sessionToken: string): Promise<IPCResponse<any>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.INVENTORY_GET_EXPIRING_SOON, withinDays, sessionToken);
  },

  getExpiredStock: async (sessionToken: string): Promise<IPCResponse<any>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.INVENTORY_GET_EXPIRED, sessionToken);
  },

  getLowStock: async (sessionToken: string): Promise<IPCResponse<any>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.INVENTORY_GET_LOW_STOCK, sessionToken);
  },

  getStockMovements: async (productId: string | undefined, sessionToken: string): Promise<IPCResponse<any>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.INVENTORY_GET_MOVEMENTS, productId, sessionToken);
  },

  // Phase 5: Sales, POS & Billing
  createSale: async (input: unknown, sessionToken: string): Promise<IPCResponse<any>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.SALE_CREATE, input, sessionToken);
  },

  getSaleById: async (id: string, sessionToken: string): Promise<IPCResponse<any>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.SALE_GET_BY_ID, id, sessionToken);
  },

  getSaleByBillNumber: async (billNumber: string, sessionToken: string): Promise<IPCResponse<any>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.SALE_GET_BY_BILL, billNumber, sessionToken);
  },

  listSales: async (sessionToken: string, limit?: number, offset?: number): Promise<IPCResponse<any>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.SALE_LIST, sessionToken, limit, offset);
  },

  listSalesByPatient: async (patientId: string, sessionToken: string): Promise<IPCResponse<any>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.SALE_LIST_BY_PATIENT, patientId, sessionToken);
  },

  cancelSale: async (id: string, sessionToken: string): Promise<IPCResponse<any>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.SALE_CANCEL, id, sessionToken);
  },

  createSaleReturn: async (input: unknown, sessionToken: string): Promise<IPCResponse<any>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.SALE_RETURN, input, sessionToken);
  },

  matchPrescriptionItems: async (prescriptionId: string, sessionToken: string): Promise<IPCResponse<any>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.SALE_MATCH_PRESCRIPTION, prescriptionId, sessionToken);
  },

  getDailySalesReport: async (dateStr: string, sessionToken: string): Promise<IPCResponse<any>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.REPORT_DAILY_SALES, dateStr, sessionToken);
  },

  // Phase 6: System Utilities, Backup & Restore
  createBackup: async (optionsOrSession: any, maybeSession?: string): Promise<IPCResponse<any>> => {
    if (typeof optionsOrSession === 'string' && !maybeSession) {
      return ipcRenderer.invoke(IPC_CHANNELS.BACKUP_CREATE, optionsOrSession);
    }
    return ipcRenderer.invoke(IPC_CHANNELS.BACKUP_CREATE, maybeSession, optionsOrSession);
  },

  listBackups: async (sessionToken: string): Promise<IPCResponse<any>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.BACKUP_LIST, sessionToken);
  },

  verifyBackup: async (backupPath: string, expectedChecksum: string | undefined, sessionToken: string): Promise<IPCResponse<any>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.BACKUP_VERIFY, sessionToken, backupPath, expectedChecksum);
  },

  restoreBackup: async (optionsOrPath: any, targetOrSession?: string, maybeSession?: string): Promise<IPCResponse<any>> => {
    if (typeof optionsOrPath === 'string') {
      return ipcRenderer.invoke(IPC_CHANNELS.BACKUP_RESTORE, maybeSession || targetOrSession, {
        source: 'LOCAL',
        backupIdOrPath: optionsOrPath,
        targetDbPath: typeof targetOrSession === 'string' && maybeSession ? targetOrSession : undefined
      });
    }
    return ipcRenderer.invoke(IPC_CHANNELS.BACKUP_RESTORE, targetOrSession, optionsOrPath);
  },

  getBackupSettings: async (sessionToken: string): Promise<IPCResponse<any>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.BACKUP_GET_SETTINGS, sessionToken);
  },

  updateBackupSettings: async (settings: any, sessionToken: string): Promise<IPCResponse<any>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.BACKUP_UPDATE_SETTINGS, sessionToken, settings);
  },

  retryCloudBackups: async (sessionToken: string): Promise<IPCResponse<any>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.BACKUP_RETRY_CLOUD, sessionToken);
  },

  listCloudBackups: async (sessionToken: string): Promise<IPCResponse<any>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.BACKUP_LIST_CLOUD, sessionToken);
  },

  connectGoogleDrive: async (authCode: string, sessionToken: string): Promise<IPCResponse<any>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.BACKUP_CONNECT_GDRIVE, sessionToken, authCode);
  },

  disconnectGoogleDrive: async (sessionToken: string): Promise<IPCResponse<any>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.BACKUP_DISCONNECT_GDRIVE, sessionToken);
  },

  uploadBackupGoogleDrive: async (backupPath: string, sessionToken: string): Promise<IPCResponse<any>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.BACKUP_UPLOAD_GDRIVE, sessionToken, backupPath);
  },

  // Phase 6: Licensing
  getLicenseStatus: async (sessionToken?: string): Promise<IPCResponse<any>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.LICENSE_GET_STATUS, sessionToken);
  },

  activateLicense: async (licenseToken: string, sessionToken: string): Promise<IPCResponse<any>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.LICENSE_ACTIVATE, sessionToken, licenseToken);
  },

  // Phase 6: Printing & Hardware
  printPrescription: async (printData: any, options: any, sessionToken: string): Promise<IPCResponse<any>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.PRINT_PRESCRIPTION, sessionToken, printData, options);
  },

  printInvoice: async (billData: any, options: any, sessionToken: string): Promise<IPCResponse<any>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.PRINT_INVOICE, sessionToken, billData, options);
  },

  printReceipt: async (billData: any, options: any, sessionToken: string): Promise<IPCResponse<any>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.PRINT_RECEIPT, sessionToken, billData, options);
  },

  testPrinter: async (printerName: string | undefined, type: any, sessionToken: string): Promise<IPCResponse<any>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.PRINT_TEST, sessionToken, printerName, type);
  },

  getPrinterConfig: async (sessionToken: string): Promise<IPCResponse<any>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.PRINT_GET_CONFIG, sessionToken);
  },

  savePrinterConfig: async (configData: any, sessionToken: string): Promise<IPCResponse<any>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.PRINT_SAVE_CONFIG, sessionToken, configData);
  },

  // Phase 6: Diagnostics & Support
  runDiagnostics: async (sessionToken: string): Promise<IPCResponse<any>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.DIAGNOSTICS_RUN, sessionToken);
  },

  exportSupportBundle: async (sessionToken: string): Promise<IPCResponse<any>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.DIAGNOSTICS_EXPORT_BUNDLE, sessionToken);
  },

  // Phase 7: LAN & Multi-Computer Mode
  getLanConfig: async (sessionToken: string): Promise<IPCResponse<any>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.LAN_GET_CONFIG, sessionToken);
  },

  saveLanConfig: async (dto: any, sessionToken: string): Promise<IPCResponse<any>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.LAN_SAVE_CONFIG, sessionToken, dto);
  },

  startLanServer: async (sessionToken: string): Promise<IPCResponse<any>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.LAN_START_SERVER, sessionToken);
  },

  stopLanServer: async (sessionToken: string): Promise<IPCResponse<any>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.LAN_STOP_SERVER, sessionToken);
  },

  generateLanPairingPin: async (sessionToken: string): Promise<IPCResponse<any>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.LAN_GENERATE_PIN, sessionToken);
  },

  registerLanDevice: async (dto: any): Promise<IPCResponse<any>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.LAN_REGISTER_DEVICE, dto);
  },

  approveLanDevice: async (deviceId: string, sessionToken: string): Promise<IPCResponse<any>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.LAN_APPROVE_DEVICE, sessionToken, deviceId);
  },

  revokeLanDevice: async (deviceId: string, sessionToken: string): Promise<IPCResponse<any>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.LAN_REVOKE_DEVICE, sessionToken, deviceId);
  },

  listLanDevices: async (sessionToken: string): Promise<IPCResponse<any>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.LAN_LIST_DEVICES, sessionToken);
  },

  getLanStatus: async (sessionToken?: string): Promise<IPCResponse<any>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.LAN_GET_STATUS, sessionToken);
  }
};

export type MediDeskBridge = typeof mediDeskBridge;

// Expose safe API to renderer
contextBridge.exposeInMainWorld('mediDeskBridge', mediDeskBridge);
