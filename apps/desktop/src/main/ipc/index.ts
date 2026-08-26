import { registerSystemIpc } from './system.ipc.js';
import { registerAuditIpc } from './audit.ipc.js';
import { registerConfigIpc } from './config.ipc.js';
import { registerAuthIpcHandlers } from './auth.ipc.js';
import { registerUserIpcHandlers } from './user.ipc.js';
import { registerPatientIpcHandlers } from './patient.ipc.js';
import { registerDoctorIpcHandlers } from './doctor.ipc.js';
import { registerAppointmentIpcHandlers } from './appointment.ipc.js';
import { registerClinicalIpcHandlers } from './clinical.ipc.js';
import { registerPrescriptionIpcHandlers } from './prescription.ipc.js';
import { registerPharmacyIpcHandlers } from './pharmacy.ipc.js';
import { registerPosIpcHandlers } from './pos.ipc.js';
import { registerSettingsIpcHandlers } from './settings.ipc.js';
import { registerLanIpcHandlers } from './lan.ipc.js';
import {
  StatusService,
  SystemInitializationService,
  AuthenticationService,
  UserManagementService,
  PatientService,
  DoctorService,
  AppointmentService,
  ClinicalVisitService,
  PrescriptionService,
  PatientMedicalRecordService,
  MedicineMasterService,
  SupplierPurchaseService,
  InventoryService,
  PharmacyBillingService
} from '@medidesk/application';
import { BackupService } from '@medidesk/backup';
import { LicenseService } from '@medidesk/licensing';
import { PrintService } from '@medidesk/printing';
import { SqlitePrinterConfigRepository } from '@medidesk/database';
import { registerPhase8IpcHandlers } from './phase8.ipc.js';
import {
  PackagingUnitService,
  SmartAlertService,
  DashboardService,
  DocumentDeliveryService,
  ScheduledBackupService
} from '@medidesk/application';
import { IAuditService } from '@medidesk/audit';
import { AppConfig } from '@medidesk/shared';

export interface RegisterIpcOptions {
  statusService: StatusService;
  initService: SystemInitializationService;
  authService: AuthenticationService;
  userService: UserManagementService;
  patientService: PatientService;
  doctorService: DoctorService;
  appointmentService: AppointmentService;
  clinicalVisitService: ClinicalVisitService;
  prescriptionService: PrescriptionService;
  medicalRecordService: PatientMedicalRecordService;
  medicineService: MedicineMasterService;
  supplierPurchaseService: SupplierPurchaseService;
  inventoryService: InventoryService;
  billingService: PharmacyBillingService;
  backupService?: BackupService;
  licenseService?: LicenseService;
  printService?: PrintService;
  printerRepo?: SqlitePrinterConfigRepository;
  lanServer?: any;
  lanGateway?: any;
  securityManager?: any;
  lanConfigRepo?: any;
  lanDeviceRepo?: any;
  packagingService?: PackagingUnitService;
  smartAlertService?: SmartAlertService;
  dashboardService?: DashboardService;
  documentDeliveryService?: DocumentDeliveryService;
  scheduledBackupService?: ScheduledBackupService;
  auditService: IAuditService;
  config: AppConfig;
}

export function registerAllIpcHandlers(options: RegisterIpcOptions): void {
  registerSystemIpc(options.statusService, options.initService);
  registerAuthIpcHandlers(options.authService);
  registerUserIpcHandlers(options.userService, options.authService);
  registerPatientIpcHandlers(options.patientService, options.authService);
  registerDoctorIpcHandlers(options.doctorService, options.authService);
  registerAppointmentIpcHandlers(options.appointmentService, options.authService);
  registerClinicalIpcHandlers(options.clinicalVisitService, options.medicalRecordService, options.authService);
  registerPrescriptionIpcHandlers(options.prescriptionService, options.authService);
  registerPharmacyIpcHandlers(
    options.medicineService,
    options.supplierPurchaseService,
    options.inventoryService,
    options.authService
  );
  registerPosIpcHandlers(options.billingService, options.authService);
  if (options.backupService && options.licenseService && options.printService) {
    registerSettingsIpcHandlers(
      options.backupService,
      options.licenseService,
      options.printService,
      options.authService,
      options.printerRepo
    );
  }
  if (options.lanServer && options.lanGateway && options.securityManager && options.lanConfigRepo && options.lanDeviceRepo) {
    registerLanIpcHandlers(
      options.lanServer,
      options.lanGateway,
      options.securityManager,
      options.authService,
      options.lanConfigRepo,
      options.lanDeviceRepo
    );
  }
  if (
    options.packagingService &&
    options.smartAlertService &&
    options.dashboardService &&
    options.documentDeliveryService &&
    options.scheduledBackupService
  ) {
    registerPhase8IpcHandlers(
      options.packagingService,
      options.smartAlertService,
      options.dashboardService,
      options.documentDeliveryService,
      options.scheduledBackupService,
      options.authService
    );
  }
  registerAuditIpc(options.auditService);
  registerConfigIpc(options.config);
}


