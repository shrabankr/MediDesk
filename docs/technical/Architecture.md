# MediDesk Architecture Overview

**Status:** CURRENT (Phase 1 Baseline)  
**Version:** 1.0.0

---

## 1. High-Level System Architecture

MediDesk is an offline-first clinical and pharmacy management platform designed with a desktop-first strategy transitioning cleanly to LAN and SaaS deployments in future phases.

```
+-------------------------------------------------------------+
|                      React Renderer                         |
|  - Foundation UI & Presentation Shell                      |
|  - Tailwind CSS & Accessible Component Primitives          |
|  - No Node.js / No SQLite / No File System Access           |
+-------------------------------------------------------------+
                              |
                              | Typed Bridge Invocations
                              v
+-------------------------------------------------------------+
|                       Preload Bridge                        |
|  - Context Isolation via contextBridge                      |
|  - Whitelisted IPC Invocations Only                         |
|  - Strict Sanitization and Boundary Validation             |
+-------------------------------------------------------------+
                              |
                              | IPC Channels
                              v
+-------------------------------------------------------------+
|                    Electron Main Process                    |
|  - Window Lifecycle & Native OS Integration                 |
|  - Restrictive Content Security Policy (CSP)                |
|  - Sandboxed Execution                                      |
+-------------------------------------------------------------+
                              |
                              v
+-------------------------------------------------------------+
|                    Application Services                     |
|  - SystemInitializationService                              |
|  - StatusService                                            |
|  - AuditService                                             |
|  - ScryptPasswordHasher                                     |
+-------------------------------------------------------------+
                              |
                              v
+-------------------------------------------------------------+
|                Domain & Business Rules                      |
|  - RBAC Engine & Role Definitions                           |
|  - Owner (Business) vs Developer (Technical) Separation     |
|  - Repository Interfaces                                    |
+-------------------------------------------------------------+
                              |
                              v
+-------------------------------------------------------------+
|                 Infrastructure / SQLite                     |
|  - SqliteDatabase (WAL Mode, Foreign Keys Enforced)         |
|  - MigrationRunner (database/migrations/001_initial.sql)    |
|  - Stored in %APPDATA%/MediDesk/data/medidesk.sqlite        |
+-------------------------------------------------------------+
```

---

## 2. Component Implementation Status

| Component | Status | Details |
| :--- | :--- | :--- |
| **Electron Desktop Shell** | `CURRENT` | Electron 33, secure window lifecycle, CSP, context isolation |
| **React Renderer UI** | `CURRENT` | React 18, Vite 6, Tailwind CSS, System Status display |
| **TypeScript Strictness** | `CURRENT` | Strict typing, no implicit any, exact optional properties |
| **SQLite Persistence** | `CURRENT` | Local SQLite with WAL mode, foreign key enforcement, migrations |
| **RBAC Engine** | `CURRENT` | Roles: `OWNER`, `DOCTOR`, `STAFF`, `DEVELOPER` (no `SUPER_ADMIN`) |
| **Audit Logging** | `CURRENT` | Structured audit service with metadata secret redaction |
| **Password Hasher** | `CURRENT` | Cryptographic Scrypt hasher with unique salt |
| **Printing Service** | `CURRENT (Interface)` / `PLANNED` | Architecture interface ready for Phase 6 |
| **Backup Service** | `CURRENT (Interface)` / `PLANNED` | Local snapshot ready; Google Drive integration planned |
| **Licensing Service** | `CURRENT (Interface)` / `PLANNED` | 60-day trial model; asymmetric signature validation planned |
| **Patient & Clinical Module** | `FUTURE` | Planned for Phase 3 & 4 |
| **Pharmacy & POS Billing** | `FUTURE` | Planned for Phase 5 |
| **Multi-PC LAN Server** | `FUTURE` | Planned for Phase 8 |
| **Cloud SaaS Deployment** | `FUTURE` | Planned for Phase 9 |
