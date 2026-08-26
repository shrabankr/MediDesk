# ADR-023: Smart Alert & Notification Engine

## Status
Accepted (Phase 8)

## Context
Clinical, pharmacy, and system operations require proactive awareness of low inventory, nearing expiry, patient follow-ups, backup statuses, and hardware faults without overwhelming users with noisy, repeated notifications.

## Decision
1. **Three-Tier Alert Classification:**
   - `MANDATORY_SAFETY`: Inviolable domain safety invariants (e.g. Expired batch sale blocked, negative inventory blocked). Cannot be disabled or silenced.
   - `WARNING`: High-severity operational alerts (e.g. Backup failed, low disk space).
   - `ADVISORY`: Configurable business alerts (e.g. Low stock threshold, follow-up due).
2. **SHA-256 Idempotency Deduplication:** Alerts generate deterministic dedup keys (`orgId:alertType:entityId:date`), updating active alerts in-place to prevent notification floods.
3. **Role-Targeted Routing:** Developer role is strictly isolated to `SYSTEM` technical alerts and cannot access clinical or inventory alerts.
4. **Snooze & Lifecycle Management:** Advisory alerts can be acknowledged and snoozed for 24 hours.

## Consequences
- Clean notification center with zero spam.
- Mandatory clinical and pharmacy safety controls cannot be bypassed via user configuration.
- Strict developer data isolation preserved.
