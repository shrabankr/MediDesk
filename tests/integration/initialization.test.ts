import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  SqliteDatabase,
  MigrationRunner,
  SqliteOrganizationRepository,
  SqliteUserRepository,
  SqliteAuditRepository,
  SqliteApplicationStateRepository
} from '@medidesk/database';
import { AuditService } from '@medidesk/audit';
import {
  SystemInitializationService,
  ScryptPasswordHasher
} from '@medidesk/application';
import { RoleName, AuditAction } from '@medidesk/domain';

describe('System Initialization End-to-End Orchestration', () => {
  let testDir: string;
  let db: SqliteDatabase;
  let initService: SystemInitializationService;
  let auditRepo: SqliteAuditRepository;
  let userRepo: SqliteUserRepository;
  let stateRepo: SqliteApplicationStateRepository;

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'medidesk-init-test-'));
    const testDbPath = path.join(testDir, 'init_test.sqlite');
    db = new SqliteDatabase({ databasePath: testDbPath });

    const migrationsDir = path.resolve(__dirname, '../../database/migrations');
    const runner = new MigrationRunner(db, migrationsDir);

    const orgRepo = new SqliteOrganizationRepository(db);
    userRepo = new SqliteUserRepository(db);
    auditRepo = new SqliteAuditRepository(db);
    stateRepo = new SqliteApplicationStateRepository(db);
    const auditService = new AuditService(auditRepo);
    const passwordHasher = new ScryptPasswordHasher();

    initService = new SystemInitializationService(
      orgRepo,
      userRepo,
      stateRepo,
      auditService,
      runner,
      passwordHasher
    );
  });

  afterEach(() => {
    db.close();
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('should complete first-run setup: migrations, org, owner, and audit log', async () => {
    const preState = await initService.getInitializationState();
    expect(preState.isInitialized).toBe(false);
    expect(preState.requiresDeveloperSetup).toBe(true);

    const result = await initService.initialize({
      organization: {
        name: 'Metro City Clinic',
        code: 'METRO_CLINIC',
        currency: 'INR',
        timezone: 'Asia/Kolkata'
      },
      initialOwner: {
        username: 'clinic_owner',
        email: 'owner@metroclinic.com',
        fullName: 'Dr. John Doe',
        password: 'SecureOwnerPassword123!'
      },
      developerToken: 'dev-authorized-token-123'
    });

    expect(result.organizationId).toBeDefined();
    expect(result.ownerId).toBeDefined();
    expect(result.migrationsApplied).toBe(7);

    // Verify post-initialization state
    const postState = await initService.getInitializationState();
    expect(postState.isInitialized).toBe(true);
    expect(postState.requiresDeveloperSetup).toBe(false);
    expect(postState.userCount).toBe(1);

    // Verify owner account created with role OWNER and hashed password
    const owner = await userRepo.findById(result.ownerId);
    expect(owner).not.toBeNull();
    expect(owner?.username).toBe('clinic_owner');
    expect(owner?.roles).toContain(RoleName.OWNER);
    expect(owner?.passwordHash).toContain('scrypt$');

    // Verify SYSTEM_INITIALIZED audit event
    const audits = await auditRepo.listRecent(10);
    expect(audits.some((a) => a.action === AuditAction.SYSTEM_INITIALIZED)).toBe(true);

    // Attempting to re-initialize should throw DomainError
    await expect(
      initService.initialize({
        organization: { name: 'New Org', code: 'NEW_ORG', currency: 'INR', timezone: 'Asia/Kolkata' },
        initialOwner: { username: 'owner2', email: 'owner2@test.com', fullName: 'Owner 2', password: 'Password123!' },
        developerToken: 'dev-token-123'
      })
    ).rejects.toThrow();
  });
});
