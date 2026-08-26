# AGENTS.md — MediDesk AI Agent Governance & Architecture Reference

> **CRITICAL DIRECTIVE FOR ALL AI AGENTS:**  
> MediDesk Phases 1–7 are fully implemented, tested, documented, approved, and **FROZEN**.  
> **NEVER** start the next phase or implement new product features without explicit, written user approval.  
> **Phase completion does NOT authorize the next phase.**

---

## 1. Project Identity & Overview

- **Project Name:** MediDesk
- **Core Domain:** Offline-First Clinical Practice, Electronic Health Records (EHR), and Pharmacy POS Management.
- **Runtime Environment:** Electron (Windows 10/11 Desktop Target).
- **Frontend Stack:** React 18, TypeScript, Tailwind CSS, Lucide Icons, Vite.
- **Database Engine:** Embedded SQLite via `better-sqlite3` (WAL Mode enabled, Foreign Keys enforced).
- **Network Topologies:**
  1. `SINGLE_PC`: Standalone offline desktop app (0 open network ports).
  2. `LAN_SERVER`: Host PC running embedded HTTPS/WSS API service (Port 4848), authoritative for database writes, stock allocation, and backups.
  3. `LAN_CLIENT`: Secondary workstations (Doctor, Reception, POS) operating over a zero-trust cryptographic LAN transport.

---

## 2. Monorepo Package Boundaries & Responsibilities

MediDesk strictly enforces clean layer separation and unidirectional dependency flow:

```
[ apps/desktop ] (Main, Preload, Renderer)
       │
       ▼
[ @medidesk/lan ] ──► [ @medidesk/application ] ──► [ @medidesk/authorization ]
                              │                             ▲
                              ▼                             │
                     [ @medidesk/domain ] ◄─────────────────┘
                              ▲
                              │
  ┌───────────────────────────┼───────────────────────────┐
  │                           │                           │
[ @medidesk/database ] [ @medidesk/validation ] [ @medidesk/audit ]
  │                           │                           │
[ @medidesk/backup ]   [ @medidesk/licensing ]  [ @medidesk/printing ]
  │                           │                           │
  └───────────────────────────┴───────────────────────────┘
                              │
                              ▼
                     [ @medidesk/shared ]
```

### Package Directory & Responsibilities:

| Package | Path | Layer Role & Constraints |
| :--- | :--- | :--- |
| **`@medidesk/domain`** | `packages/domain` | Pure TypeScript entities, repository contracts, domain errors, and value types. **Zero external dependencies.** |
| **`@medidesk/authorization`**| `packages/authorization` | Role-Based Access Control (`RBACEngine`), default permission matrices, and developer restriction rules. |
| **`@medidesk/validation`** | `packages/validation` | Zod validation schemas for all inputs, IPC requests, DTOs, and system configurations. |
| **`@medidesk/database`** | `packages/database` | SQLite database connection manager (`SqliteDatabase`), migration engine (`MigrationRunner`), and concrete repository implementations. |
| **`@medidesk/audit`** | `packages/audit` | Tamper-evident structured audit logging (`AuditService`) for security, clinical, and financial actions. |
| **`@medidesk/backup`** | `packages/backup` | Hybrid Backup Engine (`LOCAL_ONLY`, `HYBRID`, `CLOUD_ONLY`), AES-256-GCM encryption, Google Drive integration, and safe disaster restore. |
| **`@medidesk/licensing`** | `packages/licensing` | 60-Day Trial provisioning, offline cryptographic license validation (Ed25519/HMAC), and read-only grace period enforcement. |
| **`@medidesk/printing`** | `packages/printing` | Native document generation and thermal receipt / A4/A5 prescription printing (`PrintService`). |
| **`@medidesk/lan`** | `packages/lan` | Embedded LAN server (`LanServer`), client gateway proxy (`LanClientGateway`), TLS certificate generation, PIN pairing, and HMAC request signing. |
| **`@medidesk/shared`** | `packages/shared` | Cross-layer constants, IPC channel definitions, IPC request/response contracts, and structured logger. |
| **`@medidesk/ui`** | `packages/ui` | Reusable React UI component primitives, design system components, and utility styling. |
| **`@medidesk/application`**| `packages/application` | Application use cases and business orchestration services (`PatientService`, `DoctorService`, `AppointmentService`, `ClinicalVisitService`, `PrescriptionService`, `InventoryService`, `PharmacyBillingService`, etc.). |
| **`@medidesk/desktop`** | `apps/desktop` | Electron packaging layer containing `main` process, secure `preload` bridge, and React `renderer` dashboard. |

---

## 3. Electron Process Security Rules

All AI agents working on Electron code MUST preserve these invariants:

