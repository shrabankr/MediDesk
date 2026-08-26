import { SystemAlert, CreateSystemAlertDTO } from '../entities/Alert.js';

export interface ISystemAlertRepository {
  createOrUpdate(dto: CreateSystemAlertDTO): Promise<SystemAlert>;
  findById(id: string): Promise<SystemAlert | null>;
  findByDedupKey(organizationId: string, dedupKey: string): Promise<SystemAlert | null>;
  findActive(organizationId: string, limit?: number): Promise<SystemAlert[]>;
  findByCategory(organizationId: string, category: string): Promise<SystemAlert[]>;
  acknowledge(id: string, userId: string, snoozeHours?: number): Promise<SystemAlert>;
  resolve(id: string): Promise<SystemAlert>;
  resolveByDedupKey(organizationId: string, dedupKey: string): Promise<boolean>;
  purgeOldResolved(organizationId: string, olderThanDays: number): Promise<number>;
}
