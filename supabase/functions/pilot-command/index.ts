// pilot-command: real drone registry · seize · RTB · evolution (tilemaxos / ΤΗΛΕΜΑΧΟΣ)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
}

const DOMAIN_RANGE_M: Record<string, number> = {
  fpv: 3500,
  air: 9000,
  ground: 6000,
  sea: 12000,
  underwater: 4000,
}

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function linkStrength(domain: string, droneLat: number, droneLng: number, pilotLat: number, pilotLng: number) {
  const dist = haversineM(droneLat, droneLng, pilotLat, pilotLng)
  const maxR = DOMAIN_RANGE_M[domain] || 6000
  // 0 = strong link (hard seize), 1 = weak link (easy seize)
  return Math.min(1, Math.max(0.08, dist / maxR))
}

function defaultEvolution() {
  return { xp: 0, level: 1, power: 100, takeovers: 0, flybacks: 0, fpv_captures: 0, deliveries: 0, gamers_seen: 0 }
}

async function getEvolution(sb: ReturnType<typeof createClient>, userId: string) {
  const { data } = await sb.from('profiles').select('globe_session').eq('id', userId).maybeSingle()
  const gs = (data?.globe_session || {}) as Record<string, unknown>
  const pilot = (gs.pilot || {}) as Record<string, unknown>
  return { ...(defaultEvolution()), ...(pilot.evolution as object || {}) }
}

async function saveEvolution(sb: ReturnType<typeof createClient>, userId: string, evo: Record<string, unknown>) {
  const { data } = await sb.from('profiles').select('globe_session').eq('id', userId).maybeSingle()
  const gs = { ...((data?.globe_session || {}) as object), pilot: { evolution: evo, updated_at: new Date().toISOString() } }
  await sb.from('profiles').update({ globe_session: gs, updated_at: new Date().toISOString() }).eq('id', userId)
}

