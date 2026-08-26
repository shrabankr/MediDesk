# Operational Skill: Release & Production Verification Checklist

Follow this checklist prior to freezing any phase, tagging a release, or packaging desktop binaries for Windows distribution.

---

## Release Verification Checklist

### 1. Build & Compilation Verification
- [ ] `npm run typecheck` exits with code `0` (0 TypeScript errors).
- [ ] `npm run lint` exits with code `0` (0 ESLint errors).
- [ ] `npm run build` exits with code `0` (Main, Preload, and Renderer Vite bundles built cleanly).
- [ ] Native binary bindings rebuilt cleanly via `electron-rebuild -f -w better-sqlite3`.

### 2. Automated Test Verification
- [ ] `npm test` executes the complete test suite.
- [ ] 100% of test files pass (50+ suites).
- [ ] 100% of individual tests pass (189+ tests, 0 failures, 0 skipped).
- [ ] Key security and integration tests pass:
  - Role-based access control and Developer isolation tests
  - High-concurrency inventory and POS race condition tests
  - SQLite migration and initialization lifecycle tests
  - LAN pairing, HMAC signature, and anti-replay tests
  - Hybrid backup, AES-GCM encryption, and safe restore tests

### 3. Database & Migration Integrity
- [ ] All migrations (`001` through `007`) execute sequentially without errors.
- [ ] Database operates with `PRAGMA foreign_keys = ON` and `PRAGMA journal_mode = WAL`.
- [ ] Pre-restore safety backup functionality verified.

### 4. Security & Hardening Check
- [ ] No hardcoded secrets, test credentials, or API keys committed in source code.
- [ ] `.env` and SQLite runtime files (`*.sqlite`, `*.sqlite-wal`, `*.sqlite-shm`) excluded via `.gitignore`.
- [ ] Electron window settings enforce `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`.
- [ ] CSP headers active on all loaded documents.

### 5. Documentation & Governance
- [ ] All architectural changes recorded in `adr/` directory.
- [ ] Technical documentation updated in `docs/technical/` and `docs/security/`.
- [ ] Artifact `walkthrough.md` updated with full verification outputs.
- [ ] `git status` clean of untracked temporary files.
