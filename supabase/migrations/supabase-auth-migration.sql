-- ============================================================
-- Migration: Switch to Supabase Auth
-- Run this in your Supabase SQL Editor AFTER running the
-- migration script (scripts/migrate-to-supabase-auth.js)
-- ============================================================

-- 1. Add auth_id column to link users table to auth.users
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2. Create index for fast lookups by auth_id
CREATE INDEX IF NOT EXISTS users_auth_id_idx ON users(auth_id);

-- 3. Once all users are migrated, you can drop password_hash
--    (Only run this AFTER confirming all users can log in!)
-- ALTER TABLE users DROP COLUMN IF EXISTS password_hash;

-- 4. Drop the old custom password_resets table if it exists
DROP TABLE IF EXISTS password_resets;

-- ============================================================
-- Configure the reset email redirect URL in Supabase dashboard:
--   Authentication > URL Configuration > Redirect URLs
--   Add: https://your-app.vercel.app/reset-password
--
-- Also set Site URL to: https://your-app.vercel.app
-- ============================================================
