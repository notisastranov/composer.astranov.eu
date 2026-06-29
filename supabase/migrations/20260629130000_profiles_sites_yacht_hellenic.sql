-- Profile pages · subdomain admin approval · yacht demand/supply matching

-- ── Profile site (every user / vendor can fill their page) ──
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS profile_page jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS public_email text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS site_slug text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS site_request_status text DEFAULT 'none'
  CHECK (site_request_status IN ('none', 'draft', 'pending', 'approved', 'rejected'));

CREATE UNIQUE INDEX IF NOT EXISTS profiles_site_slug_idx ON profiles (site_slug) WHERE site_slug IS NOT NULL;

DROP POLICY IF EXISTS "Users insert own profile" ON profiles;
CREATE POLICY "Users insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- ── Subdomain: pending until admin approves (owners auto-live) ──
ALTER TABLE booker_sites ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'live'
  CHECK (approval_status IN ('pending', 'live', 'rejected'));

UPDATE booker_sites SET approval_status = 'live' WHERE approval_status IS NULL;

-- ── Yacht charter matching (demand ↔ yacht ↔ crew) ──
CREATE TABLE IF NOT EXISTS booker_yachts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id text NOT NULL REFERENCES booker_sites(id) ON DELETE CASCADE,
  owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  length_m numeric,
  max_passengers integer NOT NULL DEFAULT 8 CHECK (max_passengers > 0),
  max_hire_days integer NOT NULL DEFAULT 14 CHECK (max_hire_days > 0),
  price_per_day_eur numeric NOT NULL DEFAULT 0 CHECK (price_per_day_eur >= 0),
  required_crew jsonb NOT NULL DEFAULT '{"captain":1,"vice_captain":1,"cadet":1}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS booker_crew (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  site_id text REFERENCES booker_sites(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  role text NOT NULL CHECK (role IN ('captain', 'vice_captain', 'cadet')),
  rate_per_day_eur numeric NOT NULL CHECK (rate_per_day_eur >= 0),
  yacht_ids uuid[] NOT NULL DEFAULT '{}',
  available_from date,
  available_to date,
  active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS booker_charter_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id text NOT NULL REFERENCES booker_sites(id) ON DELETE CASCADE,
  yacht_id uuid REFERENCES booker_yachts(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  passengers integer NOT NULL DEFAULT 2 CHECK (passengers > 0),
  status text NOT NULL DEFAULT 'matching' CHECK (status IN ('matching', 'matched', 'pending_payment', 'confirmed', 'cancelled')),
  matched_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  total_price_eur numeric,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS booker_yachts_site_idx ON booker_yachts(site_id);
CREATE INDEX IF NOT EXISTS booker_crew_site_role_idx ON booker_crew(site_id, role);
CREATE INDEX IF NOT EXISTS booker_charter_site_idx ON booker_charter_requests(site_id, created_at DESC);

ALTER TABLE booker_yachts ENABLE ROW LEVEL SECURITY;
ALTER TABLE booker_crew ENABLE ROW LEVEL SECURITY;
ALTER TABLE booker_charter_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY booker_yachts_public_read ON booker_yachts FOR SELECT USING (active = true);
CREATE POLICY booker_crew_public_read ON booker_crew FOR SELECT USING (active = true);
CREATE POLICY booker_charter_guest_insert ON booker_charter_requests FOR INSERT WITH CHECK (true);
CREATE POLICY booker_charter_owner_read ON booker_charter_requests FOR SELECT USING (
  auth.uid() = customer_id OR EXISTS (
    SELECT 1 FROM booker_sites s WHERE s.id = site_id AND s.owner_id = auth.uid()
  )
);

-- Default crew rates (EUR/day): captain 300, vice 200, cadet 100
CREATE OR REPLACE FUNCTION public.booker_seed_yacht_crew_defaults(p_site_id text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM booker_crew WHERE site_id = p_site_id AND role = 'captain') THEN
    INSERT INTO booker_crew (site_id, display_name, role, rate_per_day_eur)
    VALUES (p_site_id, 'Captain pool', 'captain', 300);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM booker_crew WHERE site_id = p_site_id AND role = 'vice_captain') THEN
    INSERT INTO booker_crew (site_id, display_name, role, rate_per_day_eur)
    VALUES (p_site_id, 'Vice captain pool', 'vice_captain', 200);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM booker_crew WHERE site_id = p_site_id AND role = 'cadet') THEN
    INSERT INTO booker_crew (site_id, display_name, role, rate_per_day_eur)
    VALUES (p_site_id, 'Cadet sailor pool', 'cadet', 100);
  END IF;
END; $$;

CREATE OR REPLACE FUNCTION public.is_astranov_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_owner = true);
$$;

