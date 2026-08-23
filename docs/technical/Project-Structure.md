# MediDesk Project Structure

**Version:** 1.0.0  
**Repository Pattern:** npm Monorepo Workspaces

---

## Directory Organization

```
medidesk/
├── apps/
│   └── desktop/                  # Electron application
│       ├── src/
│       │   ├── main/             # Main process (lifecycle, IPC, SQLite service init)
│       │   ├── preload/          # Context bridge (secure whitelisted IPC API)
│       │   └── renderer/         # React application (Vite, Tailwind, UI components)
│       ├── package.json
│       ├── vite.config.ts
│       ├── electron-builder.json
│       └── tsconfig.json
│
├── packages/
│   ├── domain/                   # Entities, Value Objects, Repository Interfaces, Role definitions
│   ├── application/              # Use cases (SystemInitialization, StatusService, Hasher)
│   ├── authorization/            # RBAC Engine, Owner vs Developer permission boundary
│   ├── validation/               # Zod schemas for all external boundaries
│   ├── database/                 # SQLite engine, migration runner, SQLite repositories
│   ├── audit/                    # Structured audit event logger with secret redaction
│   ├── backup/                   # BackupService interface & local snapshot foundation
│   ├── printing/                 # PrintService interface & hardware abstraction
│   ├── licensing/                # Licensing domain types (60-day trial, entitlement)
│   ├── shared/                   # Structured logger, typed AppConfig, IPC contracts, Result<T,E>
│   └── ui/                       # Reusable accessible UI components & Tailwind tokens
│
├── database/
│   └── migrations/               # Versioned SQL migrations (001_initial_schema.sql)
│
├── docs/
│   ├── technical/                # Technical design specifications
│   └── SRS.md                    # System Requirements Specification
│
├── adr/                          # Architecture Decision Records (ADR-001 through ADR-012)
│
├── tests/
│   ├── unit/                     # Domain, Validation, RBAC, Logger, and Hasher tests
│   ├── integration/              # SQLite migration, repository, and first-run tests
│   ├── security/                 # Electron boundary & forbidden IPC tests
│   └── e2e/                      # Playwright desktop testing configuration
│
├── package.json                  # Root monorepo configuration & workspace definitions
├── tsconfig.base.json            # Base strict TypeScript configuration
├── vitest.config.ts              # Vitest workspace test configuration
├── playwright.config.ts          # Playwright test configuration
└── .gitignore                    # Comprehensive Git ignore rules
```
