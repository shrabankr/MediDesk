# Database Design & Migration Specification

**Status:** CURRENT (Phase 1 Baseline)

---

## 1. Engine & Configuration

- **Database Engine:** SQLite (via `better-sqlite3`)
- **Journal Mode:** Write-Ahead Logging (`PRAGMA journal_mode = WAL;`)
- **Foreign Keys:** Enabled (`PRAGMA foreign_keys = ON;`)
- **Busy Timeout:** 5000ms (`PRAGMA busy_timeout = 5000;`)
- **Storage Location:** Platform AppData (`%APPDATA%/MediDesk/data/medidesk.sqlite` on Windows). Never inside the source repository.

---

## 2. Phase 1 Schema Entity-Relationship Model

```
+------------------+           +-------------------+
|  organizations   |<----------|       users       |
|------------------| 1       * |-------------------|
| id (PK)          |           | id (PK)           |
| name             |           | organization_id(FK)
| code (UNIQUE)    |           | username (UNIQUE) |
| currency         |           | email (UNIQUE)    |
| timezone         |           | password_hash     |
| created_at       |           | is_active         |
| updated_at       |           | is_locked         |
+------------------+           +-------------------+
                                         |
                                         | *
                               +-------------------+
                               |    user_roles     |
                               |-------------------|
                               | user_id (PK, FK)  |
                               | role_id (PK, FK)  |
                               +-------------------+
                                         |
                                         | *
                               +-------------------+
                               |       roles       |
                               |-------------------|
                               | id (PK)           |
                               | name (UNIQUE)     |
                               | description       |
                               | is_system         |
                               +-------------------+
                                         |
                                         | *
                               +-------------------+
                               | role_permissions  |
                               |-------------------|
                               | role_id (PK, FK)  |
                               | permission_id(FK) |
                               +-------------------+
                                         |
                                         | *
                               +-------------------+
                               |    permissions    |
                               |-------------------|
                               | id (PK)           |
                               | code (UNIQUE)     |
                               | name              |
                               | category          |
                               +-------------------+

+------------------+           +-------------------+
|   audit_events   |           | application_state |
|------------------|           |-------------------|
| id (PK)          |           | key (PK)          |
| action           |           | value             |
| actor_id         |           | updated_at        |
| actor_username   |           +-------------------+
| result           |
| timestamp        |
+------------------+
```

---

## 3. Migration Mechanism

- Migration scripts are located in `database/migrations/` (e.g. `001_initial_schema.sql`).
- Executed inside transactions by `MigrationRunner`.
- Applied versions tracked with SHA256 checksums in `_schema_migrations`.
