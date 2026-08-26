# Multi-Tier Packaging & Inventory Management

## Overview
MediDesk Phase 8 introduces deterministic multi-tier packaging conversions (e.g. Box $\rightarrow$ Strip $\rightarrow$ Tablet, Bottle $\rightarrow$ ML, Pack $\rightarrow$ Vial) while preserving integer base-unit atomic storage.

## Key Principles
1. **Atomic Indivisible Base Unit:** All batches (`inventory_batches`) and ledger movements (`stock_movements`) store stock strictly as integers representing the smallest indivisible base unit.
2. **Integer Paise Financials:** Package prices and MRPs are stored as integer paise (`sale_price_paise`, `mrp_paise`), preventing floating-point discrepancies.
3. **Deterministic Half-Up Rounding:** Base unit price calculations use explicit half-up integer arithmetic.
4. **Historical Price Snapshotting:** Every POS checkout snapshots the exact transaction price in `sale_items`.
