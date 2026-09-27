# MediDesk 🩺💊

> **Offline-First Clinical Practice Management, Electronic Health Records (EHR) & Pharmacy POS Platform**

[![Electron](https://img.shields.io/badge/Electron-33.2.1-47848F?logo=electron&logoColor=white)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-18.3.1-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6.3-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![SQLite](https://img.shields.io/badge/SQLite-WAL_Mode-003B57?logo=sqlite&logoColor=white)](https://sqlite.org/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.4.16-38B2AC?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Tests](https://img.shields.io/badge/Tests-277_Passed_(100%25)-brightgreen?logo=vitest&logoColor=white)](https://vitest.dev/)
[![Platform](https://img.shields.io/badge/Platform-Windows_10%2F11-0078D6?logo=windows&logoColor=white)](https://microsoft.com/windows)

MediDesk is an offline-first desktop application built for private medical clinics, multi-doctor polyclinics, and attached retail pharmacies. Engineered for resilience, MediDesk guarantees 100% operational uptime without continuous internet connectivity, zero vendor lock-in, and tamper-evident local data custody.

---

## 🌟 Key Highlights & Architectural Invariants

- **Offline-First & Single-Custodian Persistence:** All clinical, pharmacy, and financial records reside in an embedded SQLite database using Write-Ahead Logging (WAL mode), serialized transactions (`BEGIN IMMEDIATE`), and enforced foreign keys.
- **Zero-Trust Multi-Workstation LAN Synchronization:** Workstations (Doctor, Reception, POS) operate in a secure local mesh over TLS 1.3 with PIN pairing, pinned SHA-256 certificate fingerprints, and HMAC-SHA256 request signing with anti-replay caches.
- **Indian Healthcare & GST Compliance:** Native support for Indian drug schedules (Schedule H, H1, X, General/OTC), HSN tax codes, multi-tier GST rates (0%, 5%, 12%, 18%, 28%), and integer-Paise financial calculations (`Math.round(rupees * 100)`) preventing floating-point drift.
- **Role-Based Access Control (RBAC):** Strict domain-enforced separation across `OWNER`, `DOCTOR`, `STAFF`, and `DEVELOPER` roles. Developers are strictly isolated with zero access to clinical, patient, or financial data.
- **Disaster Recovery & Hybrid Backups:** Automated AES-256-GCM encrypted local snapshots with opportunistic Google Drive cloud sync and mandatory pre-restore safety snapshots.
- **Staged Bulk Data Import/Export:** Guarded 7-step CSV import engine with auto-column mapping, formula injection defense, pre-flight validation, and duplicate handling for Patients, Doctors, Medicines, Inventory, and Suppliers.

---

## 🏛️ Monorepo Architecture

MediDesk strictly enforces unidirectional dependency flow and clean architecture across workspaces:

```
[ apps/desktop ] (Electron Main, Sandboxed Preload Bridge, React Renderer)
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

### Monorepo Workspaces

| Package | Directory | Role & Boundary |
|---|---|---|
| **`@medidesk/desktop`** | `apps/desktop` | Electron target packaging: sandboxed main process, typed context bridge, and Vite React renderer. |
| **`@medidesk/domain`** | `packages/domain` | Pure TypeScript entities, repository interfaces, value objects, and domain errors (**Zero external dependencies**). |
| **`@medidesk/application`** | `packages/application` | Business orchestration use cases (`PatientService`, `PrescriptionService`, `BulkDataImportService`, `StockReconciliationService`). |
| **`@medidesk/authorization`**| `packages/authorization` | Server-side `RBACEngine`, permission matrices, sole-owner lockout protection, and developer isolation rules. |
| **`@medidesk/database`** | `packages/database` | SQLite database manager (`SqliteDatabase`), migration runner, and concrete repository implementations. |
| **`@medidesk/validation`** | `packages/validation` | Zod schemas for all IPC payloads, DTOs, and system configurations. |
| **`@medidesk/audit`** | `packages/audit` | Immutable tamper-evident audit logging for clinical, financial, and security actions. |
| **`@medidesk/backup`** | `packages/backup` | Hybrid backup engine (Local/Cloud), AES-256-GCM encryption, and safe disaster restore. |
| **`@medidesk/lan`** | `packages/lan` | TLS 1.3 embedded LAN server, workstation PIN pairing, and HMAC request signing. |
| **`@medidesk/printing`** | `packages/printing` | Thermal POS receipts (58mm/80mm) and A4/A5 prescription generation and silent printing. |
| **`@medidesk/licensing`** | `packages/licensing` | 60-day trial provisioning and offline Ed25519 cryptographic license verification. |
| **`@medidesk/shared`** | `packages/shared` | Cross-layer constants, IPC channel definitions, and structured logger. |
| **`@medidesk/ui`** | `packages/ui` | Shared React design system primitives and styling components. |

---

## 🚀 Module Overview

### 1. Patient Directory & Queue Management
- Fast search across UHID (e.g., `MD-000001`), patient name, and mobile number.
- Soundex-based phonetic and mobile duplicate patient detection with warning overrides.
- Token-based daily outpatient queue management.

### 2. Clinical Consultations & Electronic Prescriptions
- Recording of vitals (Blood Pressure, Pulse, SpO2, Temperature, Weight, BMI).
- Chief complaints, clinical findings, provisional/final diagnoses with ICD-10 search.
- Drug allergy tracking with severe contraindication warnings during prescription authoring.
- Generic molecule suggestions, dosage schedules, duration, and digital doctor signatures.
- Export and silent printing to standard A4/A5 clinical prescription layouts.

### 3. Pharmacy POS & Billing
- Fast barcode scanning and batch-level stock selection.
- FEFO (First-Expired, First-Out) batch allocation with near-expiry alerts.
- Automatic GST computation with split CGST/SGST breakdown.
- Multi-mode payment settlement (Cash, UPI, Card, Split Payment).
- GST-compliant invoice generation and 58mm/80mm ESC/POS thermal printing.

### 4. Inventory, Batches & Physical Stock Reconciliation
- Real-time stock ledger tracking every batch movement (Inward, Dispensed, Returned, Adjusted).
- Physical stock counting and variance calculation with staged approval workflows.
- Minimum stock reorder alerts and expiry quarantine management.

### 5. Staged Bulk Data Onboarding
- Independent onboarding pipelines for Patients, Doctors, Medicines, Opening Stock, Suppliers, and Barcodes.
- Auto-detection and mapping of arbitrary spreadsheet column headers to domain fields.
- Pre-flight validation with issue counters (`Ready to Add`, `Ready to Update`, `Invalid`, `Duplicates`).
- Transactional execution ensuring zero partial corruption.

---

## 🛠️ Prerequisites & Setup

### Requirements
- **OS:** Windows 10/11 (64-bit)
- **Node.js:** `>= 20.18.0` (LTS recommended)
- **Package Manager:** `npm >= 10.8.0`
- **Build Tools:** Python 3.x and Visual Studio C++ Build Tools (required for native `better-sqlite3` compilation)

### Quick Start

1. **Clone the repository:**
   ```bash
   git clone git@github.com:shrabankr/MediDesk.git
   cd MediDesk
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Rebuild native SQLite bindings for Electron:**
   ```bash
   npm run predev
   ```

4. **Launch development environment:**
   ```bash
   npm run dev
   ```

---

## 🧪 Testing & Verification

MediDesk maintains a **100% test pass rate** across unit, integration, and security test suites:

```bash
# Run all automated tests (64 test files, 277 tests)
npm test

# Run unit tests only
npm run test:unit

# Run integration workflow tests
npm run test:integration

# Run security & RBAC isolation tests
npm run test:security

# TypeScript strict typechecking (0 errors)
npm run typecheck

# Code formatting and ESLint inspection (0 errors)
npm run lint
```

---

## 📦 Building for Production

To build the production Electron bundle and packaged Windows executable:

```bash
# Build React renderer, Electron main, and preload bundles
npm run build

# Package standalone Windows executable & setup installer
npm run package:win
```

Packaged outputs:
- **Standalone Unpacked Directory:** `apps/desktop/release/win-unpacked/MediDesk.exe`
- **Windows Setup Installer:** `apps/desktop/release/MediDesk-Setup-1.0.0-x64.exe`

---

## 🔒 Security Architecture

- **Electron Context Isolation:** All renderer windows execute with `contextIsolation: true`, `nodeIntegration: false`, and `sandbox: true`. Direct Node.js APIs (`fs`, `child_process`, `net`) are inaccessible from renderer code.
- **IPC Safety:** All IPC communication passes through typed, validated channels using `@medidesk/validation` Zod schemas. Raw SQL queries and shell command execution over IPC are strictly prohibited.
- **Data Protection:** Database files are encrypted at rest during backup creation using AES-256-GCM with key derivation via scrypt.
- **Developer Restraint Rule:** Developer role credentials have zero access to clinical, prescription, or financial tables, and cannot bypass RBAC checks.

---

## 📄 License & Governance

- **License:** Proprietary / Commercial License. All rights reserved.
- **Engineering Guidelines:** Detailed developer invariants, database migration rules, and architecture governance are codified in [`AGENTS.md`](./AGENTS.md).
- **Architecture Decision Records:** Full system decision logs are documented in [`adr/`](./adr).
