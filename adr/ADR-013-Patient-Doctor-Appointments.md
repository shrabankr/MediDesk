# ADR-013: Patient, Doctor & Appointment Management Architecture

## Status
ACCEPTED (Phase 3 Verified)

## Context
Phase 3 introduces MediDesk's first business data modules: Patient Registration & Search, Doctor Profile & Schedule Management, and Daily Appointment Scheduling with a real-time Waiting Queue.

Small Indian clinics and medical practices face specific operational challenges:
1. High risk of duplicate patient record creation due to misspellings, honorific prefixes ("Mr.", "Mrs.", "Shri"), or varying mobile number formats.
2. Staff with limited typing speed who require minimum keystrokes and fast search.
3. Multiple family members sharing a single mobile phone number.
4. Overlapping doctor schedules and double-booking mistakes.
5. Patient queue disorganization and lack of real-time visibility into waiting vs. in-consultation status.
6. Strict privacy boundaries where technical developers must never have access to patient or clinical scheduling records.

## Decision

### 1. Duplicate Patient Prevention & Search Architecture
- **Human-Friendly Sequential Identifier**: Every registered patient is assigned an organization-scoped, sequential identifier (`MD-000001`, `MD-000002`) separate from internal UUID keys.
- **Normalization Layer**:
  - `normalizeName(name)`: Lowercases, trims whitespace, and collapses multiple internal spaces.
  - `normalizeMobile(mobile)`: Strips non-digits and standardizes to the 10-digit Indian standard.
- **Scored Duplicate Matcher**:
  - `STRONG`: Exact 10-digit normalized mobile match.
  - `MEDIUM`: Exact normalized name + same date of birth OR same gender.
  - `LOW`: Exact normalized name match.
- **Explicit Override Policy**: Duplicates are never silently created or auto-merged. The UI alerts staff with matching records and provides a distinct choice: `[Use Existing Patient]` or `[Force Create New]`.

### 2. Doctor Directory & Weekly Schedule
- **Decoupled Doctor Profile**: A Doctor entity represents a practicing physician and is optionally linked to a system user (`user_id`).
- **Weekly Schedule Matrix**: Configurable day-of-week slots (0=Sun .. 6=Sat) with start time, end time, and slot duration.
- **Consultation Guard**: Appointments cannot be scheduled outside doctor working hours or for inactive doctors.

### 3. Strict Appointment State Machine
Appointments follow an immutable, auditable state machine with no skips:
- `SCHEDULED` → `CHECKED_IN` | `WAITING` | `CANCELLED` | `NO_SHOW`
- `CHECKED_IN` → `WAITING` | `IN_CONSULTATION` | `CANCELLED`
- `WAITING` → `IN_CONSULTATION` | `CANCELLED`
- `IN_CONSULTATION` → `COMPLETED` | `WAITING`
- `COMPLETED`, `CANCELLED`, `NO_SHOW` → Terminal States.

### 4. Overlap & Conflict Prevention
Appointment booking transactions enforce:
`doctorId = ? AND appointment_date = ? AND status != 'CANCELLED' AND (start_time < newEndTime AND end_time > newStartTime) [AND id != excludeId]`

### 5. Multi-Tenant Organization Isolation & Privilege Separation
- All database queries filter by `organization_id`.
- The `DEVELOPER` role is strictly denied all `patient.*`, `doctor.*`, and `appointment.*` permissions.
- Operational actions (`PATIENT_CREATED`, `PATIENT_UPDATED`, `DOCTOR_CREATED`, `APPOINTMENT_CREATED`, `APPOINTMENT_CHECKED_IN`, `APPOINTMENT_STATUS_CHANGED`, `APPOINTMENT_CANCELLED`) generate immutable audit log records.

## Consequences
- **Positive**: Zero accidental double-bookings; fast sub-second patient lookup; duplicate records prevented before creation; strict auditability; seamless future LAN and cloud synchronization capability.
- **Compliance**: Preserves the approved Phase 1 & 2 security boundary with zero weakening of nodeIntegration/contextIsolation/RBAC policies.
