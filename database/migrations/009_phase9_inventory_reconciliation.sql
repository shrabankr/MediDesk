-- ============================================================
-- MEDIDESK DATABASE MIGRATION 009: PHASE 9A INVENTORY RECONCILIATION
-- Physical Stock Count & Variance Audit Reconciliation
-- ============================================================

-- 1. Stock Reconciliation Sessions Table
CREATE TABLE IF NOT EXISTS stock_reconciliation_sessions (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    session_number TEXT NOT NULL, -- e.g. REC-20260826-0001
    status TEXT NOT NULL DEFAULT 'DRAFT', -- DRAFT, COUNTED, SUBMITTED, APPROVED, REJECTED, POSTED
    notes TEXT,
    counted_by TEXT NOT NULL,
    counted_at DATETIME,
    submitted_by TEXT,
    submitted_at DATETIME,
    reviewed_by TEXT,
    reviewed_at DATETIME,
    review_notes TEXT,
    posted_at DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (counted_by) REFERENCES users(id) ON DELETE RESTRICT,
    FOREIGN KEY (submitted_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_reconciliation_org_status ON stock_reconciliation_sessions(organization_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_reconciliation_session_num ON stock_reconciliation_sessions(organization_id, session_number);

-- 2. Stock Reconciliation Items Table
CREATE TABLE IF NOT EXISTS stock_reconciliation_items (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    organization_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    batch_id TEXT NOT NULL,
    system_stock_quantity INTEGER NOT NULL, -- System count at physical count time (base units)
    physical_stock_quantity INTEGER NOT NULL, -- Physical count in base units
    variance_quantity INTEGER NOT NULL, -- physical - system (base units)
    variance_reason TEXT NOT NULL DEFAULT 'AUDIT_CORRECTION', -- DAMAGE, EXPIRY_DISPOSAL, SHRINKAGE, AUDIT_CORRECTION, OTHER
    notes TEXT,
    packaging_unit_name TEXT, -- Unit name used by staff for counting (e.g. STRIP, BOX, TABLET)
    packaging_unit_quantity INTEGER, -- Package quantity entered before conversion
    is_large_variance INTEGER NOT NULL DEFAULT 0, -- 1 if absolute delta exceeds threshold
    posted_stock_movement_id TEXT, -- Link to compensating StockMovement record once posted
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES stock_reconciliation_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES medicine_products(id) ON DELETE RESTRICT,
    FOREIGN KEY (batch_id) REFERENCES inventory_batches(id) ON DELETE RESTRICT,
    FOREIGN KEY (posted_stock_movement_id) REFERENCES stock_movements(id) ON DELETE SET NULL,
    CONSTRAINT chk_physical_qty CHECK (physical_stock_quantity >= 0)
);

CREATE INDEX IF NOT EXISTS idx_reconcil_items_session ON stock_reconciliation_items(session_id);
CREATE INDEX IF NOT EXISTS idx_reconcil_items_batch ON stock_reconciliation_items(batch_id);
CREATE INDEX IF NOT EXISTS idx_reconcil_items_org ON stock_reconciliation_items(organization_id);

-- 3. Seed Phase 9A Permissions
INSERT OR IGNORE INTO permissions (id, code, name, category, description) VALUES
('perm-rec-r', 'reconciliation.read', 'Read Reconciliations', 'Pharmacy', 'View physical stock count sessions and reconciliation audits'),
('perm-rec-c', 'reconciliation.create', 'Create Reconciliations', 'Pharmacy', 'Create and record physical stock counts'),
('perm-rec-s', 'reconciliation.submit', 'Submit Reconciliations', 'Pharmacy', 'Submit physical stock count sessions for review'),
('perm-rec-a', 'reconciliation.approve', 'Approve Reconciliations', 'Administration', 'Approve physical stock count variances and adjustments'),
('perm-rec-j', 'reconciliation.reject', 'Reject Reconciliations', 'Administration', 'Reject physical stock count sessions'),
('perm-rec-p', 'reconciliation.post', 'Post Reconciliations', 'Administration', 'Post approved stock reconciliations to inventory ledger');

-- 4. Map Permissions to Roles
-- Role Permissions: OWNER
INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES
('role-owner', 'perm-rec-r'),
('role-owner', 'perm-rec-c'),
('role-owner', 'perm-rec-s'),
('role-owner', 'perm-rec-a'),
('role-owner', 'perm-rec-j'),
('role-owner', 'perm-rec-p');

-- Role Permissions: STAFF
INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES
('role-staff', 'perm-rec-r'),
('role-staff', 'perm-rec-c'),
('role-staff', 'perm-rec-s');

-- Role Permissions: DOCTOR
INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES
('role-doctor', 'perm-rec-r');
