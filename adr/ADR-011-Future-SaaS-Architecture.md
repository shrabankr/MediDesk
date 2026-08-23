# ADR-011: Future SaaS Multi-Tenancy Architecture

## Status
Accepted (`FUTURE (Phase 9)`)

## Context
Multi-location healthcare organizations and cloud-native clinics will require cloud hosting, cross-branch synchronization, and centralized patient portals.

## Decision
- Domain entities maintain `organization_id` partitioning across all models from Day 1.
- Service and repository interfaces are designed to support cloud REST/gRPC and PostgreSQL backing stores.
- Web React client will reuse `@medidesk/domain`, `@medidesk/validation`, `@medidesk/authorization`, and `@medidesk/ui` packages directly.

## Consequences
- 80%+ of business logic and validation code will be directly shared between Desktop, LAN, and Cloud SaaS versions.
