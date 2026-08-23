import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { SqliteDatabase } from '../SqliteDatabase.js';
import { Logger } from '@medidesk/shared';

export interface MigrationRecord {
  id: number;
  version: string;
  name: string;
  checksum: string;
  appliedAt: string;
}

export class MigrationRunner {
  private db: SqliteDatabase;
  private migrationsDir: string;
  private logger: Logger;

  constructor(db: SqliteDatabase, migrationsDir?: string) {
    this.db = db;
    this.logger = new Logger('MigrationRunner');
    this.migrationsDir =
      migrationsDir || path.resolve(process.cwd(), 'database', 'migrations');
  }

  public initMigrationTable(): void {
    const raw = this.db.getRawDb();
    raw.exec(`
      CREATE TABLE IF NOT EXISTS _schema_migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        version TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        checksum TEXT NOT NULL,
        applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }

  public getAppliedMigrations(): MigrationRecord[] {
    this.initMigrationTable();
    const raw = this.db.getRawDb();
    const rows = raw.prepare(`
      SELECT id, version, name, checksum, applied_at as appliedAt
      FROM _schema_migrations
      ORDER BY id ASC
    `).all() as MigrationRecord[];
    return rows;
  }

  public runPendingMigrations(): number {
    this.initMigrationTable();
    const applied = this.getAppliedMigrations();
    const appliedVersions = new Set(applied.map((m) => m.version));

    if (!fs.existsSync(this.migrationsDir)) {
      this.logger.warn(`Migrations directory does not exist: ${this.migrationsDir}`);
      return 0;
    }

    const files = fs
      .readdirSync(this.migrationsDir)
      .filter((file) => file.endsWith('.sql'))
      .sort();

    let count = 0;
    for (const file of files) {
      const match = file.match(/^(\d+)_(.+)\.sql$/);
      if (!match) {
        this.logger.warn(`Skipping invalid migration filename format: ${file}`);
        continue;
      }

      const [, version, name] = match;
      if (!version || !name) continue;

      if (appliedVersions.has(version)) {
        continue;
      }

      const filePath = path.join(this.migrationsDir, file);
      const sqlContent = fs.readFileSync(filePath, 'utf-8');
      const checksum = crypto.createHash('sha256').update(sqlContent).digest('hex');

      this.logger.info(`Applying migration: ${file} (v${version})`);

      this.db.transaction(() => {
        const raw = this.db.getRawDb();
        raw.exec(sqlContent);
        raw.prepare(`
          INSERT INTO _schema_migrations (version, name, checksum)
          VALUES (?, ?, ?)
        `).run(version, name, checksum);
      });

      this.logger.info(`Successfully applied migration: ${file}`);
      count++;
    }

    return count;
  }
}
