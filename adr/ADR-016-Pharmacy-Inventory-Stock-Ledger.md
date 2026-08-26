# ADR-016: Pharmacy Inventory Stock Ledger & Base Unit Accounting

## Status
Accepted (Phase 5)

## Context
A small Indian medical shop requires rigorous inventory tracking that complies with Indian drug laws, prevents stock discrepancy, protects against negative stock, and provides full auditability. Modifying inventory by simply running `UPDATE batches SET quantity = quantity - 1` without ledger history leads to untraceable stock drift. Furthermore, medicines are purchased in bulk packs/strips but often dispensed in individual tablets, capsules, or ml.

## Decision
1. **Base Unit Canonical Accounting**: All inventory batches (`inventory_batches`) and stock movement records (`stock_movements`) store stock strictly in **base units** (e.g. single tablet, capsule, ml, vial).
2. **Pack Size Multipliers**: Product variants (`medicine_products`) define `pack_quantity` (e.g. 10 tablets/strip). When purchase invoices are inwarded, the system multiplies $(\text{pack\_quantity} + \text{free\_packs}) \times \text{pack\_multiplier} \rightarrow \text{total base units}$.
3. **Append-Only Stock Ledger**: Every inventory alteration (Purchases, POS Sales, Sales Returns, Purchase Returns, Adjustments, Expiry Discards) atomically writes an immutable entry into `stock_movements` recording:
   - `movement_type`
   - `quantity_change` ($\pm \Delta$)
   - `balance_after`
   - `reference_type` and `reference_id`
   - `created_by` and audit notes
4. **Strict Negative Stock Invariant**: If an operation would cause $\text{balance\_after} < 0$, it is rejected with `NegativeStockError` / `InsufficientStockError`.

## Consequences
- **Positive**: 100% auditable inventory history, zero stock leakage, robust reconciliation.
- **Trade-off**: Requires database transaction handling for all inventory mutation endpoints.
