-- MediDesk Phase 6 Hybrid Backup Schema Migration
-- Migration: 006_hybrid_backup_settings.sql

-- 1. Create Backup Settings Table
CREATE TABLE IF NOT EXISTS backup_settings (
    organization_id TEXT PRIMARY KEY,
    backup_mode TEXT NOT NULL DEFAULT 'HYBRID', -- LOCAL_ONLY, HYBRID, CLOUD_ONLY
    backup_schedule TEXT NOT NULL DEFAULT 'DAILY', -- DAILY, HOURLY, MANUAL
    backup_time TEXT NOT NULL DEFAULT '21:00',
    local_retention_days INTEGER NOT NULL DEFAULT 30,
    cloud_retention_days INTEGER NOT NULL DEFAULT 90,
    google_drive_folder TEXT NOT NULL DEFAULT 'MediDesk_Backups',
    google_drive_connected INTEGER NOT NULL DEFAULT 0,
    google_drive_account_email TEXT,
    google_drive_token_enc TEXT,
    auto_retry_cloud INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

-- 2. Additive columns for backup_logs if they do not already exist
-- (SQLite supports ADD COLUMN safely)
-- Note: In new installations, table was created in 005. We alter to add hybrid status tracking.
-- Using PRAGMA table_info checks or idempotent ALTER TABLE scripts:
-- SQLite 3.35+ supports ALTER TABLE ADD COLUMN

ALTER TABLE backup_logs ADD COLUMN backup_mode TEXT DEFAULT 'HYBRID';
ALTER TABLE backup_logs ADD COLUMN local_status TEXT DEFAULT 'SUCCESS';
ALTER TABLE backup_logs ADD COLUMN cloud_status TEXT DEFAULT 'NONE';
ALTER TABLE backup_logs ADD COLUMN overall_status TEXT DEFAULT 'LOCAL_SUCCESS';
ALTER TABLE backup_logs ADD COLUMN encryption_version TEXT DEFAULT 'AES-256-GCM-SCRYPT-V1';
ALTER TABLE backup_logs ADD COLUMN app_version TEXT DEFAULT '1.0.0';
ALTER TABLE backup_logs ADD COLUMN schema_version TEXT DEFAULT '006';
ALTER TABLE backup_logs ADD COLUMN error_message TEXT;

CREATE INDEX IF NOT EXISTS idx_backup_logs_cloud ON backup_logs(cloud_status);
CREATE INDEX IF NOT EXISTS idx_backup_logs_overall ON backup_logs(overall_status);