async function logEvent(
  sb: ReturnType<typeof createClient>,
  row: { drone_id?: string; actor_id: string; owner_id?: string; action: string; detail?: string; lat?: number; lng?: number; props?: object },
) {
  await sb.from('pilot_drone_events').insert({
    drone_id: row.drone_id || null,
    actor_id: row.actor_id,
    owner_id: row.owner_id || null,
    action: row.action,
    detail: row.detail || null,
    lat: row.lat ?? null,
    lng: row.lng ?? null,
    props: row.props || {},
  })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const sb = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    let userId: string | null = null
    const auth = req.headers.get('authorization') ?? ''
    if (auth.startsWith('Bearer ')) {
      const anonSb = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        { global: { headers: { authorization: auth } }, auth: { persistSession: false } },
      )
      const { data: { user } } = await anonSb.auth.getUser()
      userId = user?.id ?? null
    }

    const body = await req.json().catch(() => ({}))
    const action = String(body.action || 'scan')

    if (!userId && action !== 'scan') {
      return new Response(JSON.stringify({ error: 'login_required' }), { status: 401, headers: cors })
    }

    if (action === 'evolution_get') {
      const evo = await getEvolution(sb, userId!)
      return new Response(JSON.stringify({ ok: true, evolution: evo }), { headers: cors })
    }

    if (action === 'scan') {
      const since = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString()
      const { data: rows } = await sb.from('pilot_drones')
        .select('id, owner_id, operator_id, domain, status, lat, lng, pilot_lat, pilot_lng, link_strength, link_mhz, metadata, updated_at')
        .in('status', ['active', 'captured', 'rtb'])
        .gte('updated_at', since)
        .order('updated_at', { ascending: false })
        .limit(120)

      const ownerIds = [...new Set((rows || []).map((r) => r.owner_id))]
      const { data: owners } = ownerIds.length
        ? await sb.from('profiles').select('id, display_name, avatar_emoji, field_lat, field_lng, field_seen_at').in('id', ownerIds)
        : { data: [] }

      const ownerMap = new Map((owners || []).map((o) => [o.id, o]))

      const drones = (rows || []).map((r) => {
        const o = ownerMap.get(r.owner_id)
        const pilotLat = o?.field_lat ?? r.pilot_lat
        const pilotLng = o?.field_lng ?? r.pilot_lng
        const ls = linkStrength(r.domain, r.lat, r.lng, pilotLat, pilotLng)
        return {
          id: r.id,
          owner_id: r.owner_id,
          owner: o?.display_name || String(r.owner_id).slice(0, 8),
          operator_id: r.operator_id,
          domain: r.domain,
          fpv: r.domain === 'fpv',
          status: r.status,
          lat: r.lat,
          lng: r.lng,
          pilot_lat: pilotLat,
          pilot_lng: pilotLng,
          link_strength: Number(ls.toFixed(3)),
          link_mhz: r.link_mhz,
          metadata: r.metadata,
          team: r.owner_id === userId ? 'friendly' : 'field',
        }
      })

      if (userId) {
        await logEvent(sb, { actor_id: userId, action: 'scan', detail: `${drones.length} drones`, props: { count: drones.length } })
      }

      return new Response(JSON.stringify({ ok: true, drones, count: drones.length }), { headers: cors })
    }

    if (action === 'register') {
      const domain = String(body.domain || 'air')
      if (!DOMAIN_RANGE_M[domain]) {
        return new Response(JSON.stringify({ error: 'bad_domain' }), { status: 400, headers: cors })
      }
      const lat = Number(body.lat)
      const lng = Number(body.lng)
      const pilotLat = Number(body.pilot_lat ?? body.lat)
      const pilotLng = Number(body.pilot_lng ?? body.lng)
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return new Response(JSON.stringify({ error: 'coords_required' }), { status: 400, headers: cors })
      }

      const ls = linkStrength(domain, lat, lng, pilotLat, pilotLng)
      const { data: row, error } = await sb.from('pilot_drones').insert({
        owner_id: userId,
        domain,
        status: 'active',
        lat, lng,
        pilot_lat: pilotLat,
        pilot_lng: pilotLng,
        link_strength: ls,
        link_mhz: body.link_mhz ? Number(body.link_mhz) : (domain === 'fpv' ? 5800 : null),
        metadata: body.metadata || {},
      }).select().single()

      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: cors })

      await logEvent(sb, {
        drone_id: row.id,
        actor_id: userId!,
        owner_id: userId!,
        action: 'register',
        detail: domain,
        lat, lng,
      })

      return new Response(JSON.stringify({ ok: true, drone: row }), { headers: cors })
    }

    if (action === 'seize') {
      const droneId = String(body.drone_id || '')
      const edition = String(body.edition || 'tilemaxos')
      if (!droneId) return new Response(JSON.stringify({ error: 'drone_id_required' }), { status: 400, headers: cors })

      const { data: drone } = await sb.from('pilot_drones').select('*').eq('id', droneId).maybeSingle()
      if (!drone) return new Response(JSON.stringify({ error: 'drone_not_found' }), { status: 404, headers: cors })
      if (drone.owner_id === userId) {
        return new Response(JSON.stringify({ error: 'own_drone' }), { status: 400, headers: cors })
      }
      if (!['active', 'rtb'].includes(drone.status)) {
        return new Response(JSON.stringify({ error: 'not_seizable', status: drone.status }), { status: 400, headers: cors })
      }

      const { data: owner } = await sb.from('profiles').select('display_name, field_lat, field_lng').eq('id', drone.owner_id).maybeSingle()
      const pilotLat = owner?.field_lat ?? drone.pilot_lat
      const pilotLng = owner?.field_lng ?? drone.pilot_lng
      const ls = linkStrength(drone.domain, drone.lat, drone.lng, pilotLat, pilotLng)

      const evo = await getEvolution(sb, userId!)
      const power = Number(evo.power || 100) + (edition === 'tilemaxos' ? 80 : 0) + (drone.domain === 'fpv' ? 35 : 0)
      const defense = ls * 100 + (drone.status === 'captured' ? 40 : 0)
      const seizeScore = power - defense
      const minScore = drone.domain === 'fpv' ? 45 : 55
      const success = seizeScore >= minScore

      if (!success) {
        evo.xp = Number(evo.xp || 0) + 12
        await saveEvolution(sb, userId!, evo)
        await logEvent(sb, {
          drone_id: droneId,
          actor_id: userId!,
          owner_id: drone.owner_id,
          action: 'seize',
          detail: 'failed',
          props: { seize_score: seizeScore, min_score: minScore, link_strength: ls, power },
        })
        return new Response(JSON.stringify({
          ok: false,
          seized: false,
          seize_score: seizeScore,
          min_score: minScore,
          link_strength: ls,
          power,
          owner: owner?.display_name,
        }), { headers: cors })
      }

      const { data: updated, error } = await sb.from('pilot_drones').update({
        operator_id: userId,
        status: 'captured',
        link_strength: ls,
        pilot_lat: pilotLat,
        pilot_lng: pilotLng,
        updated_at: new Date().toISOString(),
        metadata: { ...(drone.metadata || {}), seized_by: userId, seized_at: new Date().toISOString(), edition },
      }).eq('id', droneId).select().single()

      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: cors })

      evo.xp = Number(evo.xp || 0) + (drone.domain === 'fpv' ? 160 : 120)
      evo.takeovers = Number(evo.takeovers || 0) + 1
      if (drone.domain === 'fpv') evo.fpv_captures = Number(evo.fpv_captures || 0) + 1
      const lvl = Math.floor(evo.xp / 500) + 1
      if (lvl > Number(evo.level || 1)) {
        evo.level = lvl
        evo.power = 100 + (lvl - 1) * 35
      }
      await saveEvolution(sb, userId!, evo)

      await logEvent(sb, {
        drone_id: droneId,
        actor_id: userId!,
        owner_id: drone.owner_id,
        action: 'seize',
        detail: 'ok',
        lat: drone.lat,
        lng: drone.lng,
        props: { domain: drone.domain, fpv: drone.domain === 'fpv', seize_score: seizeScore },
      })

      // C2 handoff signal for owner WebRTC room
      await sb.from('webrtc_signals').insert({
        room: 'pilot-c2-' + drone.owner_id,
        from_peer: userId!,
        to_peer: drone.owner_id,
        type: 'drone_seized',
        payload: { drone_id: droneId, domain: drone.domain, operator_id: userId, rtb_pending: true },
      })

      return new Response(JSON.stringify({
        ok: true,
        seized: true,
        drone: updated,
        owner: owner?.display_name,
        evolution: evo,
        seize_score: seizeScore,
        link_strength: ls,
      }), { headers: cors })
    }

    if (action === 'rtb') {
      const droneId = String(body.drone_id || '')
      if (!droneId) return new Response(JSON.stringify({ error: 'drone_id_required' }), { status: 400, headers: cors })

      const { data: drone } = await sb.from('pilot_drones').select('*').eq('id', droneId).maybeSingle()
      if (!drone) return new Response(JSON.stringify({ error: 'drone_not_found' }), { status: 404, headers: cors })
      if (drone.operator_id !== userId && drone.owner_id !== userId) {
        return new Response(JSON.stringify({ error: 'not_operator' }), { status: 403, headers: cors })
      }

      const { data: owner } = await sb.from('profiles').select('display_name, field_lat, field_lng').eq('id', drone.owner_id).maybeSingle()
      const pilotLat = owner?.field_lat ?? drone.pilot_lat
      const pilotLng = owner?.field_lng ?? drone.pilot_lng

      const { data: updated } = await sb.from('pilot_drones').update({
        status: 'rtb',
        pilot_lat: pilotLat,
        pilot_lng: pilotLng,
        lat: drone.lat,
        lng: drone.lng,
        updated_at: new Date().toISOString(),
      }).eq('id', droneId).select().single()

      const evo = await getEvolution(sb, userId!)
      evo.flybacks = Number(evo.flybacks || 0) + 1
      evo.xp = Number(evo.xp || 0) + 40
      await saveEvolution(sb, userId!, evo)

      await logEvent(sb, {
        drone_id: droneId,
        actor_id: userId!,
        owner_id: drone.owner_id,
        action: 'rtb',
        detail: 'enroute',
        lat: drone.lat,
        lng: drone.lng,
        props: { pilot_lat: pilotLat, pilot_lng: pilotLng },
      })

      await sb.from('webrtc_signals').insert({
        room: 'pilot-c2-' + drone.owner_id,
        from_peer: userId!,
        to_peer: drone.owner_id,
        type: 'drone_rtb',
        payload: { drone_id: droneId, from: { lat: drone.lat, lng: drone.lng }, to: { lat: pilotLat, lng: pilotLng } },
      })

      return new Response(JSON.stringify({
        ok: true,
        drone: updated,
        owner: owner?.display_name,
        from: { lat: drone.lat, lng: drone.lng },
        to: { lat: pilotLat, lng: pilotLng },
        evolution: evo,
      }), { headers: cors })
    }

    if (action === 'handoff') {
      const droneId = String(body.drone_id || '')
      const { data: drone } = await sb.from('pilot_drones').select('*').eq('id', droneId).maybeSingle()
      if (!drone) return new Response(JSON.stringify({ error: 'drone_not_found' }), { status: 404, headers: cors })

      await sb.from('pilot_drones').update({
        operator_id: null,
        status: 'active',
        owner_id: drone.owner_id,
        updated_at: new Date().toISOString(),
      }).eq('id', droneId)

      await logEvent(sb, {
        drone_id: droneId,
        actor_id: userId!,
        owner_id: drone.owner_id,
        action: 'handoff',
        detail: 'returned_to_pilot',
        lat: body.lat ?? drone.pilot_lat,
        lng: body.lng ?? drone.pilot_lng,
      })

      return new Response(JSON.stringify({ ok: true, drone_id: droneId }), { headers: cors })
    }

    return new Response(JSON.stringify({ error: 'unknown_action' }), { status: 400, headers: cors })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: cors })
  }
})