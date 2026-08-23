# ADR-005: Role-Based Access Control (RBAC) Architecture

## Status
Accepted (`CURRENT`)

## Context
MediDesk requires granular permission evaluation across different clinic workflows (Doctor, Staff, Owner, Developer).

## Decision
Implement a decoupled RBAC engine evaluating `User -> Role -> Permission -> Scope`:
- Foundation roles: `OWNER`, `DOCTOR`, `STAFF`, `DEVELOPER`.
- Granular permissions (e.g. `patient.read`, `prescription.create`, `sale.create`, `system.migrate`).
- Authorization is evaluated outside the UI layer in application services and IPC handlers. Hiding a button is not treated as a security control.
- **Clear Separation of Security States:**
  - *Account Status:* `ACTIVE` / `DISABLED` / `SUSPENDED` (`is_active = 1 | 0`).
  - *Authentication Lockout:* `LOCKED` / `UNLOCKED` (`is_locked = 1 | 0`) for brute-force protection.
  - *Role Authority:* `OWNER`, `DOCTOR`, `STAFF`, `DEVELOPER`.
- **Last Active Owner Protection Invariant:** The system strictly enforces that an organization must always retain at least one **ACTIVE** `OWNER` account (`is_active = 1`). Transient authentication lock state does NOT diminish active ownership. The application layer and repositories reject any user deactivation or role revocation transaction that would leave zero active Owners.
- **Emergency Owner Recovery Path:** Single-PC offline installations establish an Emergency Recovery Key hash at first-run initialization. If the sole Owner is locked out or credentials are forgotten, the emergency recovery key allows unlocking, resetting Owner credentials, or provisioning a secondary Owner without creating a backdoor or universal `SUPER_ADMIN`. Every recovery invocation produces an immutable security audit trail event.

## Consequences
- Clean permission checks prevent unauthorized API invocations regardless of UI state.
- Guarantees the clinic can never be permanently locked out of administrative control by accidental or malicious deactivation of the last active Owner, while eliminating circular lockout dependencies for single-Owner installations.
