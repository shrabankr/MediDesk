export type AlertCategory = 'INVENTORY' | 'SALES' | 'CLINICAL' | 'SYSTEM';
export type AlertSeverity = 'INFO' | 'WARNING' | 'CRITICAL' | 'MANDATORY_SAFETY';
export type AlertStatus = 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED';
export type AlertEntityType = 'PRODUCT' | 'BATCH' | 'VISIT' | 'BACKUP' | 'LICENSE' | 'TRANSACTION' | 'HARDWARE';

export interface SystemAlert {
  id: string;
  organizationId: string;
  alertType: string;
  category: AlertCategory;
  severity: AlertSeverity;
  title: string;
  message: string;
  entityType?: AlertEntityType;
  entityId?: string;
  dedupKey: string;
  status: AlertStatus;
  metadata?: Record<string, any>;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
  snoozeUntil?: Date;
  resolvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateSystemAlertDTO {
  id?: string;
  organizationId: string;
  alertType: string;
  category: AlertCategory;
  severity: AlertSeverity;
  title: string;
  message: string;
  entityType?: AlertEntityType;
  entityId?: string;
  dedupKey?: string;
  metadata?: Record<string, any>;
}

export interface AlertConfiguration {
  id: string;
  organizationId: string;
  alertType: string;
  isEnabled: boolean;
  thresholdValueInteger?: number; // Integer (e.g., days, units, paise)
  warningLevel: AlertSeverity;
  targetRoles: string[]; // e.g. ["OWNER", "STAFF"]
  createdAt: Date;
  updatedAt: Date;
}

export interface UpdateAlertConfigurationDTO {
  isEnabled?: boolean;
  thresholdValueInteger?: number;
  warningLevel?: AlertSeverity;
  targetRoles?: string[];
}
