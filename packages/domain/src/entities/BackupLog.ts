export type BackupType = 'MANUAL' | 'SCHEDULED' | 'PRE_RESTORE_SAFETY';
export type StorageTarget = 'LOCAL' | 'GOOGLE_DRIVE' | 'HYBRID';
export type BackupMode = 'LOCAL_ONLY' | 'HYBRID' | 'CLOUD_ONLY';

export type OverallBackupStatus =
  | 'STARTED'
  | 'VERIFYING'
  | 'LOCAL_SUCCESS'
  | 'CLOUD_PENDING'
  | 'CLOUD_UPLOADING'
  | 'CLOUD_SUCCESS'
  | 'PARTIAL'
  | 'FAILED'
  | 'RESTORE_PENDING'
  | 'RESTORING'
  | 'RESTORE_SUCCESS'
  | 'RESTORE_FAILED';

export type LocalBackupStatus = 'PENDING' | 'SUCCESS' | 'FAILED';
export type CloudBackupStatus = 'NONE' | 'PENDING' | 'UPLOADING' | 'SUCCESS' | 'FAILED';

export interface BackupLog {
  id: string;
  organizationId: string;
  filename: string;
  filePath: string;
  sizeBytes: number;
  sha256Checksum: string;
  backupType: BackupType;
  storageTarget: StorageTarget;
  backupMode: BackupMode;
  localStatus: LocalBackupStatus;
  cloudStatus: CloudBackupStatus;
  overallStatus: OverallBackupStatus;
  remoteFileId?: string;
  isVerified: boolean;
  encryptionVersion?: string;
  appVersion?: string;
  schemaVersion?: string;
  errorMessage?: string;
  status: 'COMPLETED' | 'FAILED' | 'RESTORED' | OverallBackupStatus;
  createdAt: Date;
  createdBy?: string;
}

export interface BackupSettings {
  organizationId: string;
  backupMode: BackupMode;
  backupSchedule: 'DAILY' | 'HOURLY' | 'MANUAL';
  backupTime: string; // e.g. '21:00'
  localRetentionDays: number;
  cloudRetentionDays: number;
  googleDriveFolder: string;
  googleDriveConnected: boolean;
  googleDriveAccountEmail?: string;
  googleDriveTokenEnc?: string;
  autoRetryCloud: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateBackupLogDTO {
  id?: string;
  organizationId: string;
  filename: string;
  filePath: string;
  sizeBytes: number;
  sha256Checksum: string;
  backupType?: BackupType;
  storageTarget?: StorageTarget;
  backupMode?: BackupMode;
  localStatus?: LocalBackupStatus;
  cloudStatus?: CloudBackupStatus;
  overallStatus?: OverallBackupStatus;
  remoteFileId?: string;
  isVerified?: boolean;
  encryptionVersion?: string;
  appVersion?: string;
  schemaVersion?: string;
  errorMessage?: string;
  status?: 'COMPLETED' | 'FAILED' | 'RESTORED' | OverallBackupStatus;
  createdBy?: string;
}

export interface UpdateBackupLogDTO {
  remoteFileId?: string;
  localStatus?: LocalBackupStatus;
  cloudStatus?: CloudBackupStatus;
  overallStatus?: OverallBackupStatus;
  isVerified?: boolean;
  errorMessage?: string;
  status?: 'COMPLETED' | 'FAILED' | 'RESTORED' | OverallBackupStatus;
}
