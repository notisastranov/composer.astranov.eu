// node-batch: launch work-together batches + register decentralized Astranov nodes

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
}

const COLLECTIVE_SESSION_NAME = 'ASTRANOV COLLECTIVE INTELLIGENCE'
const COLLECTIVE_BATCH_SHORT_ID = 'ACI'

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
    const action = String(body.action || 'launch')

    if (!userId) {
      return new Response(JSON.stringify({ error: 'login_required' }), { status: 401, headers: cors })
    }

    if (action === 'session_get') {
      const { data } = await sb.from('profiles').select('globe_session').eq('id', userId).maybeSingle()
      return new Response(JSON.stringify({ ok: true, session: data?.globe_session || {} }), { headers: cors })
    }

    if (action === 'session_save') {
      const session = body.session && typeof body.session === 'object' ? body.session : {}
      await sb.from('profiles').update({ globe_session: session, updated_at: new Date().toISOString() }).eq('id', userId)
      return new Response(JSON.stringify({ ok: true }), { headers: cors })
    }

    if (action === 'session_purge') {
      const result = await unifyOwnerSession(sb, userId)
      return new Response(JSON.stringify({ ok: true, ...result }), { headers: cors })
    }

    if (action === 'resume') {
      const batch = await findActiveBatch(sb, userId)
      if (!batch) {
        return new Response(JSON.stringify({ ok: false, resume: false, error: 'no_active_batch' }), { headers: cors })
      }
      const nodeId = resolveNodeId(userId, body)
      const joined = await registerNode(sb, {
        nodeId,
        userId,
        batchId: batch.id,
        body,
      })
      const peers = await peerCount(sb, batch.id)
      return new Response(JSON.stringify({
        ok: true,
        resume: true,
        batch_id: batch.id,
        short_id: batch.short_id,
        node_id: joined.nodeId,
        channel: 'astranov-batch-' + batch.short_id,
        peers,
      }), { headers: cors })
    }

    if (action === 'launch') {
      const forceNew = !!body.force_new
      let batch = forceNew ? null : await findActiveBatch(sb, userId)

      if (!batch) {
        const shortId = String(body.batch_short_id || COLLECTIVE_BATCH_SHORT_ID)
        let created = null
        let error = null
        const ins = await sb.from('astranov_batches').insert({
          owner_id: userId,
          status: 'open',
          short_id: shortId,
        }).select().single()
        created = ins.data
        error = ins.error
        if (error?.code === '23505') {
          const retry = await sb.from('astranov_batches').insert({
            owner_id: userId,
            status: 'open',
          }).select().single()
          created = retry.data
          error = retry.error
        }
        if (error) throw error
        batch = created
      }

      const nodeId = resolveNodeId(userId, body)
      await registerNode(sb, {
        nodeId,
        userId,
        batchId: batch!.id,
        body,
      })

      if (!forceNew && batch) {
        const detail = `batch join ${batch.short_id}`
        await sb.from('field_events').insert({
          user_id: userId,
          role: 'client',
          action: 'batch',
          detail,
          lat: typeof body.lat === 'number' ? body.lat : null,
          lng: typeof body.lng === 'number' ? body.lng : null,
          props: { batch_id: batch.id, node_id: nodeId, resumed: !forceNew },
          brain_synced: true,
        }).catch(() => {})
      } else {
        await sb.from('field_events').insert({
          user_id: userId,
          role: 'client',
          action: 'batch',
          detail: `batch launch ${batch!.short_id}`,
          lat: typeof body.lat === 'number' ? body.lat : null,
          lng: typeof body.lng === 'number' ? body.lng : null,
          props: { batch_id: batch!.id, node_id: nodeId },
          brain_synced: true,
        }).catch(() => {})
      }

      const peers = await peerCount(sb, batch!.id)

      return new Response(JSON.stringify({
        ok: true,
        resumed: !forceNew && !!batch,
        batch_id: batch!.id,
        short_id: batch!.short_id,
        session_name: COLLECTIVE_SESSION_NAME,
        node_id: nodeId,
        channel: 'astranov-batch-' + batch!.short_id,
        peers,
      }), { headers: cors })
    }

    if (action === 'register') {
      const batchId = body.batch_id
      if (!batchId) {
        return new Response(JSON.stringify({ error: 'batch_id required' }), { status: 400, headers: cors })
      }
      const nodeId = resolveNodeId(userId, body)
      await registerNode(sb, { nodeId, userId, batchId, body })
      const peers = await peerCount(sb, batchId)
      const { data: batch } = await sb.from('astranov_batches').select('short_id').eq('id', batchId).single()
      return new Response(JSON.stringify({
        ok: true,
        node_id: nodeId,
        peers,
        channel: batch ? 'astranov-batch-' + batch.short_id : null,
      }), { headers: cors })
    }

    if (action === 'heartbeat') {
      const nodeId = String(body.node_id || '')
      if (!nodeId) {
        return new Response(JSON.stringify({ error: 'node_id required' }), { status: 400, headers: cors })
      }
      await sb.from('astranov_nodes').update({
        last_seen: new Date().toISOString(),
        lat: typeof body.lat === 'number' ? body.lat : undefined,
        lng: typeof body.lng === 'number' ? body.lng : undefined,
        is_active: true,
      }).eq('node_id', nodeId).eq('user_id', userId)
      const batchId = body.batch_id
      const peers = batchId ? await peerCount(sb, batchId) : 0
      return new Response(JSON.stringify({ ok: true, peers }), { headers: cors })
    }

    if (action === 'peers') {
      const batchId = body.batch_id
      if (!batchId) {
        return new Response(JSON.stringify({ error: 'batch_id required' }), { status: 400, headers: cors })
      }
      const since = new Date(Date.now() - 5 * 60 * 1000).toISOString()
      const { data: nodes } = await sb.from('astranov_nodes')
        .select('node_id, user_id, platform, install_mode, lat, lng, last_seen, props')
        .eq('batch_id', batchId)
        .eq('is_active', true)
        .gte('last_seen', since)
        .order('last_seen', { ascending: false })
        .limit(40)
      return new Response(JSON.stringify({ ok: true, peers: nodes?.length || 0, nodes: nodes || [] }), { headers: cors })
    }

    return new Response(JSON.stringify({
      error: 'unknown action',
      actions: ['launch', 'resume', 'register', 'heartbeat', 'peers', 'session_get', 'session_save', 'session_purge'],
    }), { status: 400, headers: cors })
  } catch (e) {
    const err = e && typeof e === 'object' && 'message' in e ? String((e as { message?: string }).message) : String(e)
    return new Response(JSON.stringify({ ok: false, error: err }), { status: 500, headers: cors })
  }
})

