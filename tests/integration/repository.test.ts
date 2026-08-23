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
  SqliteAuditRepository,
  SqliteApplicationStateRepository
} from '@medidesk/database';
import { RoleName, AuditAction, AuditResult } from '@medidesk/domain';

describe('SQLite Repositories Integration', () => {
  let testDir: string;
  let db: SqliteDatabase;
  let orgRepo: SqliteOrganizationRepository;
  let userRepo: SqliteUserRepository;
  let roleRepo: SqliteRoleRepository;
  let auditRepo: SqliteAuditRepository;
  let stateRepo: SqliteApplicationStateRepository;

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'medidesk-repo-test-'));
    const testDbPath = path.join(testDir, 'repo_test.sqlite');
    db = new SqliteDatabase({ databasePath: testDbPath });

    const migrationsDir = path.resolve(__dirname, '../../database/migrations');
    const runner = new MigrationRunner(db, migrationsDir);
    runner.runPendingMigrations();

    orgRepo = new SqliteOrganizationRepository(db);
    userRepo = new SqliteUserRepository(db);
    roleRepo = new SqliteRoleRepository(db);
    auditRepo = new SqliteAuditRepository(db);
    stateRepo = new SqliteApplicationStateRepository(db);
  });

  afterEach(() => {
    db.close();
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('should create and retrieve organization', async () => {
    const org = await orgRepo.create({
      name: 'Alpha Health Center',
      code: 'ALPHA_HEALTH',
      currency: 'INR',
      timezone: 'Asia/Kolkata'
    });

    expect(org.id).toBeDefined();
    expect(org.name).toBe('Alpha Health Center');

    const fetched = await orgRepo.findById(org.id);
    expect(fetched?.code).toBe('ALPHA_HEALTH');
  });

  it('should create user with assigned role and enforce uniqueness', async () => {
    const org = await orgRepo.create({
      name: 'Beta Clinic',
      code: 'BETA_CLINIC',
      currency: 'INR',
      timezone: 'Asia/Kolkata'
    });

    const user = await userRepo.create({
      organizationId: org.id,
      username: 'dr_sharma',
      email: 'sharma@betaclinic.com',
      fullName: 'Dr. Sharma',
      passwordHash: 'dummy-hash',
      roles: [RoleName.DOCTOR]
    });

    expect(user.id).toBeDefined();
    expect(user.roles).toContain(RoleName.DOCTOR);

    const fetched = await userRepo.findByUsername('DR_SHARMA'); // Case insensitive check
    expect(fetched).not.toBeNull();
    expect(fetched?.fullName).toBe('Dr. Sharma');

    // Duplicate username should throw error
    await expect(
      userRepo.create({
        organizationId: org.id,
        username: 'dr_sharma',
        email: 'another@betaclinic.com',
        fullName: 'Another Doc',
        passwordHash: 'dummy',
        roles: [RoleName.DOCTOR]
      })
    ).rejects.toThrow();
  });

  it('should record and retrieve audit events', async () => {
    const event = await auditRepo.insert({
      action: AuditAction.USER_LOGIN,
      actor: { id: 'u1', username: 'clinician_1', role: 'DOCTOR' },
      target: 'Auth',
      result: AuditResult.SUCCESS,
      metadata: { workstation: 'PC-01' }
    });

    expect(event.id).toBeDefined();
    expect(event.action).toBe(AuditAction.USER_LOGIN);

    const recent = await auditRepo.listRecent(10);
    expect(recent.length).toBeGreaterThanOrEqual(1);
    expect(recent[0]?.actor.username).toBe('clinician_1');
  });

  it('should list system roles from role repository', async () => {
    const roles = await roleRepo.listAll();
    expect(roles.length).toBe(4);
    const names = roles.map((r) => r.name);
    expect(names).toContain(RoleName.OWNER);
    expect(names).toContain(RoleName.DEVELOPER);
  });

  it('should manage application state and initialization flag', async () => {
    expect(await stateRepo.isInitialized()).toBe(false);

    await stateRepo.setInitialized('owner-uuid-1');
    expect(await stateRepo.isInitialized()).toBe(true);

    const ownerId = await stateRepo.get('system.initial_owner_id');
    expect(ownerId).toBe('owner-uuid-1');
  });
});
