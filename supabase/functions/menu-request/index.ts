// menu-request: customer asks vendor to fill real menu (no fake client defaults)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
}

function validMenuItems(items: unknown): boolean {
  if (!Array.isArray(items)) return false
  return items.some((i) => i && typeof i === 'object' && 'name' in i && String((i as { name?: string }).name || '').trim())
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

    if (!customerId) {
      return new Response(JSON.stringify({ error: 'login_required' }), { status: 401, headers: cors })
    }

    const body = await req.json().catch(() => ({}))
    const { vendor_id, notes, delivery_lat, delivery_lng } = body

    if (!vendor_id) {
      return new Response(JSON.stringify({ error: 'vendor_id required' }), { status: 400, headers: cors })
    }

    const { data: vendor, error: vErr } = await sb.from('vendors')
      .select('id, name, owner_id, items, is_active')
      .eq('id', vendor_id)
      .single()

    if (vErr || !vendor) {
      return new Response(JSON.stringify({ error: 'vendor_not_found' }), { status: 404, headers: cors })
    }
    if (!vendor.is_active) {
      return new Response(JSON.stringify({ error: 'vendor_inactive' }), { status: 400, headers: cors })
    }
    if (validMenuItems(vendor.items)) {
      return new Response(JSON.stringify({ error: 'menu_already_set', vendor_name: vendor.name }), { status: 400, headers: cors })
    }

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { data: existing } = await sb.from('vendor_menu_requests')
      .select('id, status, created_at')
      .eq('vendor_id', vendor_id)
      .eq('customer_id', customerId)
      .eq('status', 'pending')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    let request = existing
    if (!existing) {
      const { data: created, error } = await sb.from('vendor_menu_requests').insert({
        vendor_id,
        customer_id: customerId,
        status: 'pending',
        notes: notes ?? null,
      }).select().single()
      if (error) throw error
      request = created
    }

    const dLat = typeof delivery_lat === 'number' ? delivery_lat : null
    const dLng = typeof delivery_lng === 'number' ? delivery_lng : null

    await sb.from('field_events').insert({
      user_id: customerId,
      role: 'client',
      action: 'commerce',
      detail: `menu request · ${vendor.name}`,
      lat: dLat,
      lng: dLng,
      props: { vendor_id, request_id: request?.id, type: 'menu_request' },
      brain_synced: true,
    }).catch(() => {})

    if (vendor.owner_id) {
      await sb.from('field_events').insert({
        user_id: vendor.owner_id,
        role: 'vendor',
        action: 'vendor',
        detail: `fill menu · ${vendor.name} · customer waiting`,
        lat: dLat,
        lng: dLng,
        props: { vendor_id, request_id: request?.id, type: 'menu_request' },
        brain_synced: true,
      }).catch(() => {})
    }

    try {
      const ch = sb.channel(`vendor-menu-${vendor_id}`)
      await ch.send({
        type: 'broadcast',
        event: 'menu_request',
        payload: {
          request_id: request?.id,
          vendor_id,
          vendor_name: vendor.name,
          customer_id: customerId,
          notes: notes ?? null,
        },
      })
      await sb.removeChannel(ch)
    } catch { /* non-fatal */ }

    return new Response(JSON.stringify({
      ok: true,
      request,
      vendor_name: vendor.name,
      already_pending: !!existing,
    }), { headers: cors })
  } catch (e) {
    const err = e && typeof e === 'object' && 'message' in e ? String((e as { message?: string }).message) : String(e)
    return new Response(JSON.stringify({ ok: false, error: err }), { status: 500, headers: cors })
  }
})