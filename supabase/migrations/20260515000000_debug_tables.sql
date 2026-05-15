-- AstranoV: ensure debug tables exist with correct schema
-- session_id is text (short random string from browser), not uuid

CREATE TABLE IF NOT EXISTS analytics_events (
  id         bigserial PRIMARY KEY,
  type       text NOT NULL,
  data       jsonb NOT NULL DEFAULT '{}',
  ts         bigint NOT NULL,
  session_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Fix prior schema if session_id was created as uuid
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'analytics_events' AND column_name = 'session_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE analytics_events ALTER COLUMN session_id TYPE text USING session_id::text;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS analytics_events_type_idx ON analytics_events(type);
CREATE INDEX IF NOT EXISTS analytics_events_ts_idx   ON analytics_events(ts DESC);
CREATE INDEX IF NOT EXISTS analytics_events_sid_idx  ON analytics_events(session_id);

ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role analytics all" ON analytics_events;
CREATE POLICY "Service role analytics all"
  ON analytics_events FOR ALL
  USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Anon insert analytics" ON analytics_events;
CREATE POLICY "Anon insert analytics"
  ON analytics_events FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Anon select debug analytics" ON analytics_events;
CREATE POLICY "Anon select debug analytics"
  ON analytics_events FOR SELECT
  USING (type LIKE 'debug_%');


CREATE TABLE IF NOT EXISTS krypteia_log (
  id         bigserial PRIMARY KEY,
  ts         bigint NOT NULL,
  type       text NOT NULL,
  data       jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS krypteia_log_ts_idx ON krypteia_log(ts DESC);
CREATE INDEX IF NOT EXISTS krypteia_log_type_idx ON krypteia_log(type);

ALTER TABLE krypteia_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role krypteia_log all" ON krypteia_log;
CREATE POLICY "Service role krypteia_log all"
  ON krypteia_log FOR ALL
  USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Anon insert krypteia_log" ON krypteia_log;
CREATE POLICY "Anon insert krypteia_log"
  ON krypteia_log FOR INSERT
  WITH CHECK (true);


-- Ensure debug storage bucket exists and is public
INSERT INTO storage.buckets (id, name, public)
VALUES ('debug-pub', 'debug-pub', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Allow anon SELECT/INSERT/UPDATE on debug-pub bucket
DROP POLICY IF EXISTS "debug_pub_anon_read"   ON storage.objects;
DROP POLICY IF EXISTS "debug_pub_anon_write"  ON storage.objects;
DROP POLICY IF EXISTS "debug_pub_anon_update" ON storage.objects;

CREATE POLICY "debug_pub_anon_read"
ON storage.objects FOR SELECT TO anon
USING (bucket_id = 'debug-pub');

CREATE POLICY "debug_pub_anon_write"
ON storage.objects FOR INSERT TO anon
WITH CHECK (bucket_id = 'debug-pub');

CREATE POLICY "debug_pub_anon_update"
ON storage.objects FOR UPDATE TO anon
USING (bucket_id = 'debug-pub')
WITH CHECK (bucket_id = 'debug-pub');
