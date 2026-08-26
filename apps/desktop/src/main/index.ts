import { app, BrowserWindow, session } from 'electron';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadConfig, Logger } from '@medidesk/shared';
import {
  SqliteDatabase,
  MigrationRunner,
  SqliteOrganizationRepository,
  SqliteUserRepository,
  SqliteRoleRepository,
  SqlitePermissionRepository,
  SqliteAuditRepository,
  SqliteApplicationStateRepository,
  SqlitePatientRepository,
  SqliteDoctorRepository,
  SqliteAppointmentRepository,
  SqliteClinicalVisitRepository,
  SqliteVitalsRepository,
  SqliteAllergyRepository,
  SqliteMedicalHistoryRepository,
  SqliteDiagnosisRepository,
  SqlitePrescriptionRepository,
  SqliteFollowUpRepository,
  SqliteClinicalCorrectionRepository,
  SqliteMedicineRepository,
  SqliteMedicineProductRepository,
  SqliteSupplierRepository,
  SqliteInventoryBatchRepository,
  SqliteStockMovementRepository,
  SqlitePurchaseRepository,
  SqliteSaleRepository,
  SqliteSaleReturnRepository,
  SqliteTaxRuleRepository,
  SqliteBackupLogRepository,
  SqliteBackupSettingsRepository,
  SqliteLicenseRepository,
  SqlitePrinterConfigRepository,
  SqliteLanDeviceRepository,
  SqliteLanServerConfigRepository,
  SqlitePackagingUnitRepository,
  SqliteSystemAlertRepository,
  SqliteAlertConfigRepository,
  SqliteDashboardPreferenceRepository,
  SqliteScheduledBackupConfigRepository
} from '@medidesk/database';
import { AuditService } from '@medidesk/audit';
import { LicenseService } from '@medidesk/licensing';
import { BackupService } from '@medidesk/backup';
import { PrintService } from '@medidesk/printing';
import { LanServer, LanClientGateway, LanSecurityManager } from '@medidesk/lan';
import { RBACEngine } from '@medidesk/authorization';
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
  PharmacyBillingService,
  PackagingUnitService,
  SmartAlertService,
  DashboardService,
  DocumentDeliveryService,
  ScheduledBackupService,
  ScryptPasswordHasher
} from '@medidesk/application';
import { registerAllIpcHandlers } from './ipc/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const logger = new Logger('ElectronMain');
let mainWindow: BrowserWindow | null = null;
let sqliteDb: SqliteDatabase | null = null;

const config = loadConfig();

function setupSecurityHeaders() {
  const isDev = config.isDevelopment;

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          isDev
            ? "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' ws://localhost:5173 http://localhost:5173"
            : "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'"
        ]
      }
    });
  });
}

