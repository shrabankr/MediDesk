# ADR-010: Future Local Area Network (LAN) Architecture

## Status
Accepted (`FUTURE (Phase 8)`)

## Context
Larger clinics operate multiple computers (e.g. reception desk, doctor consultation room, pharmacy counter) connected on a local Wi-Fi / Ethernet LAN.

## Decision
- For multi-PC LAN deployments, the primary host computer will run a dedicated local server application with PostgreSQL.
- Workstations will run the MediDesk client communicating over HTTPS/gRPC to the host server.
- **NEVER** share an SQLite database file over Windows SMB / shared network drives (which causes database corruption).

## Consequences
- Preserves data consistency and avoids concurrency corruption across multiple LAN terminals.
