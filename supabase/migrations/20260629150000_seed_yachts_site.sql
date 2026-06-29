-- AstranoV Yachting site on central Supabase (yachts.astranov.eu)

INSERT INTO public.booker_sites (id, slug, domain, business_type, mode, branding, contact, config, active, approval_status)
VALUES (
  'yachts',
  'yachts',
  'yachts.astranov.eu',
  'yacht_charter',
  'range',
  '{"title":"AstranoV Yachting","subtitle":"yachts.astranov.eu · featured voyage"}'::jsonb,
  '{"email":"notiscs@gmail.com","address":"Rhodes, Greece"}'::jsonb,
  '{"rpcPrefix":"booker_","currency":"EUR","matchPreset":"yacht_charter"}'::jsonb,
  true,
  'live'
) ON CONFLICT (id) DO UPDATE SET
  domain = excluded.domain,
  business_type = excluded.business_type,
  mode = excluded.mode,
  branding = excluded.branding,
  active = true,
  approval_status = 'live',
  updated_at = now();

INSERT INTO public.booker_match_config (site_id, enabled, active_fields, match_engine)
VALUES (
  'yachts',
  true,
  '{"guests":true,"cabins":true,"budget":true,"yacht_type":true,"characteristics":true}'::jsonb,
  '{"preset":"yacht_charter","crewRates":{"captain":300,"vice_captain":200,"cadet":100}}'::jsonb
) ON CONFLICT (site_id) DO UPDATE SET
  enabled = true,
  updated_at = now();

SELECT public.booker_seed_yacht_crew_defaults('yachts');

INSERT INTO public.booker_resources (site_id, display_name, role, rate_per_day_eur, active)
SELECT 'yachts', 'Captain pool', 'captain', 300, true
WHERE NOT EXISTS (SELECT 1 FROM booker_resources WHERE site_id = 'yachts' AND role = 'captain');
INSERT INTO public.booker_resources (site_id, display_name, role, rate_per_day_eur, active)
SELECT 'yachts', 'Vice captain pool', 'vice_captain', 200, true
WHERE NOT EXISTS (SELECT 1 FROM booker_resources WHERE site_id = 'yachts' AND role = 'vice_captain');
INSERT INTO public.booker_resources (site_id, display_name, role, rate_per_day_eur, active)
SELECT 'yachts', 'Cadet sailor pool', 'cadet', 100, true
WHERE NOT EXISTS (SELECT 1 FROM booker_resources WHERE site_id = 'yachts' AND role = 'cadet');