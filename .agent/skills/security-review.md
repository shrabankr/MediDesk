# Operational Skill: Security Review Checklist

Use this checklist during every phase review, feature refactor, or release preparation.

---

## Security Audit Checklist

### 1. Authentication & Session Security
- [ ] Passwords hashed using `ScryptPasswordHasher` with unique 16-byte salts.
- [ ] Session tokens generated using 32 bytes of cryptographically secure randomness (`crypto.randomBytes(32)`).
- [ ] Session expiration strictly enforced (24 hours standard).
- [ ] Failed login attempts tracked; accounts locked after consecutive failures.
- [ ] Last-active-Owner account cannot be deleted or deactivated.

### 2. Role-Based Access Control (RBAC) & Authority Isolation
- [ ] All permission checks enforced in domain/application services via `RBACEngine`.
- [ ] No client UI bypass possible; backend rejects unauthorized actions.
- [ ] `DEVELOPER` role has **zero** access to clinical, patient, prescription, pharmacy, or financial records.
- [ ] `DEVELOPER` cannot activate commercial customer licenses or execute database restores.
- [ ] Audit log recorded for all privilege grants, role changes, and administrative actions.

### 3. Electron Process Isolation & IPC Security
- [ ] `contextIsolation: true` and `nodeIntegration: false` enabled.
- [ ] `sandbox: true`, `webSecurity: true`, `allowRunningInsecureContent: false`.
- [ ] CSP headers restrict remote scripts and object execution.
- [ ] All IPC handlers validate incoming requests via `@medidesk/validation` Zod schemas.
- [ ] No raw SQL IPC channels (`executeSQL`, `query`, etc.) exist.
- [ ] No shell/process execution IPC channels (`exec`, `spawn`) exist.
- [ ] Preload exposes only explicit bridge functions via `contextBridge.exposeInMainWorld`.

### 4. Database & Storage Security
- [ ] SQLite connection enforces `PRAGMA foreign_keys = ON;` and `PRAGMA journal_mode = WAL;`.
- [ ] All queries use parameterized statements (`prepare('... WHERE id = ?').get(id)`).
- [ ] No SQL injection vectors or dynamic SQL string concatenation.
- [ ] Database files never placed on SMB/network shares.

### 5. LAN & Network Security
- [ ] Network transport uses TLS 1.3 with self-signed certificate generation and fingerprint pinning.
- [ ] Workstation pairing uses 6-digit one-time PIN (10-minute expiry) and requires Owner approval.
- [ ] All requests signed with HMAC-SHA256 device tokens (`X-Device-Signature`).
- [ ] Freshness window ($\pm 300\text{s}$) and anti-replay nonce cache enforced.
- [ ] Device revocation immediately blocks all subsequent requests from that workstation.

### 6. Hybrid Backup & Restore Security
- [ ] Backups encrypted using AES-256-GCM with 256-bit key derived via `scrypt`.
- [ ] Ciphertext includes `MEDIDESK_ENC_V1` header, IV, salt, and authentication tag.
- [ ] SHA-256 sidecar checksum verified prior to restore.
- [ ] Mandatory `PRE_RESTORE_SAFETY` backup created before any database replacement.
- [ ] Plaintext SQLite files are never uploaded to Google Drive.

### 7. Licensing Security
- [ ] Offline cryptographic verification uses asymmetric digital signatures (Ed25519/HMAC).
- [ ] Expired license blocks writes while keeping historical data read-only and printable.
- [ ] License checks cannot be bypassed by client-side clock tampering or UI state manipulation.
