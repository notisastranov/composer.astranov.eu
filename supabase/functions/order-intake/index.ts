// order-intake: validate, persist order, assign real logged-in driver, broadcast to vendor

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
}

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

type DriverPick = { id: string; name: string; emoji: string; self?: boolean }

async function pickDriver(
  sb: ReturnType<typeof createClient>,
  deliveryLat: number | null,
  deliveryLng: number | null,
  customerId: string | null,
): Promise<DriverPick | null> {
  const since = new Date(Date.now() - 30 * 60 * 1000).toISOString()
  const { data: online } = await sb.from('profiles')
    .select('id, display_name, avatar_emoji, field_lat, field_lng, roles')
    .contains('roles', ['driver'])
    .gte('field_seen_at', since)
    .not('field_lat', 'is', null)
    .limit(40)

  const pool = (online || []).filter(p => p.id !== customerId)
  if (deliveryLat != null && deliveryLng != null && pool.length) {
    pool.sort((a, b) => {
      const da = haversineM(deliveryLat, deliveryLng, a.field_lat!, a.field_lng!)
      const db = haversineM(deliveryLat, deliveryLng, b.field_lat!, b.field_lng!)
      return da - db
    })
    const d = pool[0]
    return { id: d.id, name: d.display_name || 'Driver', emoji: d.avatar_emoji || '🚴' }
  }
  if (pool.length) {
    const d = pool[0]
    return { id: d.id, name: d.display_name || 'Driver', emoji: d.avatar_emoji || '🚴' }
  }
  if (customerId) {
    const { data: self } = await sb.from('profiles').select('display_name, avatar_emoji').eq('id', customerId).single()
    return { id: customerId, name: self?.display_name || 'You', emoji: self?.avatar_emoji || '🚴', self: true }
  }
  return null
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const sb = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    let customerId: string | null = null
    const auth = req.headers.get('authorization') ?? ''
    if (auth.startsWith('Bearer ')) {
      const anonSb = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        { global: { headers: { authorization: auth } }, auth: { persistSession: false } },
      )
      const { data: { user } } = await anonSb.auth.getUser()
      customerId = user?.id ?? null
    }

    const body = await req.json().catch(() => ({}))
    const { vendor_id, items, calc, delivery_lat, delivery_lng, delivery_address, notes } = body

    if (!vendor_id || !Array.isArray(items) || items.length === 0) {
      return new Response(JSON.stringify({ error: 'vendor_id and items required' }), { status: 400, headers: cors })
    }

    const dLat = typeof delivery_lat === 'number' ? delivery_lat : null
    const dLng = typeof delivery_lng === 'number' ? delivery_lng : null
    const driver = await pickDriver(sb, dLat, dLng, customerId)

    const row: Record<string, unknown> = {
      vendor_id,
      customer_id: customerId,
      items,
      calc: calc ?? {},
      status: driver ? 'assigned' : 'seeking_driver',
      delivery_lat: dLat,
      delivery_lng: dLng,
      delivery_address: delivery_address ?? null,
      notes: notes ?? null,
    }
    if (driver) {
      row.driver_id = driver.id
      row.driver_name = driver.name
      row.driver_emoji = driver.emoji
    }

    const { data: order, error } = await sb.from('orders').insert(row).select().single()
    if (error) throw error

    if (customerId) {
      await sb.from('field_events').insert({
        user_id: customerId,
        role: 'client',
        action: 'order',
        detail: `order ${order.short_id} vendor ${vendor_id}`,
        lat: dLat,
        lng: dLng,
        props: { order_id: order.id, vendor_id, driver_id: driver?.id || null },
        brain_synced: true,
      }).catch(() => {})
    }
    if (driver && !driver.self) {
      await sb.from('field_events').insert({
        user_id: driver.id,
        role: 'driver',
        action: 'order',
        detail: `assigned ${order.short_id}`,
        lat: dLat,
        lng: dLng,
        props: { order_id: order.id, assigned: true },
        brain_synced: true,
      }).catch(() => {})
    }

    try {
      const ch = sb.channel(`vendor-orders-${vendor_id}`)
      await ch.send({
        type: 'broadcast',
        event: 'new_order',
        payload: {
          order_id: order.id,
          short_id: order.short_id,
          items,
          calc,
          driver: driver ? { id: driver.id, name: driver.name, emoji: driver.emoji } : null,
          seeking_driver: !driver,
        },
      })
      await sb.removeChannel(ch)
    } catch { /* non-fatal */ }

    return new Response(JSON.stringify({
      ok: true,
      order,
      driver: driver ? { id: driver.id, name: driver.name, emoji: driver.emoji, self: !!driver.self } : null,
      seeking_driver: !driver,
      multi_role: true,
    }), { headers: cors })
  } catch (e) {
    const err = e && typeof e === 'object' && 'message' in e ? String((e as { message?: string }).message) : String(e)
    return new Response(JSON.stringify({ ok: false, error: err }), { status: 500, headers: cors })
  }
})