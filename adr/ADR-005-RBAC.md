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

## Consequences
- Clean permission checks prevent unauthorized API invocations regardless of UI state.
