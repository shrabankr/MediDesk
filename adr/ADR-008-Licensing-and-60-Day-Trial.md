# ADR-008: Licensing Lifecycle and 60-Day Trial Model

## Status
Accepted (`CURRENT (Domain & Types)` / `FUTURE (Server-side License Key Generator)`)

## Context
MediDesk offers a 60-day full-featured local trial followed by commercial licensing. The desktop application operates offline and cannot require constant online license heartbeat pings.

## Decision
- Define a formal license lifecycle state machine: `TRIAL`, `ACTIVE`, `GRACE_PERIOD`, `EXPIRED`, `SUSPENDED`, `CANCELLED`, `REVOKED`.
- Commercial licenses use asymmetric digital signatures (RSA/Ed25519) signed server-side.
- The desktop app contains only a public verification key.
- License expiration prevents new data creation but NEVER deletes existing patient data.

## Consequences
- Protects software intellectual property without endangering patient medical record retention.
