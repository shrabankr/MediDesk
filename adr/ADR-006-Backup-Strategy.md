# ADR-006: Local and Cloud Backup Strategy

## Status
Accepted (`CURRENT (Local Interface)` / `FUTURE (Cloud Replication)`)

## Context
Clinic data integrity is critical. Loss of local disk or hardware failure must be recoverable quickly without requiring continuous Internet connectivity.

## Decision
- Implement a two-tiered backup architecture via `IBackupService`.
- **Tier 1 (Local Snapshot):** Generates local point-in-time database snapshots with SHA-256 integrity checksums directly on the local filesystem.
- **Tier 2 (Cloud Backup):** Asynchronous upload of encrypted backup archives to Google Drive when an Internet connection is present.

## Consequences
- Normal clinic operations never block on Internet availability.
- Backups are verifiable offline through hash validation.
