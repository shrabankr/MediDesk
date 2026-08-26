-- MediDesk Phase 6 System Utilities, Licensing & Backup Schema Migration
-- Migration: 005_system_licensing_backups.sql

-- 1. Backup Logs Table
CREATE TABLE IF NOT EXISTS backup_logs (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    filename TEXT NOT NULL,
    file_path TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    sha256_checksum TEXT NOT NULL,
    backup_type TEXT NOT NULL DEFAULT 'MANUAL', -- MANUAL, SCHEDULED, PRE_RESTORE_SAFETY
    storage_target TEXT NOT NULL DEFAULT 'LOCAL', -- LOCAL, GOOGLE_DRIVE, HYBRID
    remote_file_id TEXT,
    is_verified INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'COMPLETED', -- COMPLETED, FAILED, RESTORED
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_backup_logs_org ON backup_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_backup_logs_date ON backup_logs(created_at);

-- 2. License Installations Table
CREATE TABLE IF NOT EXISTS license_installations (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    installation_id TEXT NOT NULL UNIQUE,
    machine_fingerprint TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'TRIAL', -- TRIAL, ACTIVE, GRACE_PERIOD, EXPIRED, SUSPENDED, REVOKED
    trial_started_at DATETIME NOT NULL,
    trial_expires_at DATETIME NOT NULL,
    license_key TEXT,
    license_signature TEXT,
    tier TEXT NOT NULL DEFAULT 'CLINIC_STANDARD',
    features_json TEXT NOT NULL DEFAULT '["clinical","pharmacy","billing","reports","backup_local"]',
    valid_from DATETIME,
    valid_to DATETIME,
    max_doctors INTEGER NOT NULL DEFAULT 5,
    max_staff INTEGER NOT NULL DEFAULT 10,
    last_verified_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_license_org ON license_installations(organization_id);
CREATE INDEX IF NOT EXISTS idx_license_install_id ON license_installations(installation_id);

-- 3. Printer Configurations Table
CREATE TABLE IF NOT EXISTS printer_configurations (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    user_id TEXT,
    workstation_name TEXT NOT NULL DEFAULT 'DEFAULT_WORKSTATION',
    prescription_printer_name TEXT,
    prescription_page_size TEXT NOT NULL DEFAULT 'A4', -- A4, A5
    invoice_printer_name TEXT,
    receipt_printer_name TEXT,
    receipt_page_size TEXT NOT NULL DEFAULT '80mm', -- 80mm, 58mm
    silent_printing INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_printer_cfg_org ON printer_configurations(organization_id);

-- 4. Seed Phase 6 Permissions
INSERT OR IGNORE INTO permissions (id, code, name, category, description) VALUES
('perm-sys-backup-c', 'system.backup.create', 'Create Backup', 'System', 'Trigger on-demand local or cloud backup snapshot'),
('perm-sys-backup-r', 'system.backup.read', 'Read Backups', 'System', 'View backup log history and files'),
('perm-sys-restore', 'system.restore.execute', 'Restore Backup', 'System', 'Restore database from backup snapshot with safety verification'),
('perm-sys-license-r', 'system.license.read', 'Read License', 'System', 'View active license entitlements and trial status'),
('perm-sys-license-a', 'system.license.activate', 'Activate License', 'System', 'Activate cryptographic offline commercial license key'),
('perm-print-manage', 'printer.manage', 'Manage Printers', 'Operations', 'Configure clinic hardware printers and page formats');

-- Map Phase 6 Permissions to Roles
-- OWNER has all backup, restore, license activation, and printer management permissions
INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT 'role-owner', id FROM permissions WHERE code LIKE 'system.backup.%' OR code = 'system.restore.execute' OR code LIKE 'system.license.%' OR code = 'printer.manage';

-- DEVELOPER has backup creation and diagnostic rights only (NO clinical/financial access, NO customer license modification)
INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT 'role-developer', id FROM permissions WHERE code IN ('system.backup.create', 'system.backup.read', 'system.license.read');

-- STAFF has printer management permissions for their workstation
INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT 'role-staff', id FROM permissions WHERE code IN ('printer.manage', 'system.license.read');

-- DOCTOR has printer and license read permissions
INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT 'role-doctor', id FROM permissions WHERE code IN ('printer.manage', 'system.license.read');
