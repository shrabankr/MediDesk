# ADR-026: Physical Inventory Reconciliation & Variance Audit

## Status
Accepted (Phase 9A)

## Context
Periodic physical stock audits are an essential operational requirement for clinical pharmacies. Discrepancies naturally occur due to breakage, physical damage, shelf shrinkage, manufacturer packaging mismatches, or routine counting errors. Overwriting historical stock rows or balance logs destructively destroys financial auditability. Furthermore, if concurrent sales occur between physical counting and Owner approval, naive variance replacement can corrupt inventory levels or create negative stock.

## Decision
1. **Append-Only Compensating Adjustments:** The application never overwrites historical `inventory_batches` or `stock_movements`. Physical reconciliation produces a new compensating transaction record (`ADJUSTMENT_IN`, `ADJUSTMENT_OUT`, `DAMAGED_WRITE_OFF`, `EXPIRED_DISCARD`) referencing the reconciliation session.
2. **Explicit 5-Stage Lifecycle:**
   `DRAFT` $\rightarrow$ `COUNTED` $\rightarrow$ `SUBMITTED` $\rightarrow$ `APPROVED` / `REJECTED` $\rightarrow$ `POSTED`.
3. **Role-Based Authority Enforcement:**
   - Staff members may initiate count sessions, record physical quantities (in base units or packaging units), and submit for review.
   - Only authorized Owners may review, approve, reject, or post reconciliations to the ledger.
   - Developer role is strictly prohibited from accessing, viewing, or approving reconciliation sessions.
4. **Concurrent Stock Change Strategy:**
   When an Owner approves a reconciliation:
   - The system inspects the live current batch stock in SQLite.
   - The target balance is computed by applying the recorded variance delta ($\Delta = \text{physical} - \text{system}_{\text{count-time}}$) to the live stock ($\text{Target} = \text{LiveStock} + \Delta$).
   - If concurrent sales reduced live stock such that $\text{Target} < 0$, the approval is blocked with `NegativeStockError` requiring a recount.
5. **Large Variance Warning Gate:**
   Items with $|\Delta| \ge 20$ or $|\Delta| / \text{SystemQty} \ge 20\%$ are flagged with `isLargeVariance: true` and surfaced with clear warning banners for Owner scrutiny.

## Consequences
- 100% audit compliance and non-destructive historical integrity.
- Safe concurrency handling between dispensing workstations and the audit review process.
- Complete Developer role isolation preserved.
