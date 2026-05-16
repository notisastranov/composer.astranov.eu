-- AstranoV: marketplace schema — safe/additive, handles existing tables from prior migrations

-- ── VENDORS: create OR extend existing ───────────────
CREATE TABLE IF NOT EXISTS vendors (
  id              text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  osm_id          text,
  name            text NOT NULL,
  emoji           text DEFAULT '🎪',
  category        text DEFAULT 'shop',
  lat             double precision NOT NULL DEFAULT 0,
  lng             double precision NOT NULL DEFAULT 0,
  address         jsonb DEFAULT '{}',
  tags            jsonb DEFAULT '{}',
  owner_id        uuid REFERENCES auth.users(id),
  items           jsonb DEFAULT '[]',
  reserve_balance float DEFAULT 0,
  is_active       boolean DEFAULT true,
  delivery_enabled boolean DEFAULT true,
  delivery_radius_km float DEFAULT 3,
  min_order_avc   float DEFAULT 5,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- Add missing columns if table already existed with older schema
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS osm_id text;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS category text DEFAULT 'shop';
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS address jsonb DEFAULT '{}';
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS tags jsonb DEFAULT '{}';
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS delivery_enabled boolean DEFAULT true;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS delivery_radius_km float DEFAULT 3;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS min_order_avc float DEFAULT 5;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS vendors_osm_id_key ON vendors(osm_id) WHERE osm_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS vendors_lat_lng_idx ON vendors(lat, lng);
CREATE INDEX IF NOT EXISTS vendors_category_idx ON vendors(category);

ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anon read vendors" ON vendors;
CREATE POLICY "Anon read vendors" ON vendors FOR SELECT USING (is_active = true OR is_active IS NULL);

DROP POLICY IF EXISTS "Owner update vendor" ON vendors;
CREATE POLICY "Owner update vendor" ON vendors FOR UPDATE USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Owner insert vendor" ON vendors;
CREATE POLICY "Owner insert vendor" ON vendors FOR INSERT WITH CHECK (auth.uid() = owner_id OR owner_id IS NULL);

DROP POLICY IF EXISTS "Service all vendors" ON vendors;
CREATE POLICY "Service all vendors" ON vendors FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Public read vendors" ON vendors;
CREATE POLICY "Public read vendors" ON vendors FOR SELECT USING (true);


-- ── ORDERS ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  short_id         text UNIQUE DEFAULT 'ORD-' || upper(substring(gen_random_uuid()::text from 1 for 6)),
  vendor_id        text,
  customer_id      uuid REFERENCES auth.users(id),
  items            jsonb NOT NULL DEFAULT '[]',
  calc             jsonb NOT NULL DEFAULT '{}',
  status           text NOT NULL DEFAULT 'pending',
  driver_name      text,
  driver_emoji     text DEFAULT '🚴',
  delivery_lat     double precision,
  delivery_lng     double precision,
  delivery_address text,
  notes            text,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS orders_vendor_idx ON orders(vendor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS orders_customer_idx ON orders(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS orders_status_idx ON orders(status);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Customer see own orders" ON orders;
CREATE POLICY "Customer see own orders" ON orders FOR SELECT USING (auth.uid() = customer_id);

DROP POLICY IF EXISTS "Anon insert order" ON orders;
CREATE POLICY "Anon insert order" ON orders FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Anon read order by vendor" ON orders;
CREATE POLICY "Anon read order by vendor" ON orders FOR SELECT USING (true);

DROP POLICY IF EXISTS "Service all orders" ON orders;
CREATE POLICY "Service all orders" ON orders FOR ALL USING (auth.role() = 'service_role');


-- ── INVOICES ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoices (
  id            text PRIMARY KEY,
  mark          text,
  order_id      text,
  vendor_name   text,
  buyer_id      uuid REFERENCES auth.users(id),
  items         jsonb DEFAULT '[]',
  subtotal      float DEFAULT 0,
  delivery_fee  float DEFAULT 0,
  platform_fee  float DEFAULT 0,
  total         float DEFAULT 0,
  currency      text DEFAULT 'AVC',
  period_month  text,
  status        text DEFAULT 'issued',
  created_at    timestamptz DEFAULT now()
);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anon insert invoice" ON invoices;
CREATE POLICY "Anon insert invoice" ON invoices FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Customer read own invoices" ON invoices;
CREATE POLICY "Customer read own invoices" ON invoices FOR SELECT USING (auth.uid() = buyer_id);

DROP POLICY IF EXISTS "Service all invoices" ON invoices;
CREATE POLICY "Service all invoices" ON invoices FOR ALL USING (auth.role() = 'service_role');


-- ── BALANCE LEDGER: extend if exists ─────────────────
-- Old schema has user_id as PK; new schema keeps that but adds id serial if missing
-- We just ensure the table exists and RLS is right
CREATE TABLE IF NOT EXISTS balance_ledger (
  user_id    uuid PRIMARY KEY REFERENCES auth.users(id),
  balance    float DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE balance_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "User read own balance" ON balance_ledger;
CREATE POLICY "User read own balance" ON balance_ledger FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users see own balance" ON balance_ledger;
CREATE POLICY "Users see own balance" ON balance_ledger FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service all balance" ON balance_ledger;
CREATE POLICY "Service all balance" ON balance_ledger FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role balance all" ON balance_ledger;
CREATE POLICY "Service role balance all" ON balance_ledger FOR ALL USING (auth.role() = 'service_role');


-- ── WEBRTC SIGNALS ───────────────────────────────────
CREATE TABLE IF NOT EXISTS webrtc_signals (
  id         bigserial PRIMARY KEY,
  room       text NOT NULL,
  from_peer  text NOT NULL,
  to_peer    text,
  type       text NOT NULL,
  payload    jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS webrtc_signals_room_idx ON webrtc_signals(room, created_at DESC);

ALTER TABLE webrtc_signals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anon insert signal" ON webrtc_signals;
CREATE POLICY "Anon insert signal" ON webrtc_signals FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Anon read signal" ON webrtc_signals;
CREATE POLICY "Anon read signal" ON webrtc_signals FOR SELECT USING (true);

DROP POLICY IF EXISTS "Service all signals" ON webrtc_signals;
CREATE POLICY "Service all signals" ON webrtc_signals FOR ALL USING (auth.role() = 'service_role');


-- ── ANALYTICS EVENTS ─────────────────────────────────
CREATE TABLE IF NOT EXISTS analytics_events (
  id         bigserial PRIMARY KEY,
  event      text NOT NULL,
  props      jsonb DEFAULT '{}',
  session_id text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anon insert analytics" ON analytics_events;
CREATE POLICY "Anon insert analytics" ON analytics_events FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Service read analytics" ON analytics_events;
CREATE POLICY "Service read analytics" ON analytics_events FOR SELECT USING (auth.role() = 'service_role');


-- ── PROFILES: extend if exists ───────────────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS username text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS display_name text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_emoji text DEFAULT '👤';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bio text DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_owner boolean DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_vendor boolean DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS balance float DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Ensure unique index on username if not already there
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_key ON profiles(username) WHERE username IS NOT NULL;

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Profiles readable by all" ON profiles;
CREATE POLICY "Profiles readable by all" ON profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users see own profile" ON profiles;
CREATE POLICY "Users see own profile" ON profiles FOR SELECT USING (id = auth.uid());

DROP POLICY IF EXISTS "Owner update own profile" ON profiles;
CREATE POLICY "Owner update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users update own profile" ON profiles;
CREATE POLICY "Users update own profile" ON profiles FOR UPDATE USING (id = auth.uid());

DROP POLICY IF EXISTS "Service all profiles" ON profiles;
CREATE POLICY "Service all profiles" ON profiles FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role profiles all" ON profiles;
CREATE POLICY "Service role profiles all" ON profiles FOR ALL USING (auth.role() = 'service_role');

-- Update trigger to also set username on new signups
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO profiles (id, username, display_name)
  VALUES (
    NEW.id,
    split_part(NEW.email, '@', 1),
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO UPDATE SET
    username = COALESCE(profiles.username, EXCLUDED.username),
    display_name = COALESCE(profiles.display_name, EXCLUDED.display_name);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
