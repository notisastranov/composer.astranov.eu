-- cic_queue for Astranov Coders bridge (Cursor Composer summons)

CREATE TABLE IF NOT EXISTS cic_queue (
  id           bigserial PRIMARY KEY,
  user_id      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  question     text NOT NULL,
  context      jsonb DEFAULT '{}',
  reason       text,
  status       text NOT NULL DEFAULT 'open',
  answered_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  answer       text,
  for_owner    boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now(),
  answered_at  timestamptz
);

CREATE INDEX IF NOT EXISTS cic_queue_status_idx ON cic_queue(status, created_at DESC);
CREATE INDEX IF NOT EXISTS cic_queue_reason_idx ON cic_queue(reason, status);

ALTER TABLE cic_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authed insert cic_queue" ON cic_queue;
CREATE POLICY "Authed insert cic_queue"
  ON cic_queue FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authed read open cic_queue" ON cic_queue;
CREATE POLICY "Authed read open cic_queue"
  ON cic_queue FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authors read own cic_queue" ON cic_queue;
CREATE POLICY "Authors read own cic_queue"
  ON cic_queue FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Service role cic_queue all" ON cic_queue;
CREATE POLICY "Service role cic_queue all"
  ON cic_queue FOR ALL
  USING (auth.role() = 'service_role');