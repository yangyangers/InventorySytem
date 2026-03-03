-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: SKU / Voucher / Reference Number Redesign
-- Run this once in your Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════
--
--  SKU         → Identifies a product/material  (stored on products table)
--  Voucher #   → Identifies a Stock IN document  (stored on transactions)
--  Reference # → Identifies a customer receipt   (stored on transactions)
--
-- ───────────────────────────────────────────────────────────────────────────

-- 1. Ensure transactions has a voucher_number column (for Stock IN)
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS voucher_number TEXT DEFAULT NULL;

-- 2. Ensure transactions has a reference_number column (for Stock OUT / receipts)
--    (this column likely already exists — IF NOT EXISTS makes it safe)
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS reference_number TEXT DEFAULT NULL;

-- 3. Ensure transactions has sale detail columns
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS date_of_sale    DATE    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS customer_name   TEXT    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS customer_phone  TEXT    DEFAULT NULL;

-- 4. The voucher_number column on products is no longer needed for new records.
--    We leave it in place so existing data is not lost, but the app no longer
--    writes to it. You may drop it later with:
--    ALTER TABLE products DROP COLUMN IF EXISTS voucher_number;

-- 5. Indexes for fast lookups
CREATE INDEX IF NOT EXISTS transactions_voucher_number_idx   ON transactions (voucher_number)   WHERE voucher_number   IS NOT NULL;
CREATE INDEX IF NOT EXISTS transactions_reference_number_idx ON transactions (reference_number) WHERE reference_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS products_sku_name_idx             ON products     (business_id, name);
