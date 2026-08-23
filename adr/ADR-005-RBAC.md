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
- **Last Active Owner Protection Invariant:** The system strictly enforces that an organization must always retain at least one active, unlocked `OWNER` account. The application layer and repositories reject any user deactivation, suspension, or role revocation transaction that would leave zero active Owners.

## Consequences
- Clean permission checks prevent unauthorized API invocations regardless of UI state.
- Guarantees the clinic can never be permanently locked out of administrative control by accidental or malicious deactivation of the last active Owner.
