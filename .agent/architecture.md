# MediDesk Architecture Reference

This document provides a concise reference to the system architecture and layer authority boundaries of the MediDesk codebase.

---

## 1. High-Level Process Architecture

MediDesk operates within an Electron architecture separating execution privileges:

```
┌─────────────────────────────────────────────────────────────┐
│                    ELECTRON RENDERER                        │
│  React 18 + TypeScript + Tailwind CSS (Sandboxed UI)        │
│  - No direct Node.js access                                 │
│  - Communicates exclusively via window.mediDeskBridge       │
└──────────────────────────────┬──────────────────────────────┘
                               │ ContextBridge IPC
┌──────────────────────────────▼──────────────────────────────┐
│                    ELECTRON PRELOAD                         │
│  apps/desktop/src/preload/index.ts                          │
│  - Exposes typed bridge functions                           │
│  - Dispatches to IPC_CHANNELS                               │
└──────────────────────────────┬──────────────────────────────┘
                               │ ipcRenderer.invoke / handle
┌──────────────────────────────▼──────────────────────────────┐
│                    ELECTRON MAIN                            │
│  apps/desktop/src/main/index.ts                             │
│  - BrowserWindow lifecycle & security headers (CSP)         │
│  - IPC Route dispatching & payload validation (Zod)         │
│  - Direct access to Database, Filesystem, Hardware, OS      │
└──────────────────────────────┬──────────────────────────────┘
                               │
            ┌──────────────────┴──────────────────┐
            ▼                                     ▼
┌──────────────────────────────┐    ┌──────────────────────────────┐
│    APPLICATION SERVICES      │    │     EMBEDDED LAN SERVER      │
│  packages/application        │    │  packages/lan                │
│  - Business logic & rules    │    │  - Port 4848 HTTPS/TLS       │
│  - Auditing & Authorization  │    │  - Device pairing & HMAC     │
└──────────────┬───────────────┘    └──────────────┬───────────────┘
               │                                   │
               └─────────────────┬─────────────────┘
                                 ▼
┌─────────────────────────────────────────────────────────────┐
│                DATABASE & REPOSITORIES                      │
│  packages/database (SqliteDatabase + better-sqlite3)        │
│  - WAL Mode, Foreign Keys enabled, Serialized Transactions  │
│  - Authoritative data custodian for Single-PC and LAN Server│
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Layer Authority Matrix

| Layer / Responsibility | Authoritative Subsystem | Enforcement Location |
| :--- | :--- | :--- |
| **Input Validation** | `@medidesk/validation` | IPC Handlers & Service Entry Points via Zod |
| **Role & Permission Check** | `@medidesk/authorization` | Server/Domain Services via `RBACEngine` |
| **Audit Logging** | `@medidesk/audit` | Service execution layer via `AuditService` |
| **Data Persistence** | `@medidesk/database` | Concrete SQLite Repositories |
| **Password Hashing** | `@medidesk/shared` | `ScryptPasswordHasher` |
| **Licensing Validation** | `@medidesk/licensing` | `LicenseService` (Domain write-blocker) |
| **Hybrid Backup & Restore** | `@medidesk/backup` | `BackupService` + `GoogleDriveProvider` |
| **Document & Receipt Print**| `@medidesk/printing` | `PrintService` (Electron WebContents Print) |
| **LAN Security & Transport**| `@medidesk/lan` | `LanServer` + `LanSecurityManager` |

---

## 3. Package Descriptions & Directory Structure

```
packages/
├── domain/            # Pure entities, repository interfaces, errors, domain values (Zero deps)
├── authorization/     # RBAC engine, default permission matrices, Developer restrictions
├── validation/        # Zod validation schemas for all requests and configurations
├── database/          # SQLite manager, 001-007 migrations, SQLite repository implementations
├── audit/             # Tamper-evident structured audit logging service
├── backup/            # Hybrid backup engine (LOCAL/HYBRID/CLOUD), encryption, Google Drive
├── licensing/         # 60-day trial, offline cryptographic license verification
├── printing/          # A4/A5 prescriptions, 58/80mm thermal receipts, printer config
├── lan/               # Fastify/HTTP TLS server, client proxy gateway, HMAC signing, pairing
├── shared/            # Constants, IPC contracts, types, logger, Scrypt hasher
├── ui/                # UI design system components and icons
└── application/       # Orchestration services (Patient, Doctor, Appointment, Rx, Billing, etc.)

apps/
└── desktop/           # Electron main process, preload bridge, React renderer
```

---

## 4. Operating Topologies

1. **`SINGLE_PC` Mode:**
   - Standalone offline deployment on a single PC.
   - Zero open network ports. Direct in-process SQLite access via repositories.
2. **`LAN_SERVER` Mode:**
   - Host PC runs the authoritative SQLite database and an embedded HTTPS API server on port `4848`.
   - Authoritative for all write operations, inventory transactions, and Hybrid Backups.
3. **`LAN_CLIENT` Mode:**
   - Secondary workstations running Electron UI.
   - Dispatches all requests via `LanClientGateway` over TLS with HMAC request signatures.
   - **Never opens or mounts SQLite over SMB/network shares.**
