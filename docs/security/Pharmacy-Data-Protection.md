# Pharmacy Data Protection & RBAC Isolation

## Developer Isolation Rule
Under MediDesk security specifications, system developers and technician accounts must never access patient medical history or sensitive clinic business transactions (sales revenue, supplier costs, purchasing invoices).

### Enforcement Mechanism
1. In `@medidesk/authorization/RoleDefinitions.ts`, all pharmacy permissions are classified under `RESTRICTED_DEVELOPER_PERMISSIONS`.
2. Every pharmacy service (`MedicineMasterService`, `SupplierPurchaseService`, `InventoryService`, `PharmacyBillingService`) calls `assertPermission(actor, permission)` which immediately throws `AuthorizationError` if a Developer attempts access.
3. Automated security tests (`tests/security/pharmacy_rbac.test.ts`) verify that developers cannot read or execute any pharmacy operations.

## Negative Stock Prevention
To protect against untraceable inventory leakage and data corruption:
- Direct mutation of stock is prohibited; all updates occur through the ledger.
- If an adjustment, sale, or cancellation attempts to leave $\text{balance} < 0$, the repository and service layers abort with `NegativeStockError` / `InsufficientStockError`.
- Multi-item sales and inward invoices execute within SQLite ACID transactions (`this.db.transaction(...)`).