CREATE OR REPLACE FUNCTION public.booker_approve_site(p_site_id text, p_approve boolean DEFAULT true)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_site public.booker_sites%rowtype;
BEGIN
  IF NOT public.is_astranov_admin() THEN RAISE EXCEPTION 'admin_required'; END IF;
  SELECT * INTO v_site FROM booker_sites WHERE id = p_site_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'site_not_found'; END IF;
  UPDATE booker_sites SET
    active = p_approve,
    approval_status = CASE WHEN p_approve THEN 'live' ELSE 'rejected' END,
    updated_at = now()
  WHERE id = p_site_id;
  UPDATE booker_site_requests SET status = CASE WHEN p_approve THEN 'live' ELSE 'rejected' END
  WHERE site_id = p_site_id AND status = 'pending';
  RETURN jsonb_build_object('ok', true, 'site_id', p_site_id, 'live', p_approve);
END; $$;

CREATE OR REPLACE FUNCTION public.booker_provision_site(
  p_slug text,
  p_business_name text,
  p_business_type text DEFAULT 'generic',
  p_mode text DEFAULT 'slot',
  p_vendor_id text DEFAULT null,
  p_contact jsonb DEFAULT '{}'::jsonb,
  p_branding jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_slug text;
  v_domain text;
  v_site_id text;
  v_existing public.booker_sites%rowtype;
  v_email text;
  v_name text;
  v_admin boolean;
  v_live boolean;
  v_status text;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'login_required'; END IF;

  v_slug := lower(regexp_replace(trim(coalesce(p_slug, '')), '[^a-z0-9-]', '-', 'g'));
  v_slug := regexp_replace(v_slug, '-{2,}', '-', 'g');
  v_slug := trim(both '-' from v_slug);

  IF length(v_slug) < 3 OR length(v_slug) > 32 THEN
    RAISE EXCEPTION 'slug must be 3-32 characters (a-z, 0-9, hyphen)';
  END IF;

  IF v_slug IN ('www', 'api', 'app', 'mail', 'admin', 'astranov', 'booker', 'superbooking', 'frogschool', 'yachts') THEN
    RAISE EXCEPTION 'slug reserved';
  END IF;

  SELECT * INTO v_existing FROM booker_sites WHERE slug = v_slug OR id = v_slug OR lower(domain) = v_slug || '.astranov.eu';
  IF FOUND AND v_existing.owner_id IS DISTINCT FROM v_user THEN
    RAISE EXCEPTION 'slug already taken';
  END IF;

  v_admin := public.is_astranov_admin();
  v_live := v_admin;
  v_status := CASE WHEN v_live THEN 'live' ELSE 'pending' END;

  v_domain := v_slug || '.astranov.eu';
  v_site_id := v_slug;
  v_name := coalesce(nullif(trim(p_business_name), ''), v_slug);
  SELECT email INTO v_email FROM auth.users WHERE id = v_user;

  IF FOUND THEN
    UPDATE booker_sites SET
      business_type = coalesce(nullif(p_business_type, ''), business_type),
      mode = coalesce(nullif(p_mode, ''), mode),
      branding = branding || coalesce(p_branding, '{}'::jsonb) || jsonb_build_object('title', v_name),
      contact = contact || coalesce(p_contact, '{}'::jsonb),
      vendor_id = coalesce(p_vendor_id, vendor_id),
      owner_id = v_user,
      active = v_live,
      approval_status = v_status,
      updated_at = now()
    WHERE id = v_existing.id
    RETURNING * INTO v_existing;
  ELSE
    INSERT INTO booker_sites (
      id, slug, domain, owner_id, vendor_id, business_type, mode,
      branding, contact, config, active, approval_status
    ) VALUES (
      v_site_id, v_slug, v_domain, v_user, p_vendor_id,
      coalesce(nullif(p_business_type, ''), 'generic'),
      coalesce(nullif(p_mode, ''), 'slot'),
      coalesce(p_branding, '{}'::jsonb) || jsonb_build_object('title', v_name, 'subtitle', v_domain),
      coalesce(p_contact, '{}'::jsonb) || jsonb_build_object('email', v_email),
      jsonb_build_object('rpcPrefix', 'booker_', 'provisioned', true, 'currency', 'EUR'),
      v_live, v_status
    ) RETURNING * INTO v_existing;
  END IF;

  INSERT INTO booker_site_requests (
    user_id, vendor_id, site_id, slug, business_name, business_type, mode, domain, status
  ) VALUES (
    v_user, p_vendor_id, v_existing.id, v_slug, v_name,
    v_existing.business_type, v_existing.mode, v_domain, v_status
  );

  IF v_existing.business_type = 'yacht_charter' THEN
    PERFORM public.booker_seed_yacht_crew_defaults(v_existing.id);
  END IF;

  UPDATE profiles SET site_slug = v_slug, site_request_status = v_status WHERE id = v_user;

  RETURN jsonb_build_object(
    'ok', true,
    'site_id', v_existing.id,
    'slug', v_slug,
    'domain', v_domain,
    'url', 'https://' || v_domain,
    'business_type', v_existing.business_type,
    'mode', v_existing.mode,
    'pending_approval', NOT v_live,
    'status', v_status
  );
END; $$;

GRANT EXECUTE ON FUNCTION public.booker_approve_site(text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.booker_seed_yacht_crew_defaults(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_astranov_admin() TO authenticated;