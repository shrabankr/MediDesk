# Automated Backup Scheduling

## Overview
MediDesk Phase 8 introduces an automated background backup scheduling daemon integrated into the Electron Main process.

## Scheduling Capabilities
- **Frequencies:** Daily, Weekly, Monthly.
- **Configurable Execution Time:** HH:MM (e.g. `22:00` clinic closing time).
- **Sleep / Wake Catch-Up:** Missed backups during computer sleep/hibernation are detected on system resume and opportunistically executed.
- **Offline Resilience:** Local encrypted backup snapshot (`MEDIDESK_ENC_V1`) succeeds even if Google Drive upload is unavailable or network is disconnected.
