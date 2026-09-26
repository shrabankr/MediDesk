# MediDesk — Bulk Data Import & Onboarding System

**Document Version:** 1.0.0  
**Date:** 2026-08-30  
**Target Environment:** Windows Desktop Electron (Offline-First)  
**Governance Status:** Approved Data Onboarding Capability  

---

## 1. Overview & Objectives

The **MediDesk Bulk Data Import System** provides a structured, staging-validated, and tamper-evident mechanism for clinic administrators and owners to onboard clinical master records and opening inventory balances without compromising domain invariants, financial precision, or clinical safety.

### Key Architectural Principles:
1. **Dedicated Per-Record Import Cards:** Instead of a single unmanageable spreadsheet, MediDesk provides separate, dedicated cards and tailored CSV templates for each record type.
2. **Staged Preview Before Mutation:** Files are parsed and validated entirely in memory before any database write. Clinic owners inspect total row count, valid rows, warnings, and detailed error explanations with suggested fixes.
3. **Integer-Paise Financial Precision:** All monetary amounts (`mrp`, `selling_price`, `purchase_price`) are strictly converted and validated in integer Paise (e.g. ₹30.50 $\rightarrow$ 3050 Paise). Zero floating-point rounding errors are permitted.
4. **Defense-in-Depth Security & CSV Injection Protection:** Strips formula injection characters (`=`, `+`, `-`, `@`) and strictly denies sensitive credential exports/imports.
5. **Tamper-Evident Structured Audit Logging:** Every import attempt logs an audit event (`DATA_IMPORTED` or `DATA_IMPORT_FAILED`) recording the actor, record type, filename, execution duration, and row-level metrics.

---

## 2. Record Type Support Matrix

| Record Type | Support Status | Key Validation & Domain Rules | Required RBAC Permission |
|---|---|---|---|
| **1. Patients** | ✅ **SUPPORTED** | UHID automatic generation, safe duplicate detection on (Name + Mobile + DOB), gender normalization (`MALE`/`FEMALE`/`OTHER`). | `patient.create` |
| **2. Doctors** | ✅ **SUPPORTED** | Medical council registration number, specialty, contact details. **No unsafe password creation from spreadsheet.** | `doctor.create` |
| **3. Staff / Users** | ✅ **SUPPORTED** | Profile creation with safe initial temporary credentials. Owner privilege escalation prohibited. | `user.create` (Owner Only) |
| **4. Medicines** | ✅ **SUPPORTED** | Generic salt + brand product mapping, dosage form enum, HSN code, GST rate, integer-Paise MRP/selling price. | `medicine.create` |
| **5. Packaging Units** | ✅ **SUPPORTED** | Multi-tier conversion (`Strip` $\rightarrow$ `Tablet`, `Box` $\rightarrow$ `Strip`), integer `conversion_factor >= 1`, integer-Paise pricing. | `packaging.manage` |
| **6. Suppliers** | ✅ **SUPPORTED** | Supplier name, 15-digit GSTIN tax regex validation, contact numbers, duplicate detection. | `supplier.create` |
| **7. Opening Stock** | ✅ **SUPPORTED (HIGH-RISK)** | Valid product verification, batch number, future expiry date, positive base units, integer-Paise purchase price. Creates `inventory_batches` and audited `ADJUSTMENT_IN` stock movements. | `inventory.adjust` |
| **8. Barcodes** | ✅ **SUPPORTED** | Unique barcode assignment on Product or Packaging unit. Detects duplicates across all products and packaging units. | `medicine.update` |
| **9. Appointments** | ⚠️ **NOT SUPPORTED** | Historical appointment import is intentionally disabled to preserve clinical visit timeline invariants and doctor schedule rules. | `appointment.create` |
| **10. Departments / Services** | ⚠️ **NOT SUPPORTED** | MediDesk Phase 8 manages clinical visits directly through doctor consultations. Standalone service master tables are not in schema. | `org.manage` |
| **11. Price Lists** | ⚠️ **NOT SUPPORTED** | MediDesk manages product and packaging prices directly on medicine master records. Update prices via Medicine or Packaging import. | `org.manage` |

---

## 3. CSV Templates & Column Specifications

