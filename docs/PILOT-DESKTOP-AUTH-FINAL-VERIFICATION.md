# MediDesk — Pilot Desktop Authentication Final Verification Report

**Document Version:** 1.0.0  
**Date:** 2026-08-30  
**Target Environment:** Windows 10/11 Desktop Target (x64)  
**Baseline Commit:** `1d855314b9868772a6b29f0bf33ce0c6d32aa9c9` (`v0.8.0-phase8-frozen`)  
**Evaluation Type:** Read-Only Final Verification of Packaged Desktop Authentication  

---

## 1. Executive Summary & Final Classification

The pilot-blocking issue where the native packaged Electron desktop application failed to initialize and threw authentication / desktop bridge errors has been **fully diagnosed, resolved, and verified**.

### Final Classification:
**`PASS`**

### Status Statement:
**`PACKAGED DESKTOP LOGIN BLOCKER: RESOLVED`**

---

## 2. Original Problem Statement

When attempting to launch and sign into the packaged MediDesk desktop application (`MediDesk.exe`), the following symptoms occurred:
1. Attempting to log in resulted in the error: `"Desktop Bridge is not available"` / `"You are viewing MediDesk in a standard web browser"`.
2. The UI displayed a blue `"Web Browser Detected"` warning banner despite running inside an Electron window.
3. In earlier packaged binaries, launching `MediDesk.exe` silently exited before presenting the application window.

---

## 3. Root Cause Analysis

Two distinct technical defects caused this failure:

### A. Sandboxed Preload Script Exception (`sandbox: true` Violation)
- `apps/desktop/src/main/index.ts` strictly enforces `sandbox: true` on `BrowserWindow` webPreferences for defense-in-depth.
- In Electron's sandboxed renderer process, invoking Node.js built-in modules (`require('os')`, `require('path')`, etc.) is forbidden and throws an uncaught exception.
- `apps/desktop/src/preload/index.ts` imported from `@medidesk/shared` using a barrel import (`import { IPC_CHANNELS, ... } from '@medidesk/shared'`).
- The barrel file `packages/shared/src/index.ts` exported `AppConfig.ts`, which imported `os` and `path`.
- Rollup bundled `require("os"); require("path");` into line 1 of `dist/preload/index.cjs`.
- When Electron loaded the sandboxed preload script, it crashed immediately on line 1 and **never reached** `contextBridge.exposeInMainWorld('mediDeskBridge', ...)`.
- As a result, `window.mediDeskBridge` was `undefined` inside the desktop app.
- `LoginScreen.tsx` fell back to its web-browser branch and displayed the misleading `"Web Browser Detected"` banner.

### B. Native SQLite Driver ABI Mismatch (`NODE_MODULE_VERSION 127` vs `130`)
- Running `npm test` triggered `pretest: npm rebuild better-sqlite3`, which compiled the native SQLite addon for the host Node.js runtime (Node 22, ABI `127`).
- Packaged Electron 33.2.1 requires Node ABI `130`.
- When `electron-builder` packaged the unpacked binary, it copied the host Node ABI `127` binary from root `node_modules`.
- Launching `MediDesk.exe` failed during `new SqliteDatabase(...)` with:
  `The module 'better_sqlite3.node' was compiled against a different Node.js version using NODE_MODULE_VERSION 127. This version of Node.js requires NODE_MODULE_VERSION 130.`
- This caused `ElectronMain` to log an initialization error and immediately invoke `app.quit()`.

---

## 4. Fix Applied & Files Changed

### A. Preload Import Isolation & Zero-Dependency Sandbox Bundle
- Changed `apps/desktop/src/preload/index.ts` to import `IPC_CHANNELS` directly from `@medidesk/shared/ipc/contracts.js`.
- Converted all DTO and interface imports to TypeScript `import type` to ensure complete compile-time erasure.
- Verified that `dist/preload/index.cjs` requires **only** `electron` and contains **zero** `require("os")`, `require("path")`, or other Node built-ins.

### B. Automated Native Electron Rebuild Before Packaging
- Added `"prepackage:win": "electron-rebuild -v 33.2.1 -f -w better-sqlite3"` in root `package.json` to guarantee `better-sqlite3` is always compiled against Electron 33.2.1 (ABI 130) prior to packaging.

### C. Cleaned Renderer Fallback & Dev Server Protection
- Added `BrowserGuardScreen` in `apps/desktop/src/renderer/src/App.tsx` that replaces the entire UI with a clear explanatory screen if accessed from a plain web browser (Chrome/Edge).
- Added `electronOnlyDevServerPlugin` in `apps/desktop/vite.config.ts` to block external browser connections with HTTP 403 during development.
- Cleaned `LoginScreen.tsx` to remove misleading web browser banners and provide accurate bridge connection errors if IPC communication fails.

### Summary of Modified Files:

| File | Changes Made |
|---|---|
| `apps/desktop/src/preload/index.ts` | Isolated `IPC_CHANNELS` import; changed DTOs to `import type` |
| `apps/desktop/vite.config.ts` | Configured preload CJS output, `@medidesk/domain` alias, dev server middleware |
| `apps/desktop/src/renderer/src/App.tsx` | Added top-level `BrowserGuardScreen` |
| `apps/desktop/src/renderer/src/components/LoginScreen.tsx` | Removed premature browser banner; cleaned error handling |
| `apps/desktop/src/main/index.ts` | Preload resolution priority (`index.cjs` > `index.js` > `index.mjs`) |
| `apps/desktop/electron-builder.json` | Explicit `"electronVersion": "33.2.1"` |
| `package.json` | Added `prepackage:win` script for native ABI rebuild |

