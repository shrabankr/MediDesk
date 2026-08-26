# RBAC & Role Separation Specification

**Status:** CURRENT (Phase 3 Verified)

---

## 1. Core Security Invariant

> **"Developer has no default access to clinical, patient, doctor clinical profile, or financial data. Temporary sensitive support access requires explicit Owner approval, limited scope, expiration, and audit logging."**

---

## 2. Role Matrices & Authority Mapping

| Module / Permission | OWNER | DOCTOR | STAFF | DEVELOPER |
| :--- | :---: | :---: | :---: | :---: |
| **Organization Management** (`org.manage`) | ✅ | ❌ | ❌ | ❌ |
| **User Administration** (`user.create/update/disable`) | ✅ | ❌ | ❌ | ❌ |
| **Role Assignment** (`role.assign`) | ✅ | ❌ | ❌ | ❌ |
| **Audit Log Read** (`audit.read`) | ✅ | ❌ | ❌ | ❌ |
| **Patient Registration** (`patient.create`) | ✅ | ✅ | ✅ | ❌ **DENIED** |
| **Patient Lookup / Search** (`patient.read`) | ✅ | ✅ | ✅ | ❌ **DENIED** |
| **Patient Profile Update** (`patient.update`) | ✅ | ✅ | ✅ | ❌ **DENIED** |
| **Patient Delete** (`patient.delete`) | ✅ | ❌ | ❌ | ❌ **DENIED** |
| **Doctor Profile Create** (`doctor.create`) | ✅ | ❌ | ❌ | ❌ **DENIED** |
| **Doctor Directory Read** (`doctor.read`) | ✅ | ✅ | ✅ | ❌ **DENIED** |
| **Doctor Schedule Update** (`doctor.update`) | ✅ | ❌ | ❌ | ❌ **DENIED** |
| **Doctor Deactivation** (`doctor.deactivate`) | ✅ | ❌ | ❌ | ❌ **DENIED** |
| **Appointment Booking** (`appointment.create`) | ✅ | ❌ | ✅ | ❌ **DENIED** |
| **Appointment List / Search** (`appointment.read`) | ✅ | ✅ | ✅ | ❌ **DENIED** |
| **Appointment Reschedule** (`appointment.update`) | ✅ | ✅ | ✅ | ❌ **DENIED** |
| **Appointment Check-In** (`appointment.checkin`) | ✅ | ❌ | ✅ | ❌ **DENIED** |
| **Waiting Queue Management** (`appointment.queue.manage`) | ✅ | ✅ | ✅ | ❌ **DENIED** |
| **Appointment Cancellation** (`appointment.cancel`) | ✅ | ❌ | ✅ | ❌ **DENIED** |
| **Technical Diagnostics** (`system.diagnostics`) | ❌ | ❌ | ❌ | ✅ |
| **Schema Migrations** (`system.migrate`) | ❌ | ❌ | ❌ | ✅ |
| **Local SQLite Backup** (`system.backup.local`) | ✅ | ❌ | ❌ | ✅ |

---

## 3. Last Active Owner Invariant
There must always be at least one ACTIVE Owner account (`is_active = 1`).
- The invariant decouples temporary password lockout (`is_locked`) from active account status (`is_active`).
- An active Owner who gets locked due to failed attempts can be recovered via the recovery token workflow without violating the invariant.
