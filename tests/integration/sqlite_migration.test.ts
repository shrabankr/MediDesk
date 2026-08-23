import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { SqliteDatabase, MigrationRunner } from '@medidesk/database';

describe('SQLite Database & MigrationRunner Integration', () => {
  let testDbPath: string;
  let testDir: string;
  let db: SqliteDatabase;
  let runner: MigrationRunner;

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'medidesk-migration-test-'));
    testDbPath = path.join(testDir, 'test.sqlite');
    db = new SqliteDatabase({ databasePath: testDbPath });
    const migrationsDir = path.resolve(__dirname, '../../database/migrations');
    runner = new MigrationRunner(db, migrationsDir);
  });

  afterEach(() => {
    db.close();
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('should enable foreign key constraints and WAL journal mode', () => {
    const raw = db.getRawDb();
    const fkPragma = raw.pragma('foreign_keys', { simple: true });
    const journalPragma = raw.pragma('journal_mode', { simple: true });

    expect(fkPragma).toBe(1);
    expect(journalPragma).toBe('wal');
  });

  it('should run 001_initial_schema migration and seed foundational roles/permissions', () => {
    const applied = runner.runPendingMigrations();
    expect(applied).toBe(1);

    const history = runner.getAppliedMigrations();
    expect(history.length).toBe(1);
    expect(history[0]?.version).toBe('001');

    // Verify tables exist
    const raw = db.getRawDb();
    const tables = raw
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all() as Array<{ name: string }>;
    const tableNames = tables.map((t) => t.name);

    expect(tableNames).toContain('organizations');
    expect(tableNames).toContain('users');
    expect(tableNames).toContain('roles');
    expect(tableNames).toContain('permissions');
    expect(tableNames).toContain('user_roles');
    expect(tableNames).toContain('role_permissions');
    expect(tableNames).toContain('audit_events');
    expect(tableNames).toContain('application_state');

    // Verify seeded roles
    const roles = raw.prepare('SELECT name FROM roles ORDER BY name ASC').all() as Array<{ name: string }>;
    const roleNames = roles.map((r) => r.name);
    expect(roleNames).toEqual(['DEVELOPER', 'DOCTOR', 'OWNER', 'STAFF']);

    // Re-running should apply 0 additional migrations (idempotent)
    const secondRun = runner.runPendingMigrations();
    expect(secondRun).toBe(0);
  });
});
