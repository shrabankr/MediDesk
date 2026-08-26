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
import {
  RoleName,
  LastActiveOwnerProtectionError,
  AccountLockedError,
  AuthenticationError,
  AuthorizationError,
  AuditAction,
  AuditResult
} from '@medidesk/domain';

describe('Sole Owner Lockout & Emergency Recovery Security Tests', () => {
  let testDir: string;
  let dbPath: string;
  let db: SqliteDatabase;
  let orgRepo: SqliteOrganizationRepository;
  let userRepo: SqliteUserRepository;
  let stateRepo: SqliteApplicationStateRepository;
  let auditRepo: SqliteAuditRepository;
  let initService: SystemInitializationService;
  let authService: AuthenticationService;
  let userService: UserManagementService;
  const emergencyRecoveryKey = 'emergency-recovery-token-2026-secret';

  beforeEach(async () => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'medidesk-recovery-test-'));
    dbPath = path.join(testDir, 'recovery.sqlite');

    db = new SqliteDatabase({ databasePath: dbPath });

    const migrationsDir = path.resolve(__dirname, '../../database/migrations');
    const runner = new MigrationRunner(db, migrationsDir);

    orgRepo = new SqliteOrganizationRepository(db);
    userRepo = new SqliteUserRepository(db);
    const roleRepo = new SqliteRoleRepository(db);
    const _permRepo = new SqlitePermissionRepository(db);
    auditRepo = new SqliteAuditRepository(db);
    stateRepo = new SqliteApplicationStateRepository(db);

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

    // Initialize clinic with Sole Owner
    await initService.initialize({
      organization: {
        name: 'St. Jude Community Hospital',
        code: 'SJCH',
        currency: 'INR',
        timezone: 'Asia/Kolkata'
      },
      initialOwner: {
        username: 'sole_owner',
        email: 'sole.owner@stjude.local',
        fullName: 'Dr. Gregory House',
        password: 'CorrectPassword123!'
      },
      developerToken: emergencyRecoveryKey
    });
  });

  afterEach(() => {
    db.close();
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('1. Sole active Owner can become temporarily login-locked after repeated failed passwords', async () => {
    // 5 failed login attempts
    for (let i = 0; i < 5; i++) {
      try {
        await authService.login({
          username: 'sole_owner',
          password: 'WrongPassword!'
        });
      } catch (_err) {
        // Expected authentication failure
      }
    }

    // Now account is locked
    await expect(
      authService.login({
        username: 'sole_owner',
        password: 'CorrectPassword123!'
      })
    ).rejects.toThrow(AccountLockedError);

    const user = await userRepo.findByUsername('sole_owner');
    expect(user?.isLocked).toBe(true);
    expect(user?.failedLoginAttempts).toBe(5);
  });

  it('2. A locked Owner still counts as an ACTIVE Owner for the organizational Last Active Owner invariant', async () => {
    const org = await orgRepo.getFirst();
    expect(org).not.toBeNull();

    // Lock the sole owner
    for (let i = 0; i < 5; i++) {
      try {
        await authService.login({
          username: 'sole_owner',
          password: 'WrongPassword!'
        });
      } catch (_err) {
        // Expected
      }
    }

    // Crucial check: countActiveOwners must still return 1 because the account status is ACTIVE (is_active = 1)
    const activeOwnerCount = await userRepo.countActiveOwners(org!.id);
    expect(activeOwnerCount).toBe(1);
  });

  it('3. Locked Owner cannot be disabled merely because the account is locked', async () => {
    const org = await orgRepo.getFirst();
    const user = await userRepo.findByUsername('sole_owner');

    // Lock owner
    for (let i = 0; i < 5; i++) {
      try {
        await authService.login({ username: 'sole_owner', password: 'WrongPassword!' });
      } catch (_err) {
        // Expected
      }
    }

    const lockedOwnerActor = {
      id: user!.id,
      organizationId: org!.id,
      username: user!.username,
      email: user!.email,
      fullName: user!.fullName,
      isActive: true,
      isLocked: true,
      failedLoginAttempts: 5,
      roles: [RoleName.OWNER],
      permissions: ['user.disable', 'user.update'],
      createdAt: user!.createdAt,
      updatedAt: user!.updatedAt
    };

    // Attempting to deactivate the locked sole owner must be DENIED by Last Active Owner Protection
    await expect(
      userService.toggleUserStatus(
        {
          userId: user!.id,
          isActive: false
        },
        lockedOwnerActor
      )
    ).rejects.toThrow(LastActiveOwnerProtectionError);
  });

  it('4. Locked Owner cannot lose the OWNER role if they are the last active Owner', async () => {
    const org = await orgRepo.getFirst();
    const user = await userRepo.findByUsername('sole_owner');

    // Lock owner
    for (let i = 0; i < 5; i++) {
      try {
        await authService.login({ username: 'sole_owner', password: 'WrongPassword!' });
      } catch (_err) {
        // Expected
      }
    }

    const lockedOwnerActor = {
      id: user!.id,
      organizationId: org!.id,
      username: user!.username,
      email: user!.email,
      fullName: user!.fullName,
      isActive: true,
      isLocked: true,
      failedLoginAttempts: 5,
      roles: [RoleName.OWNER],
      permissions: ['user.update'],
      createdAt: user!.createdAt,
      updatedAt: user!.updatedAt
    };

    // Attempting to demote the locked sole owner to DOCTOR must be DENIED
    await expect(
      userService.updateUser(
        {
          userId: user!.id,
          roles: [RoleName.DOCTOR]
        },
        lockedOwnerActor
      )
    ).rejects.toThrow(LastActiveOwnerProtectionError);
  });

  it('5. A second Owner can be created while the first Owner is locked, through authorized recovery workflow', async () => {
    const org = await orgRepo.getFirst();

    // Lock first owner
    for (let i = 0; i < 5; i++) {
      try {
        await authService.login({ username: 'sole_owner', password: 'WrongPassword!' });
      } catch (_err) {
        // Expected
      }
    }

    // Create second owner via authorized emergency recovery
    const secondOwner = await userService.createSecondaryOwnerViaRecovery({
      organizationId: org!.id,
      username: 'recovery_owner',
      email: 'recovery.owner@stjude.local',
      fullName: 'Dr. Recovery Owner',
      password: 'SecondaryOwnerPass123!',
      recoveryToken: emergencyRecoveryKey
    });

    expect(secondOwner.username).toBe('recovery_owner');
    expect(secondOwner.roles).toContain(RoleName.OWNER);

    // Verify both owners exist in DB
    const activeOwnerCount = await userRepo.countActiveOwners(org!.id);
    expect(activeOwnerCount).toBe(2);

    // Second owner can log in immediately
    const loginResult = await authService.login({
      username: 'recovery_owner',
      password: 'SecondaryOwnerPass123!'
    });
    expect(loginResult.user.username).toBe('recovery_owner');
  });

  it('6. There is a valid recovery path for the sole Owner to unlock and reset password', async () => {
    // 1. Lock sole owner
    for (let i = 0; i < 5; i++) {
      try {
        await authService.login({ username: 'sole_owner', password: 'WrongPassword!' });
      } catch (_err) {
        // Expected
      }
    }

    // 2. Perform emergency recovery
    const recoveryRes = await authService.recoverOwnerAccount({
      username: 'sole_owner',
      recoveryToken: emergencyRecoveryKey,
      newPassword: 'BrandNewPassword123!'
    });

    expect(recoveryRes.success).toBe(true);

    // 3. Sole Owner can now login with new password
    const loginRes = await authService.login({
      username: 'sole_owner',
      password: 'BrandNewPassword123!'
    });

    expect(loginRes.user.username).toBe('sole_owner');
    expect(loginRes.user.isLocked).toBe(false);
  }, 15000);

  it('7. Recovery does not create a hidden privilege escalation path', async () => {
    const org = await orgRepo.getFirst();

    // 1. Create regular doctor
    const _doc = await userRepo.create({
      organizationId: org!.id,
      username: 'dr_regular',
      email: 'regular@stjude.local',
      fullName: 'Regular Doctor',
      passwordHash: 'hash',
      roles: [RoleName.DOCTOR]
    });

    // 2. Non-owner cannot use owner recovery
    await expect(
      authService.recoverOwnerAccount({
        username: 'dr_regular',
        recoveryToken: emergencyRecoveryKey
      })
    ).rejects.toThrow(AuthorizationError);

    // 3. Invalid emergency recovery key is rejected
    await expect(
      authService.recoverOwnerAccount({
        username: 'sole_owner',
        recoveryToken: 'invalid-fake-token'
      })
    ).rejects.toThrow(AuthenticationError);

    // 4. Invalid recovery token cannot create secondary owner
    await expect(
      userService.createSecondaryOwnerViaRecovery({
        organizationId: org!.id,
        username: 'fake_owner',
        email: 'fake@stjude.local',
        fullName: 'Fake Owner',
        password: 'Password123!',
        recoveryToken: 'invalid-fake-token'
      })
    ).rejects.toThrow(AuthenticationError);
  });

  it('8. Audit events are generated for Owner recovery/unlock/password reset operations', async () => {
    // 1. Recover account
    await authService.recoverOwnerAccount({
      username: 'sole_owner',
      recoveryToken: emergencyRecoveryKey,
      newPassword: 'NewAuditedPassword123!'
    });

    // 2. Query audit logs
    const auditLogs = await auditRepo.listRecent(50);
    const recoveryLog = auditLogs.find((l) => l.resource === 'auth/recovery');

    expect(recoveryLog).toBeDefined();
    expect(recoveryLog?.action).toBe(AuditAction.USER_UPDATED);
    expect(recoveryLog?.result).toBe(AuditResult.SUCCESS);
  });
});
