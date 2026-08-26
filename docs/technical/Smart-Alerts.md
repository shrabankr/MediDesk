# Smart Alerts & Notification System

## Overview
MediDesk Phase 8 provides a centralized, non-intrusive alert system categorizing operational telemetry across Inventory, Sales, Clinical OPD, and System Infrastructure.

## Architecture
- **Engine:** `SmartAlertService` (`@medidesk/application`)
- **Persistence:** `system_alerts` and `alert_configurations` tables (`@medidesk/database`)
- **Deduplication:** SHA-256 idempotency key prevents repeated notifications for the same event on the same day.
- **Snooze Support:** Users can snooze advisory alerts for 24 hours.

## Safety & Developer Isolation Invariants
1. **Mandatory Safety Controls:** Cannot be disabled or silenced (e.g. Expired batch dispensing attempts).
2. **Developer Isolation:** Developer accounts only receive `SYSTEM` category alerts (disk space, backup status, LAN connection). Clinical and financial alerts are filtered out.
