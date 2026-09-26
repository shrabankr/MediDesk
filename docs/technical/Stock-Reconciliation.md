# Technical Specification: Physical Inventory Reconciliation & Stock Audit

## 1. Overview
Physical Inventory Reconciliation allows pharmacy staff and clinic owners to conduct physical counts of medicine batches, detect stock variances (surplus, damage, shrinkage, expiry disposal), and post non-destructive compensating adjustments to the inventory ledger.

---

## 2. Schema Architecture (`009_phase9_inventory_reconciliation.sql`)

### `stock_reconciliation_sessions`
- `id` (UUID Primary Key)
- `organization_id` (Foreign Key $\rightarrow$ `organizations.id`)
- `session_number` (`REC-YYYYMMDD-XXXX` unique readable identifier)
- `status` (`DRAFT`, `COUNTED`, `SUBMITTED`, `APPROVED`, `REJECTED`, `POSTED`)
- `counted_by`, `counted_at`, `submitted_by`, `submitted_at`, `reviewed_by`, `reviewed_at`, `posted_at`
- `notes`, `review_notes`

### `stock_reconciliation_items`
- `id` (UUID Primary Key)
- `session_id` (Foreign Key $\rightarrow$ `stock_reconciliation_sessions.id`)
- `product_id` (Foreign Key $\rightarrow$ `medicine_products.id`)
- `batch_id` (Foreign Key $\rightarrow$ `inventory_batches.id`)
- `system_stock_quantity` (Base units at count time)
- `physical_stock_quantity` (Counted base units)
- `variance_quantity` ($\text{physical} - \text{system}$)
- `variance_reason` (`AUDIT_CORRECTION`, `DAMAGE`, `EXPIRY_DISPOSAL`, `SHRINKAGE`, `OTHER`)
- `is_large_variance` (Flagged if $|\Delta| \ge 20$ or $|\Delta| / \text{SystemQty} \ge 20\%$)
- `packaging_unit_name`, `packaging_unit_quantity`
- `posted_stock_movement_id` (Foreign Key $\rightarrow$ `stock_movements.id`)

---

## 3. Concurrency & Compensation Invariant
When an Owner approves a reconciliation:
1. Live batch quantity $Q_{\text{live}}$ is loaded inside a transaction (`BEGIN IMMEDIATE`).
2. Target quantity is computed: $Q_{\text{target}} = Q_{\text{live}} + \Delta$.
3. If $Q_{\text{target}} < 0$, reconciliation is rejected with `NegativeStockError` to prevent inventory corruption.
4. Compensating ledger movement is generated:
   - $\Delta > 0 \rightarrow$ `ADJUSTMENT_IN`
   - $\Delta < 0, \text{Reason} = \text{DAMAGE} \rightarrow$ `DAMAGED_WRITE_OFF`
   - $\Delta < 0, \text{Reason} = \text{EXPIRY_DISPOSAL} \rightarrow$ `EXPIRED_DISCARD`
   - $\Delta < 0, \text{Other} \rightarrow$ `ADJUSTMENT_OUT`
5. Historical `inventory_batches` and past movements remain immutable.

---

## 4. RBAC & Security Boundaries
- **Staff:** Permitted to create count sessions, record item quantities, and submit for Owner review. Denied approval and posting.
- **Owner:** Full authority to approve/reject sessions and execute ledger adjustments.
- **Developer:** 100% isolated. Zero permissions for reconciliation, batches, or pharmacy data.
