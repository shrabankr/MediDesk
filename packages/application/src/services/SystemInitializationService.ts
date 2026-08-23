import {
  IOrganizationRepository,
  IUserRepository,
  IApplicationStateRepository,
  ApplicationStateKeys,
  RoleName,
  DomainError
} from '@medidesk/domain';
import { IAuditService } from '@medidesk/audit';
import { MigrationRunner } from '@medidesk/database';
import { IPasswordHasher } from '@medidesk/domain';
import { InitializeSystemRequestInput, parseOrThrow, InitializeSystemRequestSchema } from '@medidesk/validation';
import { Logger } from '@medidesk/shared';

export interface InitializationResult {
  organizationId: string;
  ownerId: string;
  migrationsApplied: number;
  initializedAt: Date;
}

export class SystemInitializationService {
  private orgRepo: IOrganizationRepository;
  private userRepo: IUserRepository;
  private stateRepo: IApplicationStateRepository;
  private auditService: IAuditService;
  private migrationRunner: MigrationRunner;
  private passwordHasher: IPasswordHasher;
  private logger: Logger;

  constructor(
    orgRepo: IOrganizationRepository,
    userRepo: IUserRepository,
    stateRepo: IApplicationStateRepository,
    auditService: IAuditService,
    migrationRunner: MigrationRunner,
    passwordHasher: IPasswordHasher
  ) {
    this.orgRepo = orgRepo;
    this.userRepo = userRepo;
    this.stateRepo = stateRepo;
    this.auditService = auditService;
    this.migrationRunner = migrationRunner;
    this.passwordHasher = passwordHasher;
    this.logger = new Logger('SystemInitializationService');
  }

  public async getInitializationState(): Promise<{
    isInitialized: boolean;
    requiresDeveloperSetup: boolean;
    organizationCount: number;
    userCount: number;
  }> {
    const isInitialized = await this.stateRepo.isInitialized();
    const existingOrg = await this.orgRepo.getFirst();
    const userCount = await this.userRepo.count();

    return {
      isInitialized,
      requiresDeveloperSetup: !isInitialized,
      organizationCount: existingOrg ? 1 : 0,
      userCount
    };
  }

  public async initialize(input: InitializeSystemRequestInput): Promise<InitializationResult> {
    const validated = parseOrThrow(InitializeSystemRequestSchema, input, 'SystemInitialization');

    const isAlreadyInitialized = await this.stateRepo.isInitialized();
    if (isAlreadyInitialized) {
      throw new DomainError('System is already initialized. First-run setup cannot be repeated.');
    }

    this.logger.info('Running pending database migrations...');
    const migrationsApplied = this.migrationRunner.runPendingMigrations();

    this.logger.info(`Creating initial organization: ${validated.organization.name}`);
    const organization = await this.orgRepo.create({
      name: validated.organization.name,
      code: validated.organization.code,
      address: validated.organization.address,
      phone: validated.organization.phone,
      email: validated.organization.email,
      currency: validated.organization.currency ?? 'INR',
      timezone: validated.organization.timezone ?? 'Asia/Kolkata'
    });

    this.logger.info(`Creating initial Owner account: ${validated.initialOwner.username}`);
    const passwordHash = await this.passwordHasher.hash(validated.initialOwner.password);
    const owner = await this.userRepo.create({
      organizationId: organization.id,
      username: validated.initialOwner.username,
      email: validated.initialOwner.email,
      fullName: validated.initialOwner.fullName,
      passwordHash,
      roles: [RoleName.OWNER]
    });

    const now = new Date();
    await this.stateRepo.setInitialized(owner.id);

    // Securely hash and store emergency recovery key for Owner account recovery
    const recoveryKeyHash = await this.passwordHasher.hash(validated.developerToken);
    await this.stateRepo.set(ApplicationStateKeys.EMERGENCY_RECOVERY_KEY_HASH, recoveryKeyHash);

    await this.auditService.logSystemInitialized(owner.id, owner.username, {
      organizationId: organization.id,
      organizationName: organization.name,
      migrationsApplied
    });

    this.logger.info('System initialization completed successfully.');

    return {
      organizationId: organization.id,
      ownerId: owner.id,
      migrationsApplied,
      initializedAt: now
    };
  }
}
