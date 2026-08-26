import type { BackupLog, CreateBackupLogDTO, UpdateBackupLogDTO } from '../entities/BackupLog.js';

export type { CreateBackupLogDTO, UpdateBackupLogDTO };

export interface IBackupLogRepository {
  create(dto: CreateBackupLogDTO): Promise<BackupLog>;
  findById(id: string, organizationId: string): Promise<BackupLog | null>;
  listByOrg(organizationId: string, limit?: number): Promise<BackupLog[]>;
  listPendingCloudBackups(organizationId: string): Promise<BackupLog[]>;
  update(id: string, dto: UpdateBackupLogDTO): Promise<void>;
  updateStatus(id: string, status: string): Promise<void>;
  delete(id: string): Promise<void>;
  count(organizationId: string): Promise<number>;
}