### 1. Patients (`patients_template.csv`)
- `first_name` *(Required)*: Rahul
- `middle_name` *(Optional)*: Kumar
- `last_name` *(Optional)*: Sharma
- `gender` *(Required)*: `MALE`, `FEMALE`, or `OTHER`
- `date_of_birth` *(Optional)*: `YYYY-MM-DD` (e.g. `1990-05-15`)
- `age` *(Optional)*: Integer age (0–130)
- `phone` *(Optional)*: 10-digit mobile number
- `email` *(Optional)*: Valid email
- `address`, `city`, `state`, `pincode` *(Optional)*: Residential address details
- `blood_group` *(Optional)*: `A+`, `B+`, `O+`, `AB+`, `A-`, `B-`, `O-`, `AB-`
- `allergies` *(Optional)*: Known drug/food allergies (e.g. `Penicillin`)

### 2. Medicines & Products (`medicines_template.csv`)
- `generic_name` *(Required)*: Paracetamol
- `brand_name` *(Required)*: Dolo 650mg Tablet
- `strength` *(Optional)*: 650mg
- `dosage_form` *(Required)*: `TABLET`, `CAPSULE`, `SYRUP`, `INJECTION`, `DROPS`, `OINTMENT`, `CREAM`, `GEL`, `INHALER`, `POWDER`, `LOTION`, `OTHER`
- `manufacturer` *(Optional)*: Micro Labs Ltd
- `category` *(Optional)*: `GENERAL`, `H`, `H1`, `X`
- `barcode` *(Optional)*: 8901234567890
- `hsn_code` *(Optional)*: 30049099
- `gst_rate` *(Optional)*: GST percentage (e.g. `12`)
- `mrp` *(Required)*: Maximum retail price per pack in Rupees (e.g. `30.50`)
- `selling_price` *(Optional)*: Discounted selling price per pack in Rupees (e.g. `28.00`)
- `reorder_level` *(Optional)*: Minimum stock alert threshold (e.g. `20`)
- `pack_size` *(Optional)*: Description (e.g. `15 Tablets / Strip`)
- `pack_quantity` *(Optional)*: Base units per pack (e.g. `15`)

### 3. Opening Stock (`opening_stock_template.csv`)
- `medicine_name` *(Required)*: Must match an existing brand name in Medicine Master
- `batch_number` *(Required)*: Manufacturer batch lot number (e.g. `DL65-2026`)
- `expiry_date` *(Required)*: `YYYY-MM-DD` (must be in the future)
- `quantity` *(Required)*: Opening stock count in base units (integer > 0)
- `purchase_price` *(Required)*: Purchase cost per base unit in Rupees (e.g. `1.50`)
- `mrp` *(Required)*: MRP per base unit in Rupees (e.g. `2.03`)
- `sale_price` *(Optional)*: Selling price per base unit in Rupees (e.g. `1.87`)
- `supplier_name` *(Optional)*: Name of distributor/vendor
- `received_date` *(Optional)*: `YYYY-MM-DD`

---

## 4. Import Workflow & User Experience

```
1. Select Type ──► 2. Download Template ──► 3. Upload File ──► 4. Staged Validation Preview
                                                                         │
                                                                         ▼
7. Import Report ◄── 6. Tamper-Evident Audit ◄── 5. Transaction Execution (Atomic)
```

1. **Selection:** User clicks the desired record card.
2. **Download:** User downloads the official, pre-populated CSV template.
3. **Upload:** User selects or drags the `.csv` file.
4. **Validation Preview:** In-memory validation parses headers and validates all rows against domain schemas, duplicate detectors, and relational foreign keys.
5. **Configurable Policies:**
   - `Reject Entire File on Error` *(Recommended for inventory)*: Aborts entire import if any row fails.
   - `Import Valid Rows Only`: Imports clean rows and skips errors.
   - `Skip Duplicate Records`: Avoids re-inserting existing patients or suppliers.
   - `Update Existing Records`: Updates matching master records.
6. **Execution & Audit:** Executes inside SQLite transaction (`BEGIN IMMEDIATE`) with complete rollback on unexpected error and logs `DATA_IMPORTED` event.

---

## 5. Security & Safety Controls

1. **Zero Raw SQL / Zero Shell IPC:** Preload bridge uses strictly validated typed IPC methods (`import:validate-file`, `import:execute`).
2. **Role-Based Access Control:** Developer and unauthorized roles are strictly denied from executing imports. User account import is restricted exclusively to the `OWNER` role.
3. **No Unsafe Credentials in Spreadsheets:** User import creates random secure temporary credentials that are never written to unencrypted logs.
4. **Tamper-Evident Audit Trail:** Every successful or failed import is recorded in `audit_events` with file metadata, row counts, and execution timestamps.
