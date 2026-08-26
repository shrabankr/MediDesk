# Patient Data Protection & Privacy Architecture

**Status:** CURRENT (Phase 3 Verified)

---

## 1. Developer Privilege Separation

> **"Developer has no default access to clinical, patient, doctor clinical profile, or financial data. Temporary sensitive support access requires explicit Owner approval, limited scope, expiration, and audit logging."**

- `DEVELOPER` role possesses **ZERO** permissions for:
  - `patient.*` (`create`, `read`, `update`, `delete`, `export`)
  - `doctor.*` (`create`, `read`, `update`, `deactivate`)
  - `appointment.*` (`create`, `read`, `update`, `cancel`, `checkin`, `queue.manage`)
- Enforced at the `RBACEngine` and application service layers on every IPC request.

---

## 2. Multi-Tenant Organization Isolation

- Every SQL query across `patients`, `doctors`, and `appointments` scopes data strictly using `organization_id = ?`.
- Cross-tenant queries return empty results or throw `PatientNotFoundError` / `DoctorNotFoundError`.
- Patient number sequences (`MD-000001`) restart independently per organization.

---

## 3. Privacy & Sanitized Logging

- **No Patient PII in Logs**: Log statements record only synthetic identifiers (`patientNumber`, `queueNumber`, `doctorId`, `actor.username`). Patient names, mobile numbers, and addresses are strictly excluded from debug/error logs.
- **Audit Metadata Minimization**: Audit events record resource paths (e.g. `patient/<UUID>`, `appointment/<UUID>`) and non-PII metadata (e.g. `patientNumber`, `modifiedFields`, `forcedOnDuplicate`).
- **Fully Local & Offline**:
  - Zero telemetry or analytics calls.
  - Zero external cloud/API transmission of patient data.
  - Zero third-party tracker scripts.
