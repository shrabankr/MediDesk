# MediDesk Database & Persistence Guidelines

This document details database engine configurations, schema migration procedures, repository patterns, and concurrency rules for MediDesk.

---

## 1. SQLite Engine Configuration

MediDesk uses `better-sqlite3` as its underlying database engine. All connections must be configured with:

```sql
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA temp_store = MEMORY;
PRAGMA busy_timeout = 5000;
```

### Invariants:
- **Foreign Keys:** Must ALWAYS be active. Deletions and updates must adhere to defined `ON DELETE RESTRICT` or `ON DELETE CASCADE` constraints.
- **WAL Mode:** Write-Ahead Logging allows concurrent readers alongside active writers.
- **Single Connection / Host Authority:**
  - In `SINGLE_PC` mode, the local desktop instance maintains the single open database handle.
  - In `LAN_SERVER` mode, only the LAN Server process holds the database handle. Workstations communicate via API.

---

## 2. Migration System & Rules

Database migrations are stored in `database/migrations/` as sequentially numbered SQL files:

| Migration File | Description | Target Scope |
| :--- | :--- | :--- |
| `001_initial_schema.sql` | Organizations, Users, Roles, Permissions, UserRoles, RolePermissions, AuditLogs, ApplicationState | Phase 1 Baseline |
| `002_patient_doctor_appointment.sql` | Patients, Doctors, DoctorSchedules, Appointments | Phase 3 Core |
| `003_clinical_consultation_prescription.sql` | ClinicalVisits, Vitals, Allergies, MedicalHistories, Diagnoses, Prescriptions, PrescriptionItems, FollowUps, ClinicalCorrections | Phase 4 Clinical |
| `004_pharmacy_inventory_billing.sql` | Medicines, MedicineProducts, Suppliers, InventoryBatches, StockMovements, Purchases, PurchaseItems, Sales, SaleItems, SaleReturns, SaleReturnItems, TaxRules | Phase 5 Pharmacy |
| `005_system_licensing_backups.sql` | Licenses, LicenseActivations, BackupLogs, PrinterConfigs | Phase 6 Utilities |
| `006_hybrid_backup_settings.sql` | BackupSettings (Hybrid Mode, Retention, Google Drive state) | Phase 6 Hybrid |
| `007_lan_devices.sql` | LanDevices, LanPairingPins, LanServerConfig | Phase 7 LAN |

### Migration Invariants:
1. **Never Modify Released Migrations:** Files `001` through `007` are frozen and in production.
2. **Sequential Numbering:** Any new migration must be named `008_<feature_description>.sql`.
3. **Atomic Execution:** `MigrationRunner` applies migrations inside an atomic SQLite transaction and records applied versions in the `schema_migrations` table.
4. **Additive Changes Preferred:** Prefer `ALTER TABLE ... ADD COLUMN` over dropping or replacing existing tables.

---

## 3. Database Migration Checklist for AI Agents

When adding a schema change:

- [ ] 1. Identify the latest migration index in `database/migrations/`.
- [ ] 2. Create `00X_<feature_description>.sql` with complete `CREATE TABLE` / `ALTER TABLE` / `CREATE INDEX` statements.
- [ ] 3. Include necessary role permission seed entries for new features.
- [ ] 4. Update TypeScript interfaces in `@medidesk/domain` entities and DTOs.
- [ ] 5. Update or create corresponding SQLite repository classes in `@medidesk/database`.
- [ ] 6. Update `MigrationRunner` references if applicable.
- [ ] 7. Update integration tests in `tests/integration/sqlite_migration.test.ts` and `tests/integration/initialization.test.ts`.
- [ ] 8. Verify with `npm test` and `npm run typecheck`.

---

## 4. Concurrency & Transaction Management

- **Serialized Writes:** Operations modifying inventory stock (`InventoryBatches`), recording sales (`Sales`), or processing returns (`SaleReturns`) must execute inside a `db.transaction()` block.
- **LAN Mutex Locking:** On the LAN Server, POS billing and batch deductions pass through an in-memory `writeMutex` before initiating SQLite `BEGIN IMMEDIATE` transactions to prevent race conditions across simultaneous workstation checkouts.
- **Stock Movements Ledger:** Every stock alteration must write an immutable record to `stock_movements` documenting quantity change, reason (`PURCHASE`, `SALE`, `RETURN`, `ADJUSTMENT`, `EXPIRED`, `DAMAGED`), and actor.
