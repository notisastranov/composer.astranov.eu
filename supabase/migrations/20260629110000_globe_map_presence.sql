-- Live map presence: logged-in users visible on globe (collab + κρυφτό hide-and-seek)

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS map_hidden boolean NOT NULL DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS map_mode text DEFAULT 'collab';

DROP POLICY IF EXISTS "Map presence read" ON profiles;
CREATE POLICY "Map presence read" ON profiles FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND (
      id = auth.uid()
      OR (
        field_seen_at IS NOT NULL
        AND field_seen_at > now() - interval '10 minutes'
        AND field_lat IS NOT NULL
        AND field_lng IS NOT NULL
        AND COALESCE(map_hidden, false) = false
      )
    )
  );