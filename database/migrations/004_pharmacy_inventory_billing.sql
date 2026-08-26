-- MediDesk Phase 5: Pharmacy, Medicine Master, Inventory, Batch, Expiry, POS & Billing
-- Migration: 004_pharmacy_inventory_billing.sql

-- 1. Manufacturers Table
CREATE TABLE IF NOT EXISTS manufacturers (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    name TEXT NOT NULL,
    code TEXT,
    country TEXT NOT NULL DEFAULT 'India',
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_manufacturers_org ON manufacturers(organization_id);
CREATE INDEX IF NOT EXISTS idx_manufacturers_name ON manufacturers(organization_id, name);

-- 2. Generic Medicines Master Table
CREATE TABLE IF NOT EXISTS medicines (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    generic_name TEXT NOT NULL,
    therapeutic_class TEXT,
    is_prescription_required INTEGER NOT NULL DEFAULT 0,
    schedule_category TEXT NOT NULL DEFAULT 'GENERAL', -- GENERAL, H, H1, X
    storage_instructions TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_medicines_org ON medicines(organization_id);
CREATE INDEX IF NOT EXISTS idx_medicines_generic_name ON medicines(organization_id, generic_name);

-- 3. Medicine Products (SKU Variants) Table
CREATE TABLE IF NOT EXISTS medicine_products (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    medicine_id TEXT NOT NULL,
    manufacturer_id TEXT,
    brand_name TEXT NOT NULL,
    product_code TEXT,
    barcode TEXT,
    strength TEXT NOT NULL,
    dosage_form TEXT NOT NULL, -- TABLET, CAPSULE, SYRUP, INJECTION, DROPS, OINTMENT, INHALER, OTHER
    pack_size TEXT NOT NULL, -- e.g. '10 Tablets / Strip', '100 ml / Bottle'
    pack_quantity INTEGER NOT NULL DEFAULT 1, -- Base units per pack
    unit_of_measure TEXT NOT NULL DEFAULT 'PIECE', -- PIECE, STRIP, BOTTLE, VIAL, TUBE
    hsn_code TEXT,
    tax_rate_percent REAL NOT NULL DEFAULT 0.0,
    min_stock_level INTEGER NOT NULL DEFAULT 10,
    max_stock_level INTEGER NOT NULL DEFAULT 1000,
    reorder_quantity INTEGER NOT NULL DEFAULT 50,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT,
    updated_by TEXT,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT,
    FOREIGN KEY (medicine_id) REFERENCES medicines(id) ON DELETE RESTRICT,
    FOREIGN KEY (manufacturer_id) REFERENCES manufacturers(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_med_products_org ON medicine_products(organization_id);
CREATE INDEX IF NOT EXISTS idx_med_products_med ON medicine_products(medicine_id);
CREATE INDEX IF NOT EXISTS idx_med_products_brand ON medicine_products(organization_id, brand_name);
CREATE INDEX IF NOT EXISTS idx_med_products_barcode ON medicine_products(organization_id, barcode);

-- 4. Suppliers Master Table
CREATE TABLE IF NOT EXISTS suppliers (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    name TEXT NOT NULL,
    contact_person TEXT,
    phone TEXT,
    email TEXT,
    gstin TEXT,
    drug_license_number TEXT,
    address TEXT,
    city TEXT,
    state TEXT,
    pincode TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT,
    updated_by TEXT,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_suppliers_org ON suppliers(organization_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_name ON suppliers(organization_id, name);

-- 5. Inventory Batches Table
CREATE TABLE IF NOT EXISTS inventory_batches (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    batch_number TEXT NOT NULL,
    expiry_date TEXT NOT NULL, -- YYYY-MM-DD
    purchase_price_per_unit REAL NOT NULL,
    mrp_per_unit REAL NOT NULL,
    sale_price_per_unit REAL NOT NULL,
    current_stock_quantity INTEGER NOT NULL DEFAULT 0, -- In base units
    supplier_id TEXT,
    purchase_item_id TEXT,
    status TEXT NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, EXPIRED, DEPLETED, QUARANTINED
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT,
    FOREIGN KEY (product_id) REFERENCES medicine_products(id) ON DELETE RESTRICT,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_batches_org_prod ON inventory_batches(organization_id, product_id);
CREATE INDEX IF NOT EXISTS idx_batches_expiry ON inventory_batches(organization_id, expiry_date);
CREATE INDEX IF NOT EXISTS idx_batches_status ON inventory_batches(organization_id, status);

-- 6. Stock Movement Ledger (Append-Only)
CREATE TABLE IF NOT EXISTS stock_movements (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    batch_id TEXT NOT NULL,
    movement_type TEXT NOT NULL, -- PURCHASE, SALE, SALE_RETURN, PURCHASE_RETURN, ADJUSTMENT_IN, ADJUSTMENT_OUT, EXPIRED_DISCARD, DAMAGED_WRITE_OFF
    quantity_change INTEGER NOT NULL, -- Positive or Negative
    balance_after INTEGER NOT NULL,
    reference_type TEXT, -- PURCHASE_INVOICE, SALE_INVOICE, SALE_RETURN, STOCK_ADJUSTMENT
    reference_id TEXT,
    notes TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT NOT NULL,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT,
    FOREIGN KEY (product_id) REFERENCES medicine_products(id) ON DELETE RESTRICT,
    FOREIGN KEY (batch_id) REFERENCES inventory_batches(id) ON DELETE RESTRICT,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_org ON stock_movements(organization_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_prod ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_batch ON stock_movements(batch_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created ON stock_movements(created_at);

-- 7. Purchase Invoices Table
CREATE TABLE IF NOT EXISTS purchases (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    supplier_id TEXT NOT NULL,
    invoice_number TEXT NOT NULL,
    invoice_date TEXT NOT NULL,
    received_date TEXT NOT NULL,
    gross_amount REAL NOT NULL DEFAULT 0.0,
    discount_amount REAL NOT NULL DEFAULT 0.0,
    tax_amount REAL NOT NULL DEFAULT 0.0,
    net_total REAL NOT NULL DEFAULT 0.0,
    payment_status TEXT NOT NULL DEFAULT 'PAID', -- PAID, PENDING, PARTIAL
    status TEXT NOT NULL DEFAULT 'RECEIVED', -- RECEIVED, CANCELLED
    notes TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT NOT NULL,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE RESTRICT,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_purchases_org ON purchases(organization_id);
CREATE INDEX IF NOT EXISTS idx_purchases_supplier ON purchases(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchases_inv_no ON purchases(organization_id, invoice_number);
CREATE INDEX IF NOT EXISTS idx_purchases_date ON purchases(organization_id, invoice_date);

-- 8. Purchase Line Items Table
CREATE TABLE IF NOT EXISTS purchase_items (
    id TEXT PRIMARY KEY,
    purchase_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    batch_number TEXT NOT NULL,
    expiry_date TEXT NOT NULL,
    pack_quantity INTEGER NOT NULL,
    free_pack_quantity INTEGER NOT NULL DEFAULT 0,
    total_base_units INTEGER NOT NULL,
    purchase_rate_per_pack REAL NOT NULL,
    purchase_price_per_unit REAL NOT NULL,
    mrp_per_unit REAL NOT NULL,
    sale_price_per_unit REAL NOT NULL,
    tax_rate_percent REAL NOT NULL DEFAULT 0.0,
    tax_amount REAL NOT NULL DEFAULT 0.0,
    total_amount REAL NOT NULL,
    FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES medicine_products(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_purchase_items_purch ON purchase_items(purchase_id);
CREATE INDEX IF NOT EXISTS idx_purchase_items_prod ON purchase_items(product_id);

-- 9. Sales (POS Invoices) Table
CREATE TABLE IF NOT EXISTS sales (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    bill_number TEXT NOT NULL,
    sale_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    customer_type TEXT NOT NULL DEFAULT 'WALK_IN', -- WALK_IN, PATIENT
    patient_id TEXT,
    customer_name TEXT NOT NULL,
    customer_phone TEXT,
    prescribing_doctor_id TEXT,
    prescribing_doctor_name TEXT,
    prescription_id TEXT,
    gross_amount REAL NOT NULL DEFAULT 0.0,
    discount_amount REAL NOT NULL DEFAULT 0.0,
    tax_amount REAL NOT NULL DEFAULT 0.0,
    round_off REAL NOT NULL DEFAULT 0.0,
    net_amount REAL NOT NULL DEFAULT 0.0,
    payment_mode TEXT NOT NULL DEFAULT 'CASH', -- CASH, UPI, CARD, SPLIT, DUE
    payment_status TEXT NOT NULL DEFAULT 'PAID', -- PAID, PENDING, PARTIAL
    status TEXT NOT NULL DEFAULT 'COMPLETED', -- COMPLETED, CANCELLED, RETURNED
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT NOT NULL,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE SET NULL,
    FOREIGN KEY (prescribing_doctor_id) REFERENCES doctors(id) ON DELETE SET NULL,
    FOREIGN KEY (prescription_id) REFERENCES prescriptions(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_sales_org ON sales(organization_id);
CREATE INDEX IF NOT EXISTS idx_sales_bill_no ON sales(organization_id, bill_number);
CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(organization_id, sale_date);
CREATE INDEX IF NOT EXISTS idx_sales_patient ON sales(patient_id);

-- 10. Sale Line Items Table
CREATE TABLE IF NOT EXISTS sale_items (
    id TEXT PRIMARY KEY,
    sale_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    batch_id TEXT NOT NULL,
    batch_number TEXT NOT NULL,
    expiry_date TEXT NOT NULL,
    quantity INTEGER NOT NULL, -- in base units
    unit_sale_price REAL NOT NULL,
    unit_mrp REAL NOT NULL,
    tax_rate_percent REAL NOT NULL DEFAULT 0.0,
    tax_amount REAL NOT NULL DEFAULT 0.0,
    discount_amount REAL NOT NULL DEFAULT 0.0,
    total_amount REAL NOT NULL,
    FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES medicine_products(id) ON DELETE RESTRICT,
    FOREIGN KEY (batch_id) REFERENCES inventory_batches(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_prod ON sale_items(product_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_batch ON sale_items(batch_id);

-- 11. Sale Returns Table
CREATE TABLE IF NOT EXISTS sale_returns (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    sale_id TEXT NOT NULL,
    return_number TEXT NOT NULL,
    return_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reason TEXT NOT NULL,
    refund_amount REAL NOT NULL DEFAULT 0.0,
    refund_mode TEXT NOT NULL DEFAULT 'CASH',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT NOT NULL,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT,
    FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE RESTRICT,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_sale_returns_org ON sale_returns(organization_id);
CREATE INDEX IF NOT EXISTS idx_sale_returns_sale ON sale_returns(sale_id);

-- 12. Sale Return Items Table
CREATE TABLE IF NOT EXISTS sale_return_items (
    id TEXT PRIMARY KEY,
    sale_return_id TEXT NOT NULL,
    sale_item_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    batch_id TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    refund_amount REAL NOT NULL,
    FOREIGN KEY (sale_return_id) REFERENCES sale_returns(id) ON DELETE CASCADE,
    FOREIGN KEY (sale_item_id) REFERENCES sale_items(id) ON DELETE RESTRICT,
    FOREIGN KEY (product_id) REFERENCES medicine_products(id) ON DELETE RESTRICT,
    FOREIGN KEY (batch_id) REFERENCES inventory_batches(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_sale_return_items_ret ON sale_return_items(sale_return_id);

-- 13. Configurable Tax Rules Table
CREATE TABLE IF NOT EXISTS tax_rules (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    tax_name TEXT NOT NULL, -- e.g. 'GST 0%', 'GST 5%', 'GST 12%', 'GST 18%', 'GST 28%'
    rate_percent REAL NOT NULL,
    cgst_percent REAL NOT NULL DEFAULT 0.0,
    sgst_percent REAL NOT NULL DEFAULT 0.0,
    igst_percent REAL NOT NULL DEFAULT 0.0,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_tax_rules_org ON tax_rules(organization_id);

-- 14. Seed Phase 5 Permissions
INSERT OR IGNORE INTO permissions (id, code, name, category, description) VALUES
('perm-med-read', 'medicine.read', 'Read Medicines', 'PHARMACY', 'View medicine catalog and products'),
('perm-med-create', 'medicine.create', 'Create Medicine', 'PHARMACY', 'Create new generic and product records'),
('perm-med-update', 'medicine.update', 'Update Medicine', 'PHARMACY', 'Update medicine details and products'),
('perm-med-deactivate', 'medicine.deactivate', 'Deactivate Medicine', 'PHARMACY', 'Deactivate medicine products'),
('perm-sup-read', 'supplier.read', 'Read Suppliers', 'PHARMACY', 'View supplier master'),
('perm-sup-create', 'supplier.create', 'Create Supplier', 'PHARMACY', 'Register new medicine suppliers'),
('perm-sup-update', 'supplier.update', 'Update Supplier', 'PHARMACY', 'Update supplier profile and details'),
('perm-pur-read', 'purchase.read', 'Read Purchases', 'PHARMACY', 'View purchase invoices and inward stock'),
('perm-pur-create', 'purchase.create', 'Create Purchase', 'PHARMACY', 'Inward purchase invoice and update batches'),
('perm-pur-cancel', 'purchase.cancel', 'Cancel Purchase', 'PHARMACY', 'Cancel purchase invoice and reverse stock'),
('perm-batch-read', 'batch.read', 'Read Batches', 'PHARMACY', 'View batch expiry and details'),
('perm-sale-read', 'sale.read', 'Read Sales', 'PHARMACY', 'View sales records and billing history'),
('perm-sale-cancel', 'sale.cancel', 'Cancel Sale', 'PHARMACY', 'Void or cancel sales bills'),
('perm-sale-return', 'sale.return', 'Sale Return', 'PHARMACY', 'Process customer medicine returns'),
('perm-rep-pharmacy', 'report.pharmacy.read', 'Read Pharmacy Reports', 'PHARMACY', 'View pharmacy financial and stock reports');

-- Map Phase 5 Permissions to Foundational Roles
-- OWNER has all pharmacy permissions
INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT 'role-owner', id FROM permissions WHERE code LIKE 'medicine.%' OR code LIKE 'supplier.%' OR code LIKE 'purchase.%' OR code LIKE 'inventory.%' OR code LIKE 'batch.%' OR code LIKE 'sale.%' OR code = 'report.pharmacy.read';

-- STAFF has operational dispensing, inwarding, inventory, and return permissions
INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT 'role-staff', id FROM permissions WHERE code IN (
    'medicine.read', 'supplier.read', 'purchase.read', 'purchase.create',
    'inventory.read', 'batch.read', 'sale.read', 'sale.create', 'sale.return'
);

-- DOCTOR has read access to medicine catalog and batches
INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT 'role-doctor', id FROM permissions WHERE code IN (
    'medicine.read', 'inventory.read', 'batch.read'
);

