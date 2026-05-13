-- AstranoV app tables: profiles, posts, circles, circle_messages

-- Profiles (extends auth.users with app-level fields)
CREATE TABLE IF NOT EXISTS profiles (
  id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  phone       text,
  is_owner    boolean NOT NULL DEFAULT false,
  balance     numeric(12,2) NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see own profile" ON profiles;
CREATE POLICY "Users see own profile"
  ON profiles FOR SELECT
  USING (id = auth.uid());

DROP POLICY IF EXISTS "Users update own profile" ON profiles;
CREATE POLICY "Users update own profile"
  ON profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid() AND is_owner = (SELECT is_owner FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Service role profiles all" ON profiles;
CREATE POLICY "Service role profiles all"
  ON profiles FOR ALL
  USING (auth.role() = 'service_role');

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO profiles(id, display_name, phone)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'phone')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();


-- Posts (video/photo tiles on the map)
CREATE TABLE IF NOT EXISTS posts (
  id        text PRIMARY KEY,
  channel   text NOT NULL,           -- global | local | private
  author    text,
  url       text,
  mode      text,                    -- video | image
  lat       double precision,
  lng       double precision,
  text      text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS posts_geo_idx ON posts(lat, lng);
CREATE INDEX IF NOT EXISTS posts_channel_idx ON posts(channel);

ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read posts" ON posts;
CREATE POLICY "Public read posts"
  ON posts FOR SELECT USING (true);

DROP POLICY IF EXISTS "Auth insert posts" ON posts;
CREATE POLICY "Auth insert posts"
  ON posts FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Service role posts all" ON posts;
CREATE POLICY "Service role posts all"
  ON posts FOR ALL
  USING (auth.role() = 'service_role');


-- Circles (chat groups)
CREATE TABLE IF NOT EXISTS circles (
  id         text PRIMARY KEY,
  name       text NOT NULL,
  scope      text,
  type       text NOT NULL DEFAULT 'public',  -- public | private
  owner_id   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE circles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read circles" ON circles;
CREATE POLICY "Public read circles"
  ON circles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Auth insert circles" ON circles;
CREATE POLICY "Auth insert circles"
  ON circles FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Service role circles all" ON circles;
CREATE POLICY "Service role circles all"
  ON circles FOR ALL
  USING (auth.role() = 'service_role');


-- Circle messages
CREATE TABLE IF NOT EXISTS circle_messages (
  id         bigserial PRIMARY KEY,
  circle_id  text NOT NULL,
  author     text,
  text       text NOT NULL,
  ts         bigint NOT NULL DEFAULT (extract(epoch FROM now())*1000)::bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS circle_messages_circle_idx ON circle_messages(circle_id, ts DESC);

ALTER TABLE circle_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read circle_messages" ON circle_messages;
CREATE POLICY "Public read circle_messages"
  ON circle_messages FOR SELECT USING (true);

DROP POLICY IF EXISTS "Auth insert circle_messages" ON circle_messages;
CREATE POLICY "Auth insert circle_messages"
  ON circle_messages FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Service role circle_messages all" ON circle_messages;
CREATE POLICY "Service role circle_messages all"
  ON circle_messages FOR ALL
  USING (auth.role() = 'service_role');
