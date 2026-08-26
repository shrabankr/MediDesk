# ADR-020: Hybrid Offline-First & Google Drive Cloud Backup Architecture

## Status
**ACCEPTED & FROZEN** (Phase 6 Core Feature)

## Context
MediDesk is designed for medical shops and clinics in tier-2/tier-3 Indian towns with frequent power disruptions and intermittent internet connectivity. At the same time, clinics face physical hardware disaster risks (hardware theft, drive crashes, water damage, ransomware).

A pure local backup leaves the clinic vulnerable to physical hardware loss, while a pure cloud backup fails during network outages or slows down critical POS workflows.

## Decision
MediDesk adopts a **Hybrid Backup Architecture** operating as follows:

1. **Modes of Operation**:
   - `HYBRID` (Default & Recommended): Immediate, atomic local encrypted snapshot followed by opportunistic, background Google Drive upload.
   - `LOCAL_ONLY`: Pure offline encrypted local snapshots with zero network calls.
   - `CLOUD_ONLY`: Uploads to Google Drive and purges local copy after cloud verification succeeds.

2. **Critical Invariant**:
   - **Google Drive failure MUST NEVER cause local backup failure.**
   - If internet is unavailable or Google OAuth is expired, the local backup completes with `localStatus: 'SUCCESS'`, cloud is queued as `cloudStatus: 'PENDING'`, and overall state is `PARTIAL`.

3. **Single Encrypted Artifact**:
   - Both local and Google Drive copies store the exact same authenticated ciphertext artifact (`MEDIDESK_ENC_V1` header + AES-256-GCM + scrypt key derivation + SHA-256 sidecar).
   - Plaintext SQLite databases are **never** uploaded to external servers.

4. **Idempotency & Duplicate Prevention**:
   - Backups are indexed by an immutable `backup_id`.
   - Re-uploading or retrying pending cloud backups reuses the existing verified local `.enc` artifact without database recreation.
   - Google Drive search by name/properties prevents duplicate remote files.

5. **Mandatory Pre-Restore Safety Snapshot**:
   - Every restore operation (local or cloud) creates a `PRE_RESTORE_SAFETY` snapshot of the active database before overwriting files. If decryption or SQLite integrity checks fail, the live database is preserved.

## Consequences
- **Positive:** Complete physical and disaster resilience without compromising offline reliability. Zero internet dependency for normal billing and clinical operations.
- **Security:** AES-256-GCM authenticated encryption guarantees confidentiality and integrity off-site.
- **Compliance:** Patient Data Retention Invariant is upheld; audit trails record all backup, upload, and restore lifecycles.