function initializeServices() {
  logger.info(`Initializing MediDesk services (Environment: ${config.env})...`);

  // 1. Initialize SQLite Database
  sqliteDb = new SqliteDatabase({
    databasePath: config.databasePath,
    verbose: config.isDevelopment
  });

  // 2. Migration directory resolution
  const migrationsDir = app.isPackaged
    ? path.join(process.resourcesPath, 'database', 'migrations')
    : path.resolve(__dirname, '../../../../database/migrations');

  const migrationRunner = new MigrationRunner(sqliteDb, migrationsDir);

  // Run pending schema migrations
  const appliedCount = migrationRunner.runPendingMigrations();
  logger.info(`Schema migrations checked. Applied in this run: ${appliedCount}`);

  // 3. Initialize Repositories
  const orgRepo = new SqliteOrganizationRepository(sqliteDb);
  const userRepo = new SqliteUserRepository(sqliteDb);
  const roleRepo = new SqliteRoleRepository(sqliteDb);
  const _permRepo = new SqlitePermissionRepository(sqliteDb);
  const auditRepo = new SqliteAuditRepository(sqliteDb);
  const stateRepo = new SqliteApplicationStateRepository(sqliteDb);
  const patientRepo = new SqlitePatientRepository(sqliteDb);
  const doctorRepo = new SqliteDoctorRepository(sqliteDb);
  const appointmentRepo = new SqliteAppointmentRepository(sqliteDb);
  const visitRepo = new SqliteClinicalVisitRepository(sqliteDb);
  const vitalsRepo = new SqliteVitalsRepository(sqliteDb);
  const allergyRepo = new SqliteAllergyRepository(sqliteDb);
  const historyRepo = new SqliteMedicalHistoryRepository(sqliteDb);
  const diagnosisRepo = new SqliteDiagnosisRepository(sqliteDb);
  const rxRepo = new SqlitePrescriptionRepository(sqliteDb);
  const followUpRepo = new SqliteFollowUpRepository(sqliteDb);
  const correctionRepo = new SqliteClinicalCorrectionRepository(sqliteDb);
  const medicineRepo = new SqliteMedicineRepository(sqliteDb);
  const productRepo = new SqliteMedicineProductRepository(sqliteDb);
  const supplierRepo = new SqliteSupplierRepository(sqliteDb);
  const batchRepo = new SqliteInventoryBatchRepository(sqliteDb);
  const movementRepo = new SqliteStockMovementRepository(sqliteDb);
  const purchaseRepo = new SqlitePurchaseRepository(sqliteDb);
  const saleRepo = new SqliteSaleRepository(sqliteDb);
  const saleReturnRepo = new SqliteSaleReturnRepository(sqliteDb);
  const backupRepo = new SqliteBackupLogRepository(sqliteDb);
  const backupSettingsRepo = new SqliteBackupSettingsRepository(sqliteDb);
  const licenseRepo = new SqliteLicenseRepository(sqliteDb);
  const printerRepo = new SqlitePrinterConfigRepository(sqliteDb);

  // 4. Initialize Services & Engines
  const auditService = new AuditService(auditRepo);
  const rbacEngine = new RBACEngine();
  const licenseService = new LicenseService(licenseRepo, auditService, rbacEngine, undefined, config.isDevelopment);
  const defaultBackupDir = path.join(app.getPath('userData'), 'backups');
  const backupService = new BackupService(config.databasePath, defaultBackupDir, backupRepo, auditService, rbacEngine, backupSettingsRepo);
  const printService = new PrintService();
  const passwordHasher = new ScryptPasswordHasher();

  const initService = new SystemInitializationService(
    orgRepo,
    userRepo,
    stateRepo,
    auditService,
    migrationRunner,
    passwordHasher
  );

  const statusService = new StatusService(
    sqliteDb,
    stateRepo,
    migrationRunner,
    licenseService,
    config
  );

  const authService = new AuthenticationService(
    userRepo,
    orgRepo,
    stateRepo,
    passwordHasher,
    auditService,
    rbacEngine
  );

  const userService = new UserManagementService(
    userRepo,
    orgRepo,
    roleRepo,
    stateRepo,
    passwordHasher,
    auditService,
    rbacEngine
  );

  const patientService = new PatientService(
    patientRepo,
    auditService,
    rbacEngine
  );

  const doctorService = new DoctorService(
    doctorRepo,
    auditService,
    rbacEngine
  );

  const appointmentService = new AppointmentService(
    appointmentRepo,
    patientRepo,
    doctorRepo,
    auditService,
    rbacEngine
  );

  const clinicalVisitService = new ClinicalVisitService(
    visitRepo,
    patientRepo,
    doctorRepo,
    auditService,
    rbacEngine,
    appointmentRepo,
    correctionRepo
  );

  const prescriptionService = new PrescriptionService(
    rxRepo,
    patientRepo,
    doctorRepo,
    auditService,
    rbacEngine,
    allergyRepo
  );

  const medicalRecordService = new PatientMedicalRecordService(
    vitalsRepo,
    allergyRepo,
    historyRepo,
    diagnosisRepo,
    followUpRepo,
    patientRepo,
    auditService,
    rbacEngine
  );

  const medicineService = new MedicineMasterService(
    medicineRepo,
    productRepo,
    auditService,
    rbacEngine
  );

  const supplierPurchaseService = new SupplierPurchaseService(
    supplierRepo,
    purchaseRepo,
    auditService,
    rbacEngine
  );

  const inventoryService = new InventoryService(
    batchRepo,
    movementRepo,
    productRepo,
    auditService,
    rbacEngine
  );

  const billingService = new PharmacyBillingService(
    saleRepo,
    saleReturnRepo,
    batchRepo,
    productRepo,
    auditService,
    rbacEngine,
    rxRepo
  );

  const lanDeviceRepo = new SqliteLanDeviceRepository(sqliteDb);
  const lanConfigRepo = new SqliteLanServerConfigRepository(sqliteDb);
  const lanSecurityManager = new LanSecurityManager(lanConfigRepo, lanDeviceRepo);
  const lanServer = new LanServer(lanConfigRepo, lanDeviceRepo, lanSecurityManager, {
    authService,
    patientService,
    doctorService,
    appointmentService,
    clinicalVisitService,
    prescriptionService,
    medicalRecordService,
    medicineService,
    purchaseService: supplierPurchaseService,
    inventoryService,
    billingService,
    auditService,
    rbacEngine
  });
  const lanGateway = new LanClientGateway({
    serverUrl: 'http://localhost:4848',
    organizationId: 'default-org'
  });

  // Phase 8: Packaging, Alerts, Dashboard, Document Delivery, Backup Scheduler
  const packagingRepo = new SqlitePackagingUnitRepository(sqliteDb);
  const alertRepo = new SqliteSystemAlertRepository(sqliteDb);
  const alertConfigRepo = new SqliteAlertConfigRepository(sqliteDb);
  const dashboardPrefRepo = new SqliteDashboardPreferenceRepository(sqliteDb);
  const scheduledBackupRepo = new SqliteScheduledBackupConfigRepository(sqliteDb);

  const packagingService = new PackagingUnitService(packagingRepo, productRepo, auditService);
  const smartAlertService = new SmartAlertService(alertRepo, alertConfigRepo, auditService);
  const dashboardService = new DashboardService(dashboardPrefRepo, auditService);
  const documentDeliveryService = new DocumentDeliveryService(printService, auditService);
  const scheduledBackupService = new ScheduledBackupService(scheduledBackupRepo, backupService, auditService);

  // 5. Register IPC Handlers
  registerAllIpcHandlers({
    statusService,
    initService,
    authService,
    userService,
    patientService,
    doctorService,
    appointmentService,
    clinicalVisitService,
    prescriptionService,
    medicalRecordService,
    medicineService,
    supplierPurchaseService,
    inventoryService,
    billingService,
    backupService,
    licenseService,
    printService,
    printerRepo,
    lanServer,
    lanGateway,
    securityManager: lanSecurityManager,
    lanConfigRepo,
    lanDeviceRepo,
    packagingService,
    smartAlertService,
    dashboardService,
    documentDeliveryService,
    scheduledBackupService,
    auditService,
    config
  });

  logger.info('Services initialized and IPC handlers registered successfully.');
}

