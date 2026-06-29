-- Map team chats (polygon groups on globe)

ALTER TABLE circles ADD COLUMN IF NOT EXISTS scope text;
ALTER TABLE circles ADD COLUMN IF NOT EXISTS map_members jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE circles ADD COLUMN IF NOT EXISTS map_center_lat double precision;
ALTER TABLE circles ADD COLUMN IF NOT EXISTS map_center_lng double precision;

DROP POLICY IF EXISTS "Auth update own map circles" ON circles;
CREATE POLICY "Auth update own map circles" ON circles FOR UPDATE
  USING (owner_id = auth.uid() OR scope = 'map_team')
  WITH CHECK (owner_id = auth.uid() OR scope = 'map_team');