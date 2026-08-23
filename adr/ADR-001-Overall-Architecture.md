# ADR-001: Overall Architecture & Phased Evolution

## Status
Accepted (`CURRENT`)

## Context
MediDesk is designed to serve outpatient clinics and pharmacies, starting on single Windows desktop computers, scaling to multi-computer clinic LANs, and eventually supporting cloud SaaS multi-tenancy.

## Decision
Adopt a modular monorepo architecture separating Presentation, Application, Domain, Authorization, Validation, Database, Audit, Backup, Printing, Licensing, and Shared packages. Business logic lives strictly in Domain and Application layers.

## Consequences
- Clean separation allows changing database drivers or UI delivery mechanisms without modifying business rules.
- Offline-first capabilities are preserved on single PCs while laying the groundwork for LAN and SaaS.
