# ADR-007: Dedicated Hardware Printing Architecture

## Status
Accepted (`CURRENT (Interface)` / `PLANNED (Phase 6 Native Drivers)`)

## Context
Clinics rely on printing physical prescriptions (A4/A5 laser/inkjet) and thermal receipts (58mm/80mm ESC/POS).

## Decision
- Isolate all printing capabilities into a dedicated `PrintService` abstraction (`@medidesk/printing`).
- Electron Main process interacts with native Windows printer queues and ESC/POS thermal printer adapters.
- Clinical and billing modules only generate document data payloads and do not invoke native OS print drivers directly.

## Consequences
- Printing hardware changes or driver swaps do not alter medical or billing domain logic.
