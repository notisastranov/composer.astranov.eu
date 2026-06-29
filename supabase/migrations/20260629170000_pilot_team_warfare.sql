-- Blue vs red team delivery warfare (ΤΗΛΕΜΑΧΟΣ gaming win condition)

ALTER TABLE orders ADD COLUMN IF NOT EXISTS target_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS orders_target_user_idx ON orders(target_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS pilot_team_hits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blue_actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  red_target_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_type text NOT NULL CHECK (item_type IN ('pita', 'beer', 'cigarettes', 'burger')),
  order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
  lat double precision,
  lng double precision,
  props jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- One qualifying feed per red player per UTC day (burger/beer/pitogyro/mpironi/tsigareta)
CREATE UNIQUE INDEX IF NOT EXISTS pilot_team_hits_red_daily_idx
  ON pilot_team_hits (red_target_id, ((created_at AT TIME ZONE 'UTC')::date));

CREATE INDEX IF NOT EXISTS pilot_team_hits_red_idx ON pilot_team_hits(red_target_id, created_at DESC);
CREATE INDEX IF NOT EXISTS pilot_team_hits_blue_idx ON pilot_team_hits(blue_actor_id, created_at DESC);

ALTER TABLE pilot_team_hits ENABLE ROW LEVEL SECURITY;

CREATE POLICY pilot_team_hits_read ON pilot_team_hits FOR SELECT TO authenticated USING (true);
CREATE POLICY pilot_team_hits_insert_own ON pilot_team_hits FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = blue_actor_id);

GRANT SELECT, INSERT ON pilot_team_hits TO authenticated;

ALTER PUBLICATION supabase_realtime ADD TABLE pilot_team_hits;