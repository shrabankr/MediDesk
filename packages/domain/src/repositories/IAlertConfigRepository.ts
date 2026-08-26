import { AlertConfiguration, UpdateAlertConfigurationDTO } from '../entities/Alert.js';

export interface IAlertConfigRepository {
  findByOrg(organizationId: string): Promise<AlertConfiguration[]>;
  findByType(organizationId: string, alertType: string): Promise<AlertConfiguration | null>;
  upsert(organizationId: string, alertType: string, dto: UpdateAlertConfigurationDTO): Promise<AlertConfiguration>;
}
