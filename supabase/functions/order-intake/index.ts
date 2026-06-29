// order-intake: validate, persist order, assign driver (client pick or preferred), broadcast to vendor

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

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

async function loadDriver(
  sb: ReturnType<typeof createClient>,
  driverId: string,
  customerId: string | null,
): Promise<DriverPick | null> {
  const { data: d } = await sb.from('profiles')
    .select('id, display_name, avatar_emoji, roles, field_lat, field_lng, field_seen_at')
    .eq('id', driverId)
    .maybeSingle()
  if (!d) return null
  const roles = Array.isArray(d.roles) ? d.roles : []
  if (!roles.includes('driver')) return null
  if (d.id === customerId) return { id: d.id, name: d.display_name || 'You', emoji: d.avatar_emoji || '🚚', self: true }
  const since = Date.now() - 30 * 60 * 1000
  if (d.field_seen_at && new Date(d.field_seen_at).getTime() < since) return null
  return { id: d.id, name: d.display_name || 'Driver', emoji: d.avatar_emoji || '🚚' }
}

async function pickNearestDriver(
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
    return { id: d.id, name: d.display_name || 'Driver', emoji: d.avatar_emoji || '🚚' }
  }
  if (pool.length) {
    const d = pool[0]
    return { id: d.id, name: d.display_name || 'Driver', emoji: d.avatar_emoji || '🚚' }
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

    if (body.action === 'assign_driver') {
      if (!customerId) {
        return new Response(JSON.stringify({ error: 'login_required' }), { status: 401, headers: cors })
      }
      const orderId = body.order_id
      const driverId = body.driver_id
      if (!orderId || !driverId) {
        return new Response(JSON.stringify({ error: 'order_id and driver_id required' }), { status: 400, headers: cors })
      }

      const { data: order, error: oErr } = await sb.from('orders')
        .select('id, short_id, customer_id, vendor_id, status, driver_id, delivery_lat, delivery_lng')
        .eq('id', orderId)
        .single()
      if (oErr || !order) {
        return new Response(JSON.stringify({ error: 'order_not_found' }), { status: 404, headers: cors })
      }
      if (order.customer_id !== customerId) {
        return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403, headers: cors })
      }

      const driver = await loadDriver(sb, driverId, customerId)
      if (!driver) {
        return new Response(JSON.stringify({ error: 'driver_unavailable' }), { status: 400, headers: cors })
      }

      const { data: updated, error: uErr } = await sb.from('orders')
        .update({
          driver_id: driver.id,
          driver_name: driver.name,
          driver_emoji: driver.emoji,
          status: 'assigned',
          updated_at: new Date().toISOString(),
        })
        .eq('id', orderId)
        .select()
        .single()
      if (uErr) throw uErr

      if (!driver.self) {
        await sb.from('field_events').insert({
          user_id: driver.id,
          role: 'driver',
          action: 'order',
          detail: `assigned ${order.short_id}`,
          lat: order.delivery_lat,
          lng: order.delivery_lng,
          props: { order_id: order.id, assigned: true, picked_by_client: true },
          brain_synced: true,
        }).catch(() => {})
      }

      try {
        const ch = sb.channel(`vendor-orders-${order.vendor_id}`)
        await ch.send({
          type: 'broadcast',
          event: 'driver_assigned',
          payload: {
            order_id: order.id,
            short_id: order.short_id,
            driver: { id: driver.id, name: driver.name, emoji: driver.emoji },
          },
        })
        await sb.removeChannel(ch)
      } catch { /* non-fatal */ }

      return new Response(JSON.stringify({
        ok: true,
        order: updated,
        driver: { id: driver.id, name: driver.name, emoji: driver.emoji, self: !!driver.self },
        seeking_driver: false,
      }), { headers: cors })
    }

    const { vendor_id, items, calc, delivery_lat, delivery_lng, delivery_address, notes, pay_with_balance, preferred_driver_id } = body

    if (!vendor_id || !Array.isArray(items) || items.length === 0) {
      return new Response(JSON.stringify({ error: 'vendor_id and items required' }), { status: 400, headers: cors })
    }

    const { data: vendor, error: vErr } = await sb.from('vendors')
      .select('id, name, items, is_active')
      .eq('id', vendor_id)
      .single()

    if (vErr || !vendor) {
      return new Response(JSON.stringify({ error: 'vendor_not_found' }), { status: 404, headers: cors })
    }
    if (!vendor.is_active) {
      return new Response(JSON.stringify({ error: 'vendor_inactive' }), { status: 400, headers: cors })
    }

    const menuItems = Array.isArray(vendor.items)
      ? vendor.items.filter((i: { name?: string }) => i && String(i.name || '').trim())
      : []
    if (!menuItems.length) {
      return new Response(JSON.stringify({
        error: 'vendor_menu_empty',
        message: 'This vendor has not set a menu yet. Request the menu first.',
        vendor_name: vendor.name,
      }), { status: 400, headers: cors })
    }

    const menuByName = new Map(menuItems.map((i: { name: string; price?: number }) => [
      String(i.name).trim().toLowerCase(),
      i,
    ]))
    for (const item of items) {
      const key = String(item?.name || '').trim().toLowerCase()
      const menuItem = menuByName.get(key)
      if (!menuItem) {
        return new Response(JSON.stringify({
          error: 'invalid_menu_item',
          message: `Item not on vendor menu: ${item?.name || '?'}`,
        }), { status: 400, headers: cors })
      }
    }

    const dLat = typeof delivery_lat === 'number' ? delivery_lat : null
    const dLng = typeof delivery_lng === 'number' ? delivery_lng : null

    let driver: DriverPick | null = null
    if (preferred_driver_id) {
      driver = await loadDriver(sb, preferred_driver_id, customerId)
    }

    const totalAvc = typeof calc?.total_avc === 'number'
      ? calc.total_avc
      : (items as Array<{ qty?: number; price?: number }>).reduce(
        (s, i) => s + (i.qty || 1) * (i.price || 0), 0,
      )

    let balanceAfter: number | null = null
    let paid = false
    if (pay_with_balance) {
      if (!customerId) {
        return new Response(JSON.stringify({ error: 'login_required' }), { status: 401, headers: cors })
      }
      const { data: ledger } = await sb.from('balance_ledger').select('balance').eq('user_id', customerId).maybeSingle()
      let balance = Number(ledger?.balance) || 0
      if (!ledger) {
        const { data: prof } = await sb.from('profiles').select('balance').eq('id', customerId).single()
        balance = Number(prof?.balance) || 0
      }
      if (balance < totalAvc) {
        return new Response(JSON.stringify({
          error: 'insufficient_balance',
          balance,
          needed: totalAvc,
        }), { status: 402, headers: cors })
      }
      const { error: payErr } = await sb.rpc('add_balance', { uid: customerId, delta: -totalAvc })
      if (payErr) throw payErr
      balanceAfter = balance - totalAvc
      paid = true
    }

    const calcOut = {
      ...(calc ?? {}),
      total_avc: totalAvc,
      ...(paid ? { paid: true, paid_at: new Date().toISOString(), balance_after: balanceAfter } : {}),
    }

    const row: Record<string, unknown> = {
      vendor_id,
      customer_id: customerId,
      items,
      calc: calcOut,
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

    if (paid && customerId) {
      await sb.from('invoices').insert({
        id: 'INV-' + String(order.short_id || order.id).replace(/^ORD-/, ''),
        order_id: String(order.id),
        vendor_name: vendor.name,
        buyer_id: customerId,
        items,
        subtotal: totalAvc,
        total: totalAvc,
        currency: 'AVC',
        status: 'paid',
      }).catch(() => {})
    }

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
      paid,
      paid_amount: paid ? totalAvc : null,
      balance_after: balanceAfter,
    }), { headers: cors })
  } catch (e) {
    const err = e && typeof e === 'object' && 'message' in e ? String((e as { message?: string }).message) : String(e)
    return new Response(JSON.stringify({ ok: false, error: err }), { status: 500, headers: cors })
  }
})