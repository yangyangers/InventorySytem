-- Password Reset Tokens Table
-- Run this in your Supabase SQL editor

CREATE TABLE IF NOT EXISTS password_resets (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token      TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '1 hour'),
  used       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ON password_resets(token);
CREATE INDEX ON password_resets(user_id);

-- RLS: same open policy as other tables (app handles auth)
ALTER TABLE password_resets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all" ON password_resets FOR ALL USING (true) WITH CHECK (true);

-- Optional: auto-clean expired tokens daily (if pg_cron is available)
-- SELECT cron.schedule('clean-expired-resets', '0 3 * * *',
--   $$DELETE FROM password_resets WHERE expires_at < NOW()$$);
