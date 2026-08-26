# Inventory & Stock Movement Ledger Architecture

## Overview
MediDesk implements an append-only, movement-based inventory ledger system where every physical stock modification produces an immutable audit record.

## Invariants & Core Principles

### 1. Base Unit Accounting
All inventory batches and ledger entries track quantities in atomic **base units** (single tablets, capsules, or millilitres).
When inwarding stock from suppliers:
$$\text{Total Base Units} = (\text{Pack Quantity} + \text{Free Packs}) \times \text{Pack Size Multiplier}$$

### 2. Append-Only Stock Movements (`stock_movements`)
Direct mutations of batch quantity without an accompanying movement record are forbidden. Supported movement types:
- `PURCHASE_INWARD`: Stock added from received supplier invoice.
- `SALE_OUTWARD`: Stock deducted upon POS sale completion.
- `SALE_RETURN`: Stock restored upon customer return.
- `PURCHASE_RETURN`: Stock deducted upon returning goods to supplier.
- `ADJUSTMENT_IN`: Stock incremented after physical audit reconciliation.
- `ADJUSTMENT_OUT`: Stock decremented after physical discrepancy.
- `EXPIRED_DISCARD`: Stock removed due to shelf-life expiry.
- `DAMAGED_WRITE_OFF`: Stock written off due to physical breakage/damage.

Each movement records:
- `movement_type`
- `quantity_change` ($\pm \Delta$)
- `balance_after` (computed as $\text{current\_stock} + \Delta$)
- `reference_type` and `reference_id` (linking to sale bill, purchase invoice, etc.)
- `created_by` and audit reasoning

### 3. Strict Negative Stock Invariant
If any operation would cause $\text{current\_stock} + \Delta < 0$, the repository and application service throw `NegativeStockError` / `InsufficientStockError` and abort the transaction.

### 4. Stock Reconciliation Formula
The authoritative stock equation holds across all historical movements:
$$\text{Current Stock} = \text{Opening Stock} + \sum \text{PURCHASE} + \sum \text{ADJ\_IN} + \sum \text{SALE\_RETURN} - \sum \text{SALE} - \sum \text{PUR\_RET} - \sum \text{ADJ\_OUT} - \sum \text{EXPIRED} - \sum \text{DAMAGED}$$
