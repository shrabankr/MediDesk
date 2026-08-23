import { app, BrowserWindow, session } from 'electron';
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
  SqliteApplicationStateRepository
} from '@medidesk/database';
import { AuditService } from '@medidesk/audit';
import { LicenseService } from '@medidesk/licensing';
import {
  StatusService,
  SystemInitializationService,
  ScryptPasswordHasher
} from '@medidesk/application';
import { registerAllIpcHandlers } from './ipc/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const logger = new Logger('ElectronMain');
let mainWindow: BrowserWindow | null = null;
let sqliteDb: SqliteDatabase | null = null;

// The built directory structure
//
// ├─┬ dist
// │ ├─┬ main
// │ │ └── index.js
// │ ├─┬ preload
// │ │ └── index.js
// │ └─┬ renderer
// │   └── index.html

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
const config = loadConfig();

function setupSecurityHeaders(): void {
  // Enforce strict Content Security Policy
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
  const permRepo = new SqlitePermissionRepository(sqliteDb);
  const auditRepo = new SqliteAuditRepository(sqliteDb);
  const stateRepo = new SqliteApplicationStateRepository(sqliteDb);

  // 4. Initialize Services
  const auditService = new AuditService(auditRepo);
  const licenseService = new LicenseService(config.isDevelopment);
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

  // 5. Register IPC Handlers
  registerAllIpcHandlers({
    statusService,
    initService,
    auditService,
    config
  });

  logger.info('Services initialized and IPC handlers registered successfully.');
}

async function createWindow(): Promise<BrowserWindow> {
  const preloadPath = path.join(__dirname, '../preload/index.js');
  logger.info(`Creating BrowserWindow with preload: ${preloadPath}`);

  mainWindow = new BrowserWindow({
    title: 'MediDesk',
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      // STRICT ELECTRON SECURITY FLAGS
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false
    }
  });

  // Prevent navigation to untrusted external URLs
  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl);
    if (parsedUrl.origin !== 'http://localhost:5173' && parsedUrl.protocol !== 'file:') {
      logger.warn(`Blocked navigation to untrusted URL: ${navigationUrl}`);
      event.preventDefault();
    }
  });

  // Prevent opening new untrusted windows
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    logger.warn(`Blocked new window creation for URL: ${url}`);
    return { action: 'deny' };
  });

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show();
    logger.info('MediDesk window displayed.');
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    logger.info(`Loading dev server URL: ${process.env.VITE_DEV_SERVER_URL}`);
    await mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    const indexHtml = path.join(__dirname, '../renderer/index.html');
    logger.info(`Loading production HTML: ${indexHtml}`);
    await mainWindow.loadFile(indexHtml);
  }

  return mainWindow;
}

// App lifecycle
app.whenReady().then(async () => {
  setupSecurityHeaders();
  initializeServices();
  await createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  logger.info('MediDesk application shutting down...');
  if (sqliteDb) {
    sqliteDb.close();
  }
});
