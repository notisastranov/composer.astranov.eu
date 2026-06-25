// vendor-crawler: pull live POI data from Overpass (OpenStreetMap) and upsert into vendors table

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
}

const CAT: Record<string, { emoji: string; category: string; delivery: boolean }> = {
  restaurant:   { emoji: '🍴', category: 'restaurant', delivery: true },
  cafe:         { emoji: '☕', category: 'cafe', delivery: true },
  fast_food:    { emoji: '🍟', category: 'fast_food', delivery: true },
  pizza:        { emoji: '🍕', category: 'restaurant', delivery: true },
  bakery:       { emoji: '🥖', category: 'bakery', delivery: true },
  ice_cream:    { emoji: '🍨', category: 'cafe', delivery: true },
  bar:          { emoji: '🍻', category: 'bar', delivery: false },
  pharmacy:     { emoji: '💊', category: 'pharmacy', delivery: true },
  supermarket:  { emoji: '🛒', category: 'supermarket', delivery: true },
  convenience:  { emoji: '🛍️', category: 'shop', delivery: true },
  clothes:      { emoji: '👕', category: 'shop', delivery: false },
  electronics:  { emoji: '💻', category: 'shop', delivery: false },
  books:        { emoji: '📖', category: 'shop', delivery: false },
  sports:       { emoji: '🏀', category: 'shop', delivery: false },
  hairdresser:  { emoji: '💇', category: 'service', delivery: false },
  gym:          { emoji: '🏃', category: 'fitness', delivery: false },
  hotel:        { emoji: '🏨', category: 'hotel', delivery: false },
  hospital:     { emoji: '🏥', category: 'health', delivery: false },
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const { lat, lng, radius = 2000 } = await req.json().catch(() => ({}))
    if (!lat || !lng) {
      return new Response(JSON.stringify({ error: 'lat and lng required' }), { status: 400, headers: cors })
    }

    const query = `[out:json][timeout:25];
(
  node["amenity"~"^(restaurant|cafe|fast_food|bakery|ice_cream|bar|pharmacy|supermarket|convenience)$"](around:${radius},${lat},${lng});
  node["shop"~"^(clothes|electronics|books|sports|bakery|convenience|supermarket|hairdresser)$"](around:${radius},${lat},${lng});
)->._;
out body qt 80;`

    const resp = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      body: query,
      headers: { 'Content-Type': 'text/plain', 'User-Agent': 'AstranoV/1.0' },
      signal: AbortSignal.timeout(22000)
    })

    if (!resp.ok) throw new Error(`Overpass HTTP ${resp.status}`)
    const data = await resp.json()

    const sb = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const rows = (data.elements ?? [])
      .filter((el: any) => el.tags?.name && el.lat && el.lon)
      .map((el: any) => {
        const amenity = el.tags.amenity ?? el.tags.shop ?? 'shop'
        const meta = CAT[amenity] ?? { emoji: '🏬', category: 'shop', delivery: false }
        return {
          osm_id: `osm_${el.id}`,
          name: el.tags.name as string,
          emoji: meta.emoji,
          category: meta.category,
          lat: el.lat as number,
          lng: el.lon as number,
          address: {
            street: el.tags['addr:street'] ?? null,
            housenumber: el.tags['addr:housenumber'] ?? null,
            city: el.tags['addr:city'] ?? null,
            postcode: el.tags['addr:postcode'] ?? null,
            phone: el.tags.phone ?? el.tags['contact:phone'] ?? null,
            website: el.tags.website ?? el.tags['contact:website'] ?? null,
          },
          tags: {
            amenity: el.tags.amenity ?? null,
            shop: el.tags.shop ?? null,
            cuisine: el.tags.cuisine ?? null,
            opening_hours: el.tags.opening_hours ?? null,
          },
          items: [],
          delivery_enabled: meta.delivery,
          is_active: true,
        }
      })

    if (rows.length > 0) {
      const { error } = await sb
        .from('vendors')
        .upsert(rows, { onConflict: 'osm_id', ignoreDuplicates: false })
      if (error) throw error
    }

    return new Response(JSON.stringify({ ok: true, count: rows.length }), { headers: cors })
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500, headers: cors })
  }
})
