# ADR-019: Deterministic Backup Integrity & Pre-Restore Safety Snapshots

## Status
Accepted and Verified (Phase 6)

## Context
Medical databases require bulletproof protection against accidental data loss, disk corruption, and accidental overwrites during disaster recovery. Because SQLite is a single-file relational database operating in WAL (Write-Ahead Logging) mode, naive file copies during active write operations could result in partial snapshots or corrupted restore points.

Furthermore, restoring an older backup over a live system is an inherently destructive operation that can erase recent transactions if executed incorrectly or with a corrupted backup file.

## Decision
1. **Cryptographic SHA-256 Snapshots & Sidecars**:
   - Every local backup snapshot generates an atomic copy of the SQLite database along with an accompanying `.sha256` sidecar file containing the cryptographic digest.
   - Every backup verifies the 16-byte SQLite header signature (`SQLite format 3`) immediately after generation.
2. **Pre-Restore Safety Snapshots**:
   - The restore engine (`BackupService.restoreBackup`) **never** overwrites a live database file without first creating an automated `PRE_RESTORE_SAFETY` backup of the existing live database file.
   - In the event of a power outage, corrupted restore candidate, or accidental operator error, the prior database state is immediately recoverable from the safety snapshot.
3. **Stale WAL/SHM Invalidation**:
   - When replacing a live database file, any lingering `-wal` and `-shm` files are cleaned up to prevent SQLite from replaying obsolete write transactions onto the restored database file.
4. **Owner-Only Privilege**:
   - Only the Clinic Owner (`role-owner`) is authorized with `system.restore.execute`. Doctors, staff, and third-party developers are strictly denied restore privileges to eliminate malicious or accidental data overwrites.

## Consequences
- **Positive**: Zero risk of unrecoverable database corruption during restore operations; verifiable cryptographic snapshot lineage; complete audit trail of all backup and restore operations.
- **Trade-offs**: Restoring requires sufficient disk space to hold both the live safety backup and the restored database file.
