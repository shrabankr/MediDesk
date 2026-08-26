# ADR-022: Multi-Tier Packaging & Deterministic Base Unit Inventory

## Status
Accepted (Phase 8)

## Context
In Indian pharmacy retail and clinical practice, medicines are procured, stored, and dispensed in multiple packaging tiers (e.g. Boxes, Strips, Bottles, Vials, and loose Tablets). Standardizing inventory exclusively to packaging units causes fractional quantity errors and accounting discrepancies. Conversely, standardizing without package pricing causes commercial losses.

## Decision
1. **Indivisible Base Unit Principle:** Every medicine SKU defines exactly one indivisible base unit (e.g. `TABLET`, `CAPSULE`, `ML`, `GRAM`, `PIECE`). All internal stock ledgers, batch allocations, and inventory quantities are stored as integers representing base units.
2. **Generic Packaging Units (`product_packaging_units`):** Products support multiple generic packaging tiers with integer conversion factors ($\ge 1$).
3. **Integer Paise Financial Calculations:** All monetary figures (`sale_price_paise`, `mrp_paise`) are stored as integer paise to eliminate floating-point rounding errors.
4. **Deterministic Half-Up Rounding:** Base unit price calculation from package prices uses explicit half-up rounding.
5. **Historical Price Snapshotting:** Sale items snapshot the exact transaction price at checkout and never recompute historically.

## Consequences
- Zero floating-point rounding errors in financial and stock accounting.
- Flexible multi-unit sales (e.g. selling 2 boxes + 3 strips + 4 tablets) with deterministic base-unit deduction.
- FEFO batch allocation continues seamlessly over atomic base units.