async function createWindow(): Promise<BrowserWindow> {
  const preloadCandidateMjs = path.join(__dirname, '../preload/index.mjs');
  const preloadCandidateJs = path.join(__dirname, '../preload/index.js');
  const preloadPath = fs.existsSync(preloadCandidateMjs) ? preloadCandidateMjs : preloadCandidateJs;

  logger.info(`Creating Electron BrowserWindow with preload: ${preloadPath}`);

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 680,
    title: 'MediDesk',
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false
    },
    show: false,
    autoHideMenuBar: true
  });

  mainWindow.webContents.setWindowOpenHandler(() => {
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    const isDev = config.isDevelopment;
    const isAllowed = isDev
      ? navigationUrl.startsWith('http://localhost:5173')
      : navigationUrl.startsWith('file://');

    if (!isAllowed) {
      event.preventDefault();
      logger.warn(`Blocked navigation to untrusted URL: ${navigationUrl}`);
    }
  });

  setupSecurityHeaders();

  if (process.env.VITE_DEV_SERVER_URL) {
    logger.info(`Loading Vite dev server: ${process.env.VITE_DEV_SERVER_URL}`);
    await mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    const indexPath = path.join(__dirname, '../renderer/index.html');
    logger.info(`Loading production file: ${indexPath}`);
    await mainWindow.loadFile(indexPath);
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  return mainWindow;
}

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  logger.warn('Another instance is already running. Exiting.');
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    try {
      initializeServices();
      await createWindow();

      app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
          createWindow();
        }
      });
    } catch (err) {
      logger.error('Failed to initialize MediDesk application:', err);
      app.quit();
    }
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  app.on('before-quit', () => {
    if (sqliteDb) {
      logger.info('Closing SQLite database connection before quit.');
      sqliteDb.close();
      sqliteDb = null;
    }
  });
}
