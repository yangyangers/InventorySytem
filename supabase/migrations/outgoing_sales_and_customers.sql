-- ── Migration: Outgoing sales fields + Customers table ────────────────────────

-- 1. Add sale-related columns to transactions table
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS voucher_number   TEXT,
  ADD COLUMN IF NOT EXISTS date_of_sale     DATE,
  ADD COLUMN IF NOT EXISTS customer_name    TEXT,
  ADD COLUMN IF NOT EXISTS customer_phone   TEXT;

-- 2. Create customers table (mirroring suppliers structure)
CREATE TABLE IF NOT EXISTS customers (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id  TEXT NOT NULL,
  name         TEXT NOT NULL,
  phone        TEXT,
  email        TEXT,
  address      TEXT,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. RLS: customers visible only within same business
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "business_customers" ON customers
  USING (business_id = (SELECT business_id FROM users WHERE id = auth.uid()));