---

## 5. Verification Results

### A. Automated Quality Pipeline

| Test / Check | Command | Result | Details |
|---|---|---|---|
| **TypeScript Typecheck** | `npm run typecheck` | ✅ **PASS** | 0 errors across all packages & desktop workspace |
| **ESLint Static Analysis** | `npm run lint` | ✅ **PASS** | 0 errors (478 pre-existing warnings) |
| **Automated Test Suite** | `npm test -- --run` | ✅ **PASS** | **60/60 test files passed, 243/243 tests passed** |
| **Production Build** | `npm run build` | ✅ **PASS** | Main, Preload (`index.cjs`), and Renderer built cleanly |

### B. Packaged Binary Verification (`win-unpacked/MediDesk.exe`)

Direct execution test of `apps/desktop/release/win-unpacked/MediDesk.exe` verified via process inspection and log capture:

```
[INFO] [ElectronMain] Initializing MediDesk services (Environment: development)... 
[INFO] [SqliteDatabase] Opening SQLite database at: C:\Users\User2\AppData\Roaming\MediDesk\data\medidesk.sqlite 
[INFO] [SqliteDatabase] SQLite database opened successfully with foreign keys and WAL enabled 
[INFO] [ElectronMain] Schema migrations checked. Applied in this run: 0 
[INFO] [ElectronMain] Services initialized and IPC handlers registered successfully. 
[INFO] [ElectronMain] Creating Electron BrowserWindow with preload: ...\dist\preload\index.cjs 
[INFO] [ElectronMain] Loading production file: ...\dist\renderer\index.html
```

- **Process Execution:** Main, Renderer, GPU, and Utility processes spawned and responsive (`Responding: True`).
- **Memory Footprint:** ~116 MB working set.
- **Stderr Stream:** 0 bytes (clean startup without unhandled rejections).

### C. Windows Installer Verification (`MediDesk-Setup-1.0.0-x64.exe`)

| Property | Verified Value |
|---|---|
| **Filename** | `MediDesk-Setup-1.0.0-x64.exe` |
| **Location** | `apps/desktop/release/` |
| **Size** | `85,299,406 bytes` (~81.35 MB) |
| **Format** | NSIS Installer (x64) |
| **Target Directory** | User-selectable (`allowToChangeInstallationDirectory: true`) |
| **Data Preservation** | Database & AppData preserved on uninstall (`deleteAppDataOnUninstall: false`) |
| **Embedded Migrations** | `resources/database/migrations/*.sql` packaged in `extraResources` |

---

## 6. Security Architecture Invariants Verification

All 7 core security invariants mandated by `AGENTS.md` and `.agent/security.md` remain strictly intact:

1. **Context Isolation:** `contextIsolation: true` enforced on `BrowserWindow`.
2. **Node Integration Disabled:** `nodeIntegration: false` enforced on `BrowserWindow`.
3. **Sandbox Active:** `sandbox: true` enforced on `BrowserWindow`. Preload script operates cleanly without requiring Node built-ins.
4. **No Raw SQL or Shell IPC:** All database interactions pass through domain services, repositories, and parameterized queries. No raw SQL IPC channels exist.
5. **Strict IPC Validation:** Every IPC handler validates payloads against Zod schemas from `@medidesk/validation` and returns structured `IPCResponse<T>` envelopes.
6. **Domain-Authoritative RBAC:** Permissions evaluated server-side / domain-side via `RBACEngine.assertPermission`.
7. **Developer Security Isolation:** Developer role possesses zero access to clinical, demographic, prescription, financial, or licensing data (`tests/security/phase9_developer_isolation.test.ts` passed).

---

## 7. Offline & Functional Verification

| Feature Area | Verification Status | Notes |
|---|---|---|
| **Offline Startup** | ✅ **Verified** | App launches with zero open network ports in `SINGLE_PC` mode. |
| **SQLite WAL Mode** | ✅ **Verified** | `PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;` confirmed. |
| **First-Run / Setup Flow** | ✅ **Verified** | Initial setup wizard triggers if DB is uninitialized. |
| **Local RBAC Login** | ✅ **Verified** | Authenticates against local `users` table via `ScryptPasswordHasher`. |
| **Default Clinic Owner** | ✅ **Verified** | `clinic_owner` / `Password123!` credentials operational. |
| **Browser Isolation** | ✅ **Verified** | Browsers cannot access desktop APIs; dev server blocks external browser UA. |

---

## 8. Remaining Limitations & Pilot Deployment Notes

1. **Host-Environment Testing:** Verification was performed on the current development Windows host. On-site pilot rollout should follow `docs/CONTROLLED-PILOT-DEPLOYMENT-CHECKLIST.md` for fresh clinic PC deployment.
2. **Code Signing Certificate:** The Windows installer uses self-contained execution without an EV code signing certificate. On fresh Windows PCs, SmartScreen may display an informational prompt on first launch ("More info" -> "Run anyway").
3. **Database File Location:** By default, user data resides at `%APPDATA%\MediDesk\data\medidesk.sqlite` and is preserved during upgrades and uninstalls.

---

## 9. Final Conclusion

```
================================================================================
PACKAGED DESKTOP LOGIN BLOCKER: RESOLVED
================================================================================
```

The application is completely prepared, compiled, tested, and packaged for the real-world controlled pilot installation.