async function unifyOwnerSession(sb: ReturnType<typeof createClient>, userId: string) {
  const { data: openBatches } = await sb.from('astranov_batches')
    .select('id, short_id, created_at')
    .eq('owner_id', userId)
    .eq('status', 'open')
    .order('created_at', { ascending: false })

  let canonical = (openBatches || []).find(b => b.short_id === COLLECTIVE_BATCH_SHORT_ID) || null

  if (!canonical) {
    const ins = await sb.from('astranov_batches').insert({
      owner_id: userId,
      status: 'open',
      short_id: COLLECTIVE_BATCH_SHORT_ID,
    }).select('id, short_id, created_at').single()
    if (ins.error?.code === '23505') {
      const retry = await sb.from('astranov_batches')
        .select('id, short_id, created_at')
        .eq('owner_id', userId)
        .eq('short_id', COLLECTIVE_BATCH_SHORT_ID)
        .eq('status', 'open')
        .maybeSingle()
      canonical = retry.data
    } else {
      canonical = ins.data
    }
  }

  const closeIds = (openBatches || [])
    .filter(b => canonical && b.id !== canonical.id)
    .map(b => b.id)

  if (closeIds.length) {
    await sb.from('astranov_batches').update({ status: 'closed' }).in('id', closeIds)
    await sb.from('astranov_nodes').update({ batch_id: canonical!.id }).in('batch_id', closeIds)
  }

  const { data: prof } = await sb.from('profiles').select('globe_session').eq('id', userId).maybeSingle()
  const prev = prof?.globe_session && typeof prof.globe_session === 'object' ? prof.globe_session : {}
  const session = {
    ...prev,
    sessionName: COLLECTIVE_SESSION_NAME,
    shortId: COLLECTIVE_BATCH_SHORT_ID,
    batchLabel: COLLECTIVE_SESSION_NAME,
    updatedAt: Date.now(),
  }
  await sb.from('profiles').update({ globe_session: session, updated_at: new Date().toISOString() }).eq('id', userId)

  return {
    batch_id: canonical?.id,
    short_id: canonical?.short_id || COLLECTIVE_BATCH_SHORT_ID,
    session_name: COLLECTIVE_SESSION_NAME,
    closed: closeIds.length,
  }
}

async function findActiveBatch(sb: ReturnType<typeof createClient>, userId: string) {
  const since = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString()

  const { data: canonical } = await sb.from('astranov_batches')
    .select('id, short_id, status, created_at')
    .eq('owner_id', userId)
    .eq('short_id', COLLECTIVE_BATCH_SHORT_ID)
    .eq('status', 'open')
    .maybeSingle()
  if (canonical) return canonical

  const { data: batch } = await sb.from('astranov_batches')
    .select('id, short_id, status, created_at')
    .eq('owner_id', userId)
    .eq('status', 'open')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return batch
}

function resolveNodeId(userId: string, body: Record<string, unknown>) {
  if (body.node_id) return String(body.node_id)
  const device = String(body.device_id || 'web').slice(0, 12)
  return 'node-' + userId.slice(0, 8) + '-' + device
}

async function registerNode(
  sb: ReturnType<typeof createClient>,
  opts: { nodeId: string; userId: string; batchId: string; body: Record<string, unknown> },
) {
  const { nodeId, userId, batchId, body } = opts
  await sb.from('astranov_nodes').upsert({
    node_id: nodeId,
    user_id: userId,
    batch_id: batchId,
    platform: body.platform ?? 'web',
    install_mode: body.install_mode ?? 'browser',
    lat: typeof body.lat === 'number' ? body.lat : null,
    lng: typeof body.lng === 'number' ? body.lng : null,
    props: { ...(body.props as object || {}), device_id: body.device_id || null },
    last_seen: new Date().toISOString(),
    is_active: true,
  }, { onConflict: 'node_id' })
  return { nodeId }
}

async function peerCount(sb: ReturnType<typeof createClient>, batchId: string) {
  const since = new Date(Date.now() - 5 * 60 * 1000).toISOString()
  const { count } = await sb.from('astranov_nodes')
    .select('*', { count: 'exact', head: true })
    .eq('batch_id', batchId)
    .eq('is_active', true)
    .gte('last_seen', since)
  return count || 0
}