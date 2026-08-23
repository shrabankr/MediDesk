# ADR-003: SQLite Initial Local Persistence

## Status
Accepted (`CURRENT`)

## Context
Single-PC clinic deployment requires zero-configuration embedded storage with zero network overhead and full ACID guarantees.

## Decision
Use SQLite (via `better-sqlite3`) as the initial local database engine.
- Configured with `PRAGMA journal_mode = WAL;` and `PRAGMA foreign_keys = ON;`.
- Managed through versioned SQL migrations in `database/migrations/`.
- Stored strictly in `%APPDATA%/MediDesk/data/medidesk.sqlite`, never in source code directories.
- Accessed solely via repository interfaces (`IOrganizationRepository`, `IUserRepository`, etc.).

## Consequences
- Repositories abstract persistence so PostgreSQL can replace SQLite in LAN/SaaS phases without changing business logic.
- Never share SQLite database files across Windows file shares/SMB.
