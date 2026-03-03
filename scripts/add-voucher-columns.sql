-- Migration: Add voucher_number to products table
-- Run this once in your Supabase SQL Editor

-- 1. Add voucher_number column to products (unique per business)
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS voucher_number TEXT DEFAULT NULL;

-- 2. Optional: unique index so no two active products share a voucher
CREATE UNIQUE INDEX IF NOT EXISTS products_voucher_number_key
  ON products (business_id, voucher_number)
  WHERE voucher_number IS NOT NULL;

-- NOTE: The app auto-generates VCH-YYYYMMDD-NNNN for new products
-- and backfills existing ones on first load.

-- The reference_number column on transactions already exists and is
-- used for customer receipt ref numbers (REF-YYYYMMDD-NNNN).
-- No schema changes needed for transactions.
