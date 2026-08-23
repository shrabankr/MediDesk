import { SqliteDatabase, MigrationRunner } from '@medidesk/database';
import { IApplicationStateRepository } from '@medidesk/domain';
import { ILicenseService } from '@medidesk/licensing';
import { AppConfig, SystemStatusData } from '@medidesk/shared';

export class StatusService {
  private db: SqliteDatabase;
  private stateRepo: IApplicationStateRepository;
  private migrationRunner: MigrationRunner;
  private licenseService: ILicenseService;
  private config: AppConfig;
  private startTime: number;

  constructor(
    db: SqliteDatabase,
    stateRepo: IApplicationStateRepository,
    migrationRunner: MigrationRunner,
    licenseService: ILicenseService,
    config: AppConfig
  ) {
    this.db = db;
    this.stateRepo = stateRepo;
    this.migrationRunner = migrationRunner;
    this.licenseService = licenseService;
    this.config = config;
    this.startTime = Date.now();
  }

  public async getSystemStatus(): Promise<SystemStatusData> {
    const isDbConnected = this.db.isConnected();
    const appliedMigrations = this.migrationRunner.getAppliedMigrations();
    const isInitialized = isDbConnected ? await this.stateRepo.isInitialized() : false;
    const entitlement = await this.licenseService.getEntitlement();
    const trialDaysRemaining = this.licenseService.getTrialDaysRemaining(entitlement);

    const uptimeSeconds = Math.floor((Date.now() - this.startTime) / 1000);

    return {
      appName: this.config.appName,
      version: this.config.version,
      database: {
        status: isDbConnected ? 'connected' : 'disconnected',
        databasePath: this.config.databasePath,
        appliedMigrations: appliedMigrations.length
      },
      application: {
        status: isDbConnected ? 'ready' : 'error',
        initialized: isInitialized,
        uptimeSeconds
      },
      network: {
        mode: 'offline_first',
        internetRequired: false,
        isOnline: false // Offline by default, network is optional
      },
      licensing: {
        status: entitlement.status,
        trialDaysRemaining
      },
      security: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true
      },
      environment: this.config.env
    };
  }
}
