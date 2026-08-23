import Database, { Database as DatabaseType } from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { Logger } from '@medidesk/shared';

export interface SqliteConfig {
  databasePath: string;
  readonly?: boolean;
  verbose?: boolean;
}

export class SqliteDatabase {
  private db: DatabaseType | null = null;
  private logger: Logger;
  private databasePath: string;

  constructor(config: SqliteConfig) {
    this.databasePath = config.databasePath;
    this.logger = new Logger('SqliteDatabase');

    // Ensure data directory exists
    const dir = path.dirname(this.databasePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.connect(config);
  }

  private connect(config: SqliteConfig): void {
    try {
      this.logger.info(`Opening SQLite database at: ${this.databasePath}`);
      this.db = new Database(this.databasePath, {
        readonly: config.readonly ?? false,
        verbose: config.verbose ? (msg) => this.logger.debug(String(msg)) : undefined
      });

      // Crucial SQLite Pragmas
      this.db.pragma('foreign_keys = ON');
      this.db.pragma('journal_mode = WAL');
      this.db.pragma('synchronous = NORMAL');
      this.db.pragma('busy_timeout = 5000');

      this.logger.info('SQLite database opened successfully with foreign keys and WAL enabled');
    } catch (error) {
      this.logger.error('Failed to open SQLite database', error);
      throw error;
    }
  }

  public getRawDb(): DatabaseType {
    if (!this.db) {
      throw new Error('Database is not connected');
    }
    return this.db;
  }

  public getDatabasePath(): string {
    return this.databasePath;
  }

  public isConnected(): boolean {
    return this.db !== null && this.db.open;
  }

  public close(): void {
    if (this.db && this.db.open) {
      this.logger.info('Closing SQLite database');
      this.db.close();
      this.db = null;
    }
  }

  public transaction<T>(fn: () => T): T {
    const raw = this.getRawDb();
    return raw.transaction(fn)();
  }
}
