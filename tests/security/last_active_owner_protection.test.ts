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
import { RoleName, LastActiveOwnerProtectionError, SessionUser } from '@medidesk/domain';

describe('Last Active Owner Protection Invariant Security Tests', () => {
  let testDir: string;
  let dbPath: string;
  let db: SqliteDatabase;
  let userRepo: SqliteUserRepository;
  let initService: SystemInitializationService;
  let authService: AuthenticationService;
  let userService: UserManagementService;
  let ownerSession: SessionUser;

  beforeEach(async () => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'medidesk-owner-protection-'));
    dbPath = path.join(testDir, 'owner_prot.sqlite');

    db = new SqliteDatabase({ databasePath: dbPath });

    const migrationsDir = path.resolve(__dirname, '../../database/migrations');
    const runner = new MigrationRunner(db, migrationsDir);

    const orgRepo = new SqliteOrganizationRepository(db);
    userRepo = new SqliteUserRepository(db);
    const roleRepo = new SqliteRoleRepository(db);
    const _permRepo = new SqlitePermissionRepository(db);
    const auditRepo = new SqliteAuditRepository(db);
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
      passwordHasher,
      auditService,
      rbacEngine
    );

    userService = new UserManagementService(
      userRepo,
      orgRepo,
      roleRepo,
      passwordHasher,
      auditService,
      rbacEngine
    );

    // Initialize clinic with Primary Owner
    await initService.initialize({
      organization: {
        name: 'Apex Health Center',
        code: 'APEX01',
        currency: 'INR',
        timezone: 'Asia/Kolkata'
      },
      initialOwner: {
        username: 'primary_owner',
        email: 'owner1@apex.local',
        fullName: 'Dr. Primary Owner',
        password: 'Password123!'
      },
      developerToken: 'dev-token-initial-setup-2026'
    });

    const loginRes = await authService.login({
      username: 'primary_owner',
      password: 'Password123!'
    });

    ownerSession = loginRes.user;
  });

  afterEach(() => {
    db.close();
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('should prevent deactivating the sole active Owner in the organization', async () => {
    const activeOwnersBefore = await userRepo.countActiveOwners(ownerSession.organizationId);
    expect(activeOwnersBefore).toBe(1);

    await expect(
      userService.toggleUserStatus(
        {
          userId: ownerSession.id,
          isActive: false
        },
        ownerSession
      )
    ).rejects.toThrow(LastActiveOwnerProtectionError);

    // Verify DB was unchanged
    const activeOwnersAfter = await userRepo.countActiveOwners(ownerSession.organizationId);
    expect(activeOwnersAfter).toBe(1);
  });

  it('should prevent removing the OWNER role from the sole active Owner', async () => {
    await expect(
      userService.updateUser(
        {
          userId: ownerSession.id,
          roles: [RoleName.DOCTOR]
        },
        ownerSession
      )
    ).rejects.toThrow(LastActiveOwnerProtectionError);

    // Verify DB was unchanged and role remains OWNER
    const user = await userRepo.findById(ownerSession.id);
    expect(user?.roles).toContain(RoleName.OWNER);
  });

  it('should allow deactivating an Owner when a second active Owner exists, but deny deactivating the remaining one', async () => {
    // 1. Create a second Owner
    const owner2 = await userService.createUser(
      {
        organizationId: ownerSession.organizationId,
        username: 'secondary_owner',
        email: 'owner2@apex.local',
        fullName: 'Dr. Secondary Owner',
        password: 'Password123!',
        roles: [RoleName.OWNER]
      },
      ownerSession
    );

    expect(await userRepo.countActiveOwners(ownerSession.organizationId)).toBe(2);

    // 2. Primary Owner deactivates Secondary Owner -> ALLOWED
    const disabledOwner2 = await userService.toggleUserStatus(
      {
        userId: owner2.id,
        isActive: false
      },
      ownerSession
    );
    expect(disabledOwner2.isActive).toBe(false);

    // 3. Now only 1 active owner remains
    expect(await userRepo.countActiveOwners(ownerSession.organizationId)).toBe(1);

    // 4. Primary Owner attempts to deactivate themselves -> DENIED
    await expect(
      userService.toggleUserStatus(
        {
          userId: ownerSession.id,
          isActive: false
        },
        ownerSession
      )
    ).rejects.toThrow(LastActiveOwnerProtectionError);
  });

  it('should allow removing OWNER role when multiple active Owners exist, but protect the last active Owner', async () => {
    // 1. Create second Owner
    const owner2 = await userService.createUser(
      {
        organizationId: ownerSession.organizationId,
        username: 'secondary_owner_2',
        email: 'owner22@apex.local',
        fullName: 'Dr. Secondary Owner Two',
        password: 'Password123!',
        roles: [RoleName.OWNER]
      },
      ownerSession
    );

    expect(await userRepo.countActiveOwners(ownerSession.organizationId)).toBe(2);

    // 2. Change owner2 role to DOCTOR -> ALLOWED
    const demotedOwner2 = await userService.updateUser(
      {
        userId: owner2.id,
        roles: [RoleName.DOCTOR]
      },
      ownerSession
    );
    expect(demotedOwner2.roles).toEqual([RoleName.DOCTOR]);
    expect(demotedOwner2.roles).not.toContain(RoleName.OWNER);

    // 3. Now only 1 active Owner remains (ownerSession)
    expect(await userRepo.countActiveOwners(ownerSession.organizationId)).toBe(1);

    // 4. Primary Owner attempts to remove OWNER role -> DENIED
    await expect(
      userService.updateUser(
        {
          userId: ownerSession.id,
          roles: [RoleName.DOCTOR]
        },
        ownerSession
      )
    ).rejects.toThrow(LastActiveOwnerProtectionError);
  });
});
