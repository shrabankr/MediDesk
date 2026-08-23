-- MediDesk Phase 1 Initial Schema Migration
-- Migration: 001_initial_schema.sql

-- 1. Organizations
CREATE TABLE IF NOT EXISTS organizations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    address TEXT,
    phone TEXT,
    email TEXT,
    currency TEXT NOT NULL DEFAULT 'INR',
    timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_organizations_code ON organizations(code);

-- 2. Roles
CREATE TABLE IF NOT EXISTS roles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL,
    is_system INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. Permissions
CREATE TABLE IF NOT EXISTS permissions (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_permissions_code ON permissions(code);
CREATE INDEX IF NOT EXISTS idx_permissions_category ON permissions(category);

-- 4. Role Permissions (Many-to-Many)
CREATE TABLE IF NOT EXISTS role_permissions (
    role_id TEXT NOT NULL,
    permission_id TEXT NOT NULL,
    PRIMARY KEY (role_id, permission_id),
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
    FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
);

-- 5. Users
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    full_name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    is_locked INTEGER NOT NULL DEFAULT 0,
    failed_login_attempts INTEGER NOT NULL DEFAULT 0,
    last_login_at DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_users_org ON users(organization_id);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- 6. User Roles (Many-to-Many)
CREATE TABLE IF NOT EXISTS user_roles (
    user_id TEXT NOT NULL,
    role_id TEXT NOT NULL,
    PRIMARY KEY (user_id, role_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
);

-- 7. Audit Events
CREATE TABLE IF NOT EXISTS audit_events (
    id TEXT PRIMARY KEY,
    action TEXT NOT NULL,
    actor_id TEXT NOT NULL,
    actor_username TEXT NOT NULL,
    actor_role TEXT,
    actor_ip TEXT,
    target TEXT,
    result TEXT NOT NULL,
    reason TEXT,
    metadata TEXT,
    timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_events_action ON audit_events(action);
CREATE INDEX IF NOT EXISTS idx_audit_events_actor ON audit_events(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_timestamp ON audit_events(timestamp DESC);

-- 8. Application State
CREATE TABLE IF NOT EXISTS application_state (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- SEED FOUNDATION DATA
-- ============================================================

-- Seed Roles
INSERT OR IGNORE INTO roles (id, name, description, is_system) VALUES
('role-owner', 'OWNER', 'Clinic Owner / Business Authority with user management and clinical administration rights', 1),
('role-doctor', 'DOCTOR', 'Medical Practitioner with clinical, diagnosis, and prescription rights', 1),
('role-staff', 'STAFF', 'Clinic Staff / Reception / Pharmacy dispensing and operational rights', 1),
('role-developer', 'DEVELOPER', 'Technical Authority with system administration, diagnostic, and backup rights only (no clinical/financial bypass)', 1);

-- Seed Granular Permissions
INSERT OR IGNORE INTO permissions (id, code, name, category, description) VALUES
-- System & Diagnostics (Developer)
('perm-sys-diag', 'system.diagnostics', 'System Diagnostics', 'System', 'Execute system health checks and technical diagnostics'),
('perm-sys-cfg-r', 'system.config.read', 'Read System Config', 'System', 'Read technical configuration parameters'),
('perm-sys-cfg-u', 'system.config.update', 'Update System Config', 'System', 'Update technical configuration parameters'),
('perm-sys-mig', 'system.migrate', 'Run Migrations', 'System', 'Execute database schema migrations'),
('perm-sys-bkp', 'system.backup.local', 'Create Local Backup', 'System', 'Create local database backup snapshot'),

-- Administration (Owner)
('perm-org-mgt', 'org.manage', 'Manage Organization', 'Administration', 'Configure clinic details and business settings'),
('perm-usr-c', 'user.create', 'Create Users', 'Administration', 'Create new clinic user accounts'),
('perm-usr-r', 'user.read', 'Read Users', 'Administration', 'View list of clinic users and profiles'),
('perm-usr-u', 'user.update', 'Update Users', 'Administration', 'Update user profiles and details'),
('perm-usr-d', 'user.disable', 'Disable Users', 'Administration', 'Deactivate or lock user accounts'),
('perm-role-a', 'role.assign', 'Assign Roles', 'Administration', 'Assign system roles to user accounts'),
('perm-aud-r', 'audit.read', 'Read Audit Logs', 'Administration', 'Review system and security audit logs'),

-- Clinical (Doctor)
('perm-pat-r', 'patient.read', 'Read Patient Records', 'Clinical', 'View patient demographics and records'),
('perm-pat-c', 'patient.create', 'Create Patient', 'Clinical', 'Register a new patient'),
('perm-pat-u', 'patient.update', 'Update Patient', 'Clinical', 'Update patient demographic data'),
('perm-rx-r', 'prescription.read', 'Read Prescriptions', 'Clinical', 'View patient prescriptions'),
('perm-rx-c', 'prescription.create', 'Create Prescription', 'Clinical', 'Generate and sign patient prescriptions'),
('perm-rx-p', 'prescription.print', 'Print Prescription', 'Clinical', 'Print patient prescriptions'),

-- Pharmacy & Operations (Staff)
('perm-inv-r', 'inventory.read', 'Read Inventory', 'Pharmacy', 'View drug inventory stock levels'),
('perm-inv-a', 'inventory.adjust', 'Adjust Inventory', 'Pharmacy', 'Adjust drug stock quantities'),
('perm-sal-c', 'sale.create', 'Create POS Sale', 'Pharmacy', 'Process pharmacy sales and billing'),
('perm-rep-r', 'report.read', 'Read Reports', 'Operations', 'View operational and financial reports');

-- Seed Role Permissions for OWNER
INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES
('role-owner', 'perm-org-mgt'),
('role-owner', 'perm-usr-c'),
('role-owner', 'perm-usr-r'),
('role-owner', 'perm-usr-u'),
('role-owner', 'perm-usr-d'),
('role-owner', 'perm-role-a'),
('role-owner', 'perm-aud-r'),
('role-owner', 'perm-pat-r'),
('role-owner', 'perm-pat-c'),
('role-owner', 'perm-pat-u'),
('role-owner', 'perm-rx-r'),
('role-owner', 'perm-rx-c'),
('role-owner', 'perm-rx-p'),
('role-owner', 'perm-inv-r'),
('role-owner', 'perm-inv-a'),
('role-owner', 'perm-sal-c'),
('role-owner', 'perm-rep-r'),
('role-owner', 'perm-sys-bkp');

-- Seed Role Permissions for DOCTOR
INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES
('role-doctor', 'perm-usr-r'),
('role-doctor', 'perm-pat-r'),
('role-doctor', 'perm-pat-c'),
('role-doctor', 'perm-pat-u'),
('role-doctor', 'perm-rx-r'),
('role-doctor', 'perm-rx-c'),
('role-doctor', 'perm-rx-p'),
('role-doctor', 'perm-inv-r'),
('role-doctor', 'perm-rep-r');

-- Seed Role Permissions for STAFF
INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES
('role-staff', 'perm-usr-r'),
('role-staff', 'perm-pat-r'),
('role-staff', 'perm-pat-c'),
('role-staff', 'perm-pat-u'),
('role-staff', 'perm-rx-r'),
('role-staff', 'perm-rx-p'),
('role-staff', 'perm-inv-r'),
('role-staff', 'perm-inv-a'),
('role-staff', 'perm-sal-c'),
('role-staff', 'perm-rep-r');

-- Seed Role Permissions for DEVELOPER (Technical ONLY - NO clinical/patient/sales access)
INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES
('role-developer', 'perm-sys-diag'),
('role-developer', 'perm-sys-cfg-r'),
('role-developer', 'perm-sys-cfg-u'),
('role-developer', 'perm-sys-mig'),
('role-developer', 'perm-sys-bkp');
