# ADR-009: Offline-First Architectural Baseline

## Status
Accepted (`CURRENT`)

## Context
Outpatient clinics often face erratic or absent Internet connectivity. Critical clinic consultations, patient intake, dispensing, and billing must never halt due to network downtime.

## Decision
- Design core workflows to execute locally against embedded SQLite storage.
- Clearly decouple network status from application and database readiness.
- Internet connectivity is treated strictly as an optional accelerator (for cloud backup, updates, and future cloud sync).

## Consequences
- Guarantees 100% uptime for core clinic operations.
