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

  it('should run migrations and seed foundational roles, permissions, and Phase 6/7 schema', () => {
    const applied = runner.runPendingMigrations();
    expect(applied).toBe(8);

    const history = runner.getAppliedMigrations();
    expect(history.length).toBe(8);
    expect(history[0]?.version).toBe('001');
    expect(history[1]?.version).toBe('002');
    expect(history[2]?.version).toBe('003');
    expect(history[3]?.version).toBe('004');
    expect(history[4]?.version).toBe('005');
    expect(history[5]?.version).toBe('006');
    expect(history[6]?.version).toBe('007');
    expect(history[7]?.version).toBe('008');

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
    expect(tableNames).toContain('patients');
    expect(tableNames).toContain('doctors');
    expect(tableNames).toContain('doctor_schedules');
    expect(tableNames).toContain('appointments');

    // Phase 4 Tables
    expect(tableNames).toContain('clinical_visits');
    expect(tableNames).toContain('vitals');
    expect(tableNames).toContain('allergies');
    expect(tableNames).toContain('medical_history');
    expect(tableNames).toContain('diagnoses');
    expect(tableNames).toContain('prescriptions');
    expect(tableNames).toContain('prescription_versions');
    expect(tableNames).toContain('prescription_items');
    expect(tableNames).toContain('follow_ups');
    expect(tableNames).toContain('clinical_corrections');

    // Phase 5 Tables
    expect(tableNames).toContain('medicines');
    expect(tableNames).toContain('manufacturers');
    expect(tableNames).toContain('medicine_products');
    expect(tableNames).toContain('suppliers');
    expect(tableNames).toContain('inventory_batches');
    expect(tableNames).toContain('stock_movements');
    expect(tableNames).toContain('purchases');
    expect(tableNames).toContain('purchase_items');
    expect(tableNames).toContain('sales');
    expect(tableNames).toContain('sale_items');
    expect(tableNames).toContain('sale_returns');
    expect(tableNames).toContain('sale_return_items');
    expect(tableNames).toContain('tax_rules');
    expect(tableNames).toContain('backup_settings');

    // Phase 7 Tables
    expect(tableNames).toContain('lan_devices');
    expect(tableNames).toContain('lan_pairing_pins');
    expect(tableNames).toContain('lan_server_config');

    // Phase 8 Tables
    expect(tableNames).toContain('product_packaging_units');
    expect(tableNames).toContain('system_alerts');
    expect(tableNames).toContain('alert_configurations');
    expect(tableNames).toContain('user_dashboard_preferences');
    expect(tableNames).toContain('scheduled_backup_configs');

    // Verify seeded roles
    const roles = raw.prepare('SELECT name FROM roles ORDER BY name ASC').all() as Array<{ name: string }>;
    const roleNames = roles.map((r) => r.name);
    expect(roleNames).toEqual(['DEVELOPER', 'DOCTOR', 'OWNER', 'STAFF']);

    // Re-running should apply 0 additional migrations (idempotent)
    const secondRun = runner.runPendingMigrations();
    expect(secondRun).toBe(0);
  });
});