1. **Strict Context Isolation & Sandboxing:**
   - `contextIsolation: true`
   - `nodeIntegration: false`
   - `sandbox: true`
   - `webSecurity: true`
   - `allowRunningInsecureContent: false`
2. **Secure Preload Bridge (`mediDeskBridge`):**
   - The preload script (`apps/desktop/src/preload/index.ts`) must only expose explicit, validated bridge methods via `contextBridge.exposeInMainWorld('mediDeskBridge', ...)`.
   - Never expose `ipcRenderer` or `require` directly to `window`.
3. **Strict IPC Channel Validation:**
   - Every IPC handler in `apps/desktop/src/main/ipc/` must validate its incoming payload using `@medidesk/validation` Zod schemas before delegating to application services.
   - All IPC handlers return structured `IPCResponse<T>` objects (`{ success: boolean, data?: T, error?: { code, message, details } }`).
4. **Prohibited IPC Mechanisms:**
   - **NO raw SQL execution IPC** (`executeSQL`, `rawQuery`, etc.).
   - **NO shell/command execution IPC** (`exec`, `spawn`, `runCommand`).
   - **NO direct Node.js filesystem access** from the renderer.
5. **Content Security Policy (CSP):**
   - Main process enforces CSP headers blocking unauthorized remote scripts, inline style injection exploits, and external script loading.
   - External window navigation is denied via `setWindowOpenHandler` and `will-navigate` event interception.

---

## 4. Database & Persistence Invariants

1. **Authoritative Custodian:**
   - In `SINGLE_PC` mode, the local SQLite database file is the single authoritative source of truth.
   - In `LAN_SERVER` mode, the LAN Server PC's SQLite database is authoritative for all connected workstations.
   - **NEVER** place SQLite on an SMB/network shared folder.
   - **NEVER** allow multiple Electron client instances to directly open the same SQLite file over network storage.
2. **Engine Configurations:**
   - SQLite must always execute with `PRAGMA foreign_keys = ON;`.
   - Write-Ahead Logging (`PRAGMA journal_mode = WAL;`) and `PRAGMA synchronous = NORMAL;` must be preserved.
3. **Migration Rules (`database/migrations/`):**
   - Migrations are sequential SQL files (`001_initial_schema.sql` through `007_lan_devices.sql`).
   - **NEVER destructively modify an existing released migration.**
   - All new schema changes must be added as a new incremental migration file (`008_...sql`).
   - The migration runner records applied migrations in `schema_migrations` inside an atomic transaction.
4. **Atomicity & Concurrency:**
   - Stock allocations, POS sales, and payment collections must execute within serialized transactions (`BEGIN IMMEDIATE`) to prevent race conditions and negative inventory stock.

---

## 5. Role-Based Access Control (RBAC) & Authority Boundaries

### System Roles:
- **`OWNER` (Business & Administrative Authority):**
  - Controls clinic organization settings, user account creation/deactivation, role assignment, clinical policy, pricing, financial audit logs, license activation, and disaster recovery database restores.
  - **Last-Active-Owner Protection:** The application strictly prevents deactivating or deleting the last active Owner account.
- **`DOCTOR` (Medical Authority):**
  - Patient consultation, vitals recording, diagnosis, allergy/history management, electronic prescription generation and digital signing, and appointment schedule viewing.
- **`STAFF` (Operations & Dispensary Authority):**
  - Patient registration, appointment booking, patient check-in, queue management, pharmacy POS billing, and medicine dispensing.
- **`DEVELOPER` (Technical & Infrastructure Authority ONLY):**
  - Diagnostics, system migration, technical config inspection, local backup creation.
  - **CRITICAL RESTRICTION:** Developer has **NO DEFAULT ACCESS** to clinical records, patient demographics, prescriptions, pharmacy inventory, sales, or financial reports.
  - Developer **CANNOT** activate commercial licenses or execute database restores.
  - **NO `SUPER_ADMIN` universal bypass exists in MediDesk.**
- **Server/Domain Authorization Enforcement:**
  - All permissions are evaluated server-side / domain-side via `RBACEngine.assertPermission(actor, permission)`.
  - UI visibility toggles are cosmetic only; permissions sent from client requests are never trusted.

---

## 6. LAN / Multi-Workstation Architecture Invariants

1. **Topology & Transport:**
   - Host machine runs in `LAN_SERVER` mode; secondary workstations run in `LAN_CLIENT` mode.
   - Transport is encrypted via TLS 1.3 with self-signed certificate generation and pinned SHA-256 certificate fingerprint verification.
