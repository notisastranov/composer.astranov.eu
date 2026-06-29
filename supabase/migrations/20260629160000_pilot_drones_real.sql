-- Real pilot drone registry · C2 events · gaming field (no simulated inventory)

CREATE TABLE IF NOT EXISTS pilot_drones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  operator_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  domain text NOT NULL CHECK (domain IN ('fpv', 'air', 'ground', 'sea', 'underwater')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'captured', 'rtb', 'released', 'idle')),
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  pilot_lat double precision NOT NULL,
  pilot_lng double precision NOT NULL,
  link_strength numeric NOT NULL DEFAULT 0.5 CHECK (link_strength >= 0 AND link_strength <= 1),
  link_mhz numeric,
  order_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pilot_drone_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  drone_id uuid REFERENCES pilot_drones(id) ON DELETE SET NULL,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL CHECK (action IN ('register', 'scan', 'seize', 'rtb', 'release', 'handoff', 'deploy')),
  detail text,
  lat double precision,
  lng double precision,
  props jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pilot_drones_owner_idx ON pilot_drones(owner_id, status);
CREATE INDEX IF NOT EXISTS pilot_drones_status_idx ON pilot_drones(status, updated_at DESC);
CREATE INDEX IF NOT EXISTS pilot_drones_domain_idx ON pilot_drones(domain) WHERE status IN ('active', 'captured', 'rtb');
CREATE INDEX IF NOT EXISTS pilot_drone_events_drone_idx ON pilot_drone_events(drone_id, created_at DESC);

ALTER TABLE pilot_drones ENABLE ROW LEVEL SECURITY;
ALTER TABLE pilot_drone_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY pilot_drones_read ON pilot_drones FOR SELECT TO authenticated USING (true);
CREATE POLICY pilot_drones_insert_own ON pilot_drones FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_id);
CREATE POLICY pilot_drones_update_own ON pilot_drones FOR UPDATE TO authenticated
  USING (auth.uid() = owner_id OR auth.uid() = operator_id);

CREATE POLICY pilot_drone_events_read ON pilot_drone_events FOR SELECT TO authenticated USING (true);
CREATE POLICY pilot_drone_events_insert ON pilot_drone_events FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = actor_id OR auth.uid() IS NOT NULL);

GRANT SELECT ON pilot_drones TO authenticated;
GRANT SELECT, INSERT ON pilot_drone_events TO authenticated;

-- Realtime: fleet sync + C2 alerts (room filter needs full replica on webrtc_signals)
ALTER TABLE webrtc_signals REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE pilot_drones;
ALTER PUBLICATION supabase_realtime ADD TABLE webrtc_signals;