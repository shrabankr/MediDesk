# Operational Skill: Database Migration Procedure

Follow this 10-step procedure whenever introducing database schema changes to MediDesk.

---

## 10-Step Migration Workflow

1. **Inspect Existing Migrations:**
   - Review `database/migrations/` to determine the latest applied migration number (e.g., `007_lan_devices.sql`).
2. **Understand Schema Dependencies:**
   - Read `docs/technical/Database-Design.md` and check existing foreign key relationships, indices, and constraints.
3. **Create Incremental Migration File:**
   - Name the file sequentially: `database/migrations/00X_<descriptive_name>.sql`.
   - **NEVER** edit released migrations `001` through `007`.
4. **Author Idempotent DDL Statements:**
   - Use `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, or `ALTER TABLE ... ADD COLUMN`.
   - Explicitly specify `FOREIGN KEY (...) REFERENCES ... ON DELETE ...`.
   - Include `created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP` and `updated_at DATETIME`.
5. **Seed Necessary Role Permissions:**
   - If introducing new entity actions, insert corresponding `permissions` and map them to `role_permissions` for default roles.
6. **Update Domain Entities & Repositories:**
   - Update TypeScript interfaces in `@medidesk/domain/src/entities/` and `@medidesk/domain/src/repositories/`.
   - Update concrete SQLite repository classes in `@medidesk/database/src/repositories/`.
7. **Update Validation Schemas:**
   - Update Zod input schemas in `@medidesk/validation`.
8. **Update Migration Unit & Integration Tests:**
   - Add schema verification tests to `tests/integration/sqlite_migration.test.ts` and `tests/integration/initialization.test.ts`.
9. **Execute Full Test Suite & Typecheck:**
   - Run `npm test` and `npm run typecheck` to verify zero regression.
10. **Document Schema Updates:**
    - Update `docs/technical/Database-Design.md` and relevant technical guides.
