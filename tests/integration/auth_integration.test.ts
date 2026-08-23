import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
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
import {
  SystemInitializationService,
  AuthenticationService,
  UserManagementService,
  ScryptPasswordHasher
} from '@medidesk/application';
import { RBACEngine } from '@medidesk/authorization';
import { AuditService } from '@medidesk/audit';
import { RoleName, AuditAction, AccountLockedError } from '@medidesk/domain';

describe('Authentication & User Management SQLite Integration', () => {
  let testDir: string;
  let dbPath: string;
  let db: SqliteDatabase;
  let initService: SystemInitializationService;
  let authService: AuthenticationService;
  let userService: UserManagementService;
  let auditRepo: SqliteAuditRepository;

  beforeEach(async () => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'medidesk-auth-integ-'));
    dbPath = path.join(testDir, 'auth_integ.sqlite');

    db = new SqliteDatabase({ databasePath: dbPath });

    const migrationsDir = path.resolve(__dirname, '../../database/migrations');
    const runner = new MigrationRunner(db, migrationsDir);

    const orgRepo = new SqliteOrganizationRepository(db);
    const userRepo = new SqliteUserRepository(db);
    const roleRepo = new SqliteRoleRepository(db);
    const _permRepo = new SqlitePermissionRepository(db);
    auditRepo = new SqliteAuditRepository(db);
    const stateRepo = new SqliteApplicationStateRepository(db);

    const auditService = new AuditService(auditRepo);
    const passwordHasher = new ScryptPasswordHasher();
    const rbacEngine = new RBACEngine();

    initService = new SystemInitializationService(
      orgRepo,
      userRepo,
      stateRepo,
      auditService,
      runner,
      passwordHasher
    );

    authService = new AuthenticationService(
      userRepo,
      orgRepo,
      stateRepo,
      passwordHasher,
      auditService,
      rbacEngine
    );

    userService = new UserManagementService(
      userRepo,
      orgRepo,
      roleRepo,
      stateRepo,
      passwordHasher,
      auditService,
      rbacEngine
    );

    // Initialize System with initial Owner
    await initService.initialize({
      organization: {
        name: 'Evergreen Medical Clinic',
        code: 'EMC01',
        currency: 'INR',
        timezone: 'Asia/Kolkata'
      },
      initialOwner: {
        username: 'evergreen_owner',
        email: 'owner@evergreen.local',
        fullName: 'Dr. Evelyn Reed',
        password: 'OwnerPassword123!'
      },
      developerToken: 'dev-token-initial-setup-2026'
    });
  });

  afterEach(() => {
    db.close();
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('should support complete auth and user management lifecycle on SQLite', async () => {
    // 1. Authenticate Initial Owner
    const ownerLogin = await authService.login({
      username: 'evergreen_owner',
      password: 'OwnerPassword123!'
    });

    expect(ownerLogin.user.username).toBe('evergreen_owner');
    expect(ownerLogin.user.roles).toContain(RoleName.OWNER);
    expect(ownerLogin.sessionToken).toBeDefined();

    // 2. Owner creates a new Doctor account
    const doctorUser = await userService.createUser(
      {
        organizationId: ownerLogin.user.organizationId,
        username: 'dr_watson',
        email: 'watson@evergreen.local',
        fullName: 'Dr. John Watson',
        password: 'DoctorPass123!',
        roles: [RoleName.DOCTOR]
      },
      ownerLogin.user
    );

    expect(doctorUser.id).toBeDefined();
    expect(doctorUser.roles).toContain(RoleName.DOCTOR);

    // 3. Doctor logs in successfully
    const doctorLogin = await authService.login({
      username: 'dr_watson',
      password: 'DoctorPass123!'
    });

    expect(doctorLogin.user.fullName).toBe('Dr. John Watson');

    // 4. Test Lockout: 5 failed attempts on doctor account
    for (let i = 0; i < 5; i++) {
      try {
        await authService.login({
          username: 'dr_watson',
          password: 'IncorrectPassword!'
        });
      } catch (_err) {
        // Expected
      }
    }

    // Now account is locked
    await expect(
      authService.login({
        username: 'dr_watson',
        password: 'DoctorPass123!'
      })
    ).rejects.toThrow(AccountLockedError);

    // 5. Owner resets Doctor password and unlocks
    await userService.resetPassword(
      {
        userId: doctorUser.id,
        newPassword: 'NewDoctorPassword456!'
      },
      ownerLogin.user
    );

    // 6. Doctor can now login with new password
    const doctorReLogin = await authService.login({
      username: 'dr_watson',
      password: 'NewDoctorPassword456!'
    });

    expect(doctorReLogin.user.username).toBe('dr_watson');

    // 7. Verify Audit Trail in SQLite
    const auditLogs = await auditRepo.listRecent(50);
    const actions = auditLogs.map((l) => l.action);

    expect(actions).toContain(AuditAction.SYSTEM_INITIALIZED);
    expect(actions).toContain(AuditAction.USER_LOGIN);
    expect(actions).toContain(AuditAction.USER_CREATED);
    expect(actions).toContain(AuditAction.USER_LOGIN_FAILED);
    expect(actions).toContain(AuditAction.USER_UPDATED);
  });
});