2. **Workstation Pairing Protocol:**
   - Pairing requires a 6-digit one-time PIN generated by the Owner on the Server PC (10-minute expiry).
   - Devices register with `PENDING_APPROVAL` status and require explicit approval by the Owner in the LAN Management Dashboard.
   - Upon approval, the server issues a cryptographically signed `deviceToken`.
3. **Zero-Trust Request Signing & Anti-Replay:**
   - Every client request includes headers: `X-Device-Id`, `X-Device-Signature` (HMAC-SHA256), `X-Request-Timestamp`, and `X-Request-Nonce`.
   - The server validates timestamp freshness ($\pm 300\text{s}$) and rejects duplicate nonces via an in-memory replay cache.
4. **Concurrency & Stock Safety:**
   - Server processes sales and inventory movements through an in-memory serialized `writeMutex` with SQLite `BEGIN IMMEDIATE` locks.
   - Concurrent sales on the same batch guarantee **zero negative stock** and **zero double allocation**.
5. **Client Resilience:**
   - If the LAN Server restarts or disconnects, clients automatically detect connection loss, transition to `DISCONNECTED` state, and reconnect with exponential backoff without corrupting local memory.

---

## 7. Hybrid Backup & Disaster Recovery Architecture

1. **Operating Modes:**
   - `HYBRID` (Default & Recommended): Immediate encrypted local snapshot with background opportunistic Google Drive upload.
   - `LOCAL_ONLY`: Pure offline encrypted local snapshotting with 0 network calls.
   - `CLOUD_ONLY`: Uploads encrypted snapshot to Google Drive and cleans local copy upon verified upload.
2. **Offline Independence Invariant:**
   - Lack of Internet or Google Drive failure **NEVER** causes local backup failure.
3. **Cryptographic Format:**
   - Single encrypted artifact (`MEDIDESK_ENC_V1` header + AES-256-GCM + scrypt key derivation + SHA-256 sidecar checksum).
   - Plaintext SQLite databases are never transmitted to cloud storage.
4. **Restore Safety Guarantee:**
   - Before executing any restore, the system automatically creates a mandatory `PRE_RESTORE_SAFETY` backup snapshot.
   - Restores verify AES-GCM authentication tags and SQLite header signatures before atomic database replacement.
   - Restore execution is restricted exclusively to the `OWNER` role.

---

## 8. Licensing & 60-Day Trial Rules

1. **Trial Provisioning:**
   - A 60-day trial license is automatically generated on first-run system initialization.
2. **Offline Cryptographic Verification:**
   - Commercial licenses are validated offline using asymmetric digital signatures (Ed25519/HMAC payload verification).
3. **Graceful Expiry & Historical Integrity:**
   - When a trial or license expires, write operations (new clinical visits, appointments, sales) are blocked.
   - **Historical clinical records, prescriptions, and invoices remain permanently readable, searchable, printable, and exportable.**
   - Licensing checks are enforced domain-side and cannot be bypassed via client UI manipulation.

---

## 9. Printing & Hardware Invariants

1. **Supported Formats:**
   - Clinical Prescriptions: A4 and A5 formats with customizable clinic headers, doctor credentials, Rx details, and digital signature blocks.
   - Pharmacy POS Invoices: GST-compliant standard invoices and 58mm/80mm thermal receipt formats.
2. **Workstation Printer Selection:**
   - Workstations store local printer configurations for Prescription Printer and POS Thermal Printer independently.
   - Printing executes silently or via system dialog using Electron native print APIs.

---

## 10. Golden Development Rules for AI Agents

When interacting with or modifying the MediDesk codebase, all AI agents MUST follow these 10 rules:

1. **Inspect Before Modifying:** Thoroughly research existing code, ADRs, schemas, and types before proposing changes.
2. **Respect Monorepo Boundaries:** Never import from `apps/` into `packages/`, and never import internal package files across module boundaries without using export contracts.
3. **Keep Changes Minimal and Isolated:** Focus strictly on the assigned task without unsolicited refactoring.
4. **Never Bypass Domain Authorization:** Always enforce permissions in application/domain services using `RBACEngine`.
5. **Never Introduce Raw SQL or Shell IPC:** All database interactions must pass through repository classes and parameterized queries.
6. **Never Expose Node APIs to Renderer:** Keep all Electron renderer code completely sandboxed.
7. **Never Hardcode Secrets:** Use environment variables, secure key derivation, or database encrypted settings.
8. **Never Weaken Security for Tests:** Tests must validate real security constraints (e.g. Developer isolation, HMAC verification, RBAC denial).
9. **Maintain 100% Test Pass Rate:** Always run `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build` after changes.
10. **Document Significant Decisions:** Add Architecture Decision Records (`adr/ADR-XXX.md`) for any major design change.
