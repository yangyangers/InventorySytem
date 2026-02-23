-- ============================================================
-- IMS v2 — Complete Supabase Schema
-- Run in: Supabase → SQL Editor → New Query → Run
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS products     CASCADE;
DROP TABLE IF EXISTS categories   CASCADE;
DROP TABLE IF EXISTS suppliers    CASCADE;
DROP TABLE IF EXISTS users        CASCADE;

-- USERS
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email         TEXT UNIQUE,
  username      TEXT UNIQUE NOT NULL,
  full_name     TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('admin','staff')),
  business_id   TEXT NOT NULL CHECK (business_id IN ('wellbuild','tcchemical','wellprint')),
  avatar_color  TEXT,
  phone         TEXT,
  bio           TEXT,
  is_active     BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- CATEGORIES
CREATE TABLE categories (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  description TEXT,
  business_id TEXT NOT NULL CHECK (business_id IN ('wellbuild','tcchemical','wellprint')),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(name, business_id)
);

-- SUPPLIERS
CREATE TABLE suppliers (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name           TEXT NOT NULL,
  contact_person TEXT,
  email          TEXT,
  phone          TEXT,
  address        TEXT,
  business_id    TEXT NOT NULL CHECK (business_id IN ('wellbuild','tcchemical','wellprint')),
  is_active      BOOLEAN DEFAULT TRUE,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- PRODUCTS
CREATE TABLE products (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sku           TEXT NOT NULL,
  name          TEXT NOT NULL,
  description   TEXT,
  category_id   UUID REFERENCES categories(id) ON DELETE SET NULL,
  supplier_id   UUID REFERENCES suppliers(id)  ON DELETE SET NULL,
  business_id   TEXT NOT NULL CHECK (business_id IN ('wellbuild','tcchemical','wellprint')),
  unit          TEXT NOT NULL DEFAULT 'pcs',
  quantity      INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  reorder_level INTEGER NOT NULL DEFAULT 10,
  cost_price    NUMERIC(12,2) NOT NULL DEFAULT 0,
  selling_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  is_active     BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(sku, business_id)
);

-- TRANSACTIONS
CREATE TABLE transactions (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id       UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  business_id      TEXT NOT NULL CHECK (business_id IN ('wellbuild','tcchemical','wellprint')),
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('stock_in','stock_out','adjustment')),
  quantity         INTEGER NOT NULL,
  reference_number TEXT,
  notes            TEXT,
  performed_by     UUID NOT NULL REFERENCES users(id),
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- INDEXES
CREATE INDEX ON products(business_id);
CREATE INDEX ON products(category_id);
CREATE INDEX ON products(supplier_id);
CREATE INDEX ON products(sku);
CREATE INDEX ON transactions(business_id);
CREATE INDEX ON transactions(product_id);
CREATE INDEX ON transactions(created_at DESC);
CREATE INDEX ON users(username);
CREATE INDEX ON users(business_id);

-- RLS (allow anon key full access — app handles authorization)
ALTER TABLE users        ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories   ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers    ENABLE ROW LEVEL SECURITY;
ALTER TABLE products     ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_all" ON users        FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON categories   FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON suppliers    FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON products     FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON transactions FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- SEED ADMINS
-- Run: node scripts/seed-admin.js  to generate real SQL with hash
-- ============================================================
-- INSERT INTO users (email, username, full_name, password_hash, role, business_id) VALUES
--   ('admin@wellbuild.com',  'admin.wellbuild',  'WELLBUILD Admin',   '<HASH>', 'admin', 'wellbuild'),
--   ('admin@tcchemical.com', 'admin.tcchemical', 'TC CHEMICAL Admin', '<HASH>', 'admin', 'tcchemical'),
--   ('admin@wellprint.com',  'admin.wellprint',  'WELLPRINT Admin',   '<HASH>', 'admin', 'wellprint');

-- SEED CATEGORIES
INSERT INTO categories (name, description, business_id) VALUES
  ('Construction Materials','Cement, sand, gravel, aggregates','wellbuild'),
  ('Hardware & Fasteners','Bolts, nuts, nails, screws','wellbuild'),
  ('Plumbing','Pipes, fittings, valves','wellbuild'),
  ('Electrical','Wires, switches, outlets','wellbuild'),
  ('Power Tools','Drills, grinders, saws','wellbuild'),
  ('Acids & Bases','Lab-grade acids and bases','tcchemical'),
  ('Solvents','Industrial and lab solvents','tcchemical'),
  ('Safety Equipment','PPE and safety items','tcchemical'),
  ('Lab Consumables','Glassware and disposables','tcchemical'),
  ('Inks & Toners','Printer inks and toners','wellprint'),
  ('Paper & Media','Printing paper and vinyl','wellprint'),
  ('Printing Chemicals','Developer and fixer solutions','wellprint'),
  ('Equipment Parts','Printer parts and accessories','wellprint')
ON CONFLICT DO NOTHING;
