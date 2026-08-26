-- ============================================================
-- MEDIDESK DATABASE MIGRATION 008: PHASE 8 FEATURES
-- Multi-tier packaging, Smart Alerts, Dashboard Preferences,
-- and Automated Backup Scheduling
-- ============================================================

-- 1. Product Packaging Units Table (Integer Paise Financials)
CREATE TABLE IF NOT EXISTS product_packaging_units (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    unit_name TEXT NOT NULL COLLATE NOCASE, -- BOX, STRIP, BOTTLE, PACK, VIAL, CASE, CARTON
    conversion_factor INTEGER NOT NULL, -- Number of indivisible base units (e.g. 10, 100)
    sale_price_paise INTEGER NOT NULL, -- Package sale price in integer Paise
    mrp_paise INTEGER NOT NULL, -- Package MRP in integer Paise
    barcode TEXT,
    is_default_sale_unit INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES medicine_products(id) ON DELETE CASCADE,
    CONSTRAINT chk_pkg_conversion CHECK (conversion_factor >= 1),
    CONSTRAINT chk_pkg_prices CHECK (sale_price_paise >= 0 AND mrp_paise >= 0)
);

CREATE INDEX IF NOT EXISTS idx_packaging_product ON product_packaging_units(product_id);
CREATE INDEX IF NOT EXISTS idx_packaging_barcode ON product_packaging_units(organization_id, barcode);
CREATE UNIQUE INDEX IF NOT EXISTS idx_packaging_prod_unit ON product_packaging_units(product_id, unit_name);

-- 2. System Alerts Table
CREATE TABLE IF NOT EXISTS system_alerts (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    alert_type TEXT NOT NULL, -- LOW_STOCK, NEAR_EXPIRY, BACKUP_FAILED, etc.
    category TEXT NOT NULL, -- INVENTORY, SALES, CLINICAL, SYSTEM
    severity TEXT NOT NULL, -- INFO, WARNING, CRITICAL, MANDATORY_SAFETY
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    entity_type TEXT, -- PRODUCT, BATCH, VISIT, BACKUP, LICENSE, TRANSACTION
    entity_id TEXT,
    dedup_key TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, ACKNOWLEDGED, RESOLVED
    metadata_json TEXT, -- Structured key-value data
    acknowledged_by TEXT,
    acknowledged_at DATETIME,
    snooze_until DATETIME,
    resolved_at DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (acknowledged_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_alerts_org_status ON system_alerts(organization_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_alerts_dedup ON system_alerts(organization_id, dedup_key);

-- 3. Alert Configurations Table
CREATE TABLE IF NOT EXISTS alert_configurations (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    alert_type TEXT NOT NULL,
    is_enabled INTEGER NOT NULL DEFAULT 1,
    threshold_value_integer INTEGER, -- Integer threshold (e.g. Days, Base Units, Paise)
    warning_level TEXT NOT NULL DEFAULT 'WARNING',
    target_roles TEXT NOT NULL, -- JSON Array: ["OWNER", "STAFF"]
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    UNIQUE(organization_id, alert_type)
);

-- 4. User Dashboard Preferences Table
CREATE TABLE IF NOT EXISTS user_dashboard_preferences (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    organization_id TEXT NOT NULL,
    widget_layout_json TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    UNIQUE(user_id)
);

-- 5. Scheduled Backup Configurations Table
CREATE TABLE IF NOT EXISTS scheduled_backup_configs (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    is_enabled INTEGER NOT NULL DEFAULT 0,
    frequency TEXT NOT NULL DEFAULT 'DAILY', -- DAILY, WEEKLY, MONTHLY
    backup_time TEXT NOT NULL DEFAULT '22:00', -- HH:MM
    local_backup_enabled INTEGER NOT NULL DEFAULT 1,
    cloud_backup_enabled INTEGER NOT NULL DEFAULT 0,
    retention_days_local INTEGER NOT NULL DEFAULT 30,
    retention_days_cloud INTEGER NOT NULL DEFAULT 90,
    last_run_at DATETIME,
    last_run_status TEXT, -- SUCCESS, PARTIAL_LOCAL_ONLY, FAILED
    last_run_message TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    UNIQUE(organization_id)
);

-- ============================================================
-- SEED PHASE 8 PERMISSIONS
-- ============================================================

INSERT OR IGNORE INTO permissions (id, code, name, category, description) VALUES
('perm-alt-r', 'alert.read', 'Read Alerts', 'Operations', 'View system, clinical and operational notifications'),
('perm-alt-m', 'alert.manage', 'Manage Alert Policies', 'Administration', 'Configure notification thresholds and policies'),
('perm-alt-a', 'alert.acknowledge', 'Acknowledge Alerts', 'Operations', 'Acknowledge and snooze active notifications'),
('perm-dsh-m', 'dashboard.manage', 'Manage Dashboard', 'Operations', 'Customize role dashboard widget layouts'),
('perm-pkg-m', 'packaging.manage', 'Manage Packaging Units', 'Pharmacy', 'Define multi-tier product packaging conversions'),
('perm-bkp-s', 'backup.schedule', 'Manage Backup Schedule', 'Administration', 'Configure automated background backup schedule'),
('perm-doc-d', 'document.dispatch', 'Dispatch Documents', 'Operations', 'Export PDF and dispatch patient documents with consent');

-- Role Permissions: OWNER
INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES
('role-owner', 'perm-alt-r'),
('role-owner', 'perm-alt-m'),
('role-owner', 'perm-alt-a'),
('role-owner', 'perm-dsh-m'),
('role-owner', 'perm-pkg-m'),
('role-owner', 'perm-bkp-s'),
('role-owner', 'perm-doc-d');

-- Role Permissions: DOCTOR
INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES
('role-doctor', 'perm-alt-r'),
('role-doctor', 'perm-alt-a'),
('role-doctor', 'perm-dsh-m'),
('role-doctor', 'perm-doc-d');

-- Role Permissions: STAFF
INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES
('role-staff', 'perm-alt-r'),
('role-staff', 'perm-alt-a'),
('role-staff', 'perm-dsh-m'),
('role-staff', 'perm-pkg-m'),
('role-staff', 'perm-doc-d');

-- Role Permissions: DEVELOPER (Technical / System Alerts ONLY, Zero Clinical/Financial Permissions)
INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES
('role-developer', 'perm-alt-r'),
('role-developer', 'perm-alt-a');
