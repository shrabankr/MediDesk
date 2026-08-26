# Database Design & Migration Specification

**Status:** CURRENT (Phase 3 Verified)

---

## 1. Engine & Configuration

- **Database Engine:** SQLite (via `better-sqlite3`)
- **Journal Mode:** Write-Ahead Logging (`PRAGMA journal_mode = WAL;`)
- **Foreign Keys:** Enabled (`PRAGMA foreign_keys = ON;`)
- **Busy Timeout:** 5000ms (`PRAGMA busy_timeout = 5000;`)
- **Storage Location:** Platform AppData (`%APPDATA%/MediDesk/data/medidesk.sqlite` on Windows). Never inside the source repository.

---

## 2. Schema Entity-Relationship Model

```
+------------------+           +-------------------+
|  organizations   |<----------|       users       |
|------------------| 1       * |-------------------|
| id (PK)          |           | id (PK)           |
| name             |           | organization_id(FK)
| code (UNIQUE)    |           | username (UNIQUE) |
| currency         |           | email (UNIQUE)    |
| timezone         |           | password_hash     |
| created_at       |           | is_active         |
| updated_at       |           | is_locked         |
+------------------+           +-------------------+
        ^                               ^
        |                               | (optional 0..1)
        |                      +-------------------+
        |                      |      doctors      |
        |                      |-------------------|
        |                      | id (PK)           |
        |                      | organization_id(FK)
        |                      | user_id (FK, opt) |
        |                      | display_name      |
        |                      | qualification     |
        |                      | specialization    |
        |                      | registration_no   |
        |                      | mobile            |
        |                      | consultation_fee  |
        |                      | status            |
        |                      +-------------------+
        |                               ^
        |                               | 1
        |                               | *
        |                      +-------------------+
        |                      | doctor_schedules  |
        |                      |-------------------|
        |                      | id (PK)           |
        |                      | doctor_id (FK)    |
        |                      | day_of_week (0-6) |
        |                      | start_time (HH:MM)|
        |                      | end_time (HH:MM)  |
        |                      | slot_duration_mins|
        |                      | is_active         |
        |                      +-------------------+
        |                               ^
        |                               |
        |                      +-------------------+
        |                      |   appointments    |
        |                      |-------------------|
        |                      | id (PK)           |
        |                      | organization_id(FK)
        +----------------------| patient_id (FK)   |
        |                      | doctor_id (FK)    |
        |                      | appointment_date  |
        |                      | start_time (HH:MM)|
        |                      | end_time (HH:MM)  |
        |                      | duration_minutes  |
        |                      | status            |
        |                      | queue_number      |
        |                      | visit_purpose     |
        |                      | notes             |
        |                      +-------------------+
        |                               |
        |                      +-------------------+
        |                      |     patients      |
        |                      |-------------------|
        |                      | id (PK)           |
        +----------------------| organization_id(FK)
                               | patient_number    | (e.g. MD-000001)
                               | full_name         |
                               | normalized_name   |
                               | date_of_birth     |
                               | age               |
                               | sex (M/F/OTHER)   |
                               | mobile            |
                               | normalized_mobile |
                               | alternate_mobile  |
                               | address           |
                               | emergency_name    |
                               | emergency_phone   |
                               | status            |
                               +-------------------+
```

---

## 3. Applied Database Migrations

### `001_initial_schema.sql` (Phase 1 Baseline)
- Core tables: `organizations`, `users`, `roles`, `permissions`, `user_roles`, `role_permissions`, `audit_events`, `application_state`.
- Seeds foundational roles (`OWNER`, `DOCTOR`, `STAFF`, `DEVELOPER`) and system permissions.

### `002_patient_doctor_appointment.sql` (Phase 3 Additive Migration)
- Tables: `patients`, `doctors`, `doctor_schedules`, `appointments`.
- Indexes:
  - `idx_patients_org_number`: `(organization_id, patient_number)`
  - `idx_patients_name_norm`: `(organization_id, normalized_name)`
  - `idx_patients_mobile_norm`: `(organization_id, normalized_mobile)`
  - `idx_doctors_org_status`: `(organization_id, status)`
  - `idx_doctor_schedules_doc_day`: `(doctor_id, day_of_week)`
  - `idx_appointments_org_date`: `(organization_id, appointment_date)`
  - `idx_appointments_doc_date`: `(doctor_id, appointment_date)`
  - `idx_appointments_patient`: `(patient_id)`
  - `idx_appointments_status`: `(status)`
- Seeds Phase 3 permissions (`patient.*`, `doctor.*`, `appointment.*`) with strict developer denial.
