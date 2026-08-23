import {
  IApplicationStateRepository,
  ApplicationStateKeys
} from '@medidesk/domain';
import { SqliteDatabase } from '../SqliteDatabase.js';

interface StateRow {
  key: string;
  value: string;
  updated_at: string;
}

export class SqliteApplicationStateRepository implements IApplicationStateRepository {
  private db: SqliteDatabase;

  constructor(db: SqliteDatabase) {
    this.db = db;
  }

  public async get(key: string): Promise<string | null> {
    const raw = this.db.getRawDb();
    try {
      const row = raw.prepare('SELECT value FROM application_state WHERE key = ?').get(key) as StateRow | undefined;
      return row ? row.value : null;
    } catch (error: any) {
      if (error?.message?.includes('no such table')) {
        return null;
      }
      throw error;
    }
  }

  public async set(key: string, value: string): Promise<void> {
    const raw = this.db.getRawDb();
    const now = new Date().toISOString();
    raw.prepare(`
      INSERT INTO application_state (key, value, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `).run(key, value, now);
  }

  public async isInitialized(): Promise<boolean> {
    const value = await this.get(ApplicationStateKeys.INITIALIZED);
    return value === 'true';
  }

  public async setInitialized(initialOwnerId: string): Promise<void> {
    const now = new Date().toISOString();
    this.db.transaction(() => {
      this.set(ApplicationStateKeys.INITIALIZED, 'true');
      this.set(ApplicationStateKeys.INITIALIZED_AT, now);
      this.set(ApplicationStateKeys.INITIAL_OWNER_ID, initialOwnerId);
    });
  }
}
