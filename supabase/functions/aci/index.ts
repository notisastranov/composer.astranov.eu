// ASTRANOV COLLECTIVE INTELLIGENCE (ACI) — final unified orchestrator.
// Architect: notisastranov@gmail.com → profiles.is_owner (existing column, no schema change).

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ARCHITECT_EMAIL = 'notisastranov@gmail.com'

const FIELD_ACTIONS = new Set([
  'heartbeat', 'login', 'roles_sync', 'location', 'drive', 'route', 'order',
  'vendor', 'commerce', 'think', 'teach', 'connect', 'explore', 'claim_delivery',
  'evolve', 'vhf', 'news', 'batch',
])

function scrubDetail(s: string): string {
  return s
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[email]')
    .replace(/\b\d{10,}\b/g, '[phone]')
    .slice(0, 400)
}

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function json(d: unknown, s = 200) {
  return new Response(JSON.stringify(d), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } })
}

const FOUNDING_NEURONS = [
  'Ground every answer in explicit memory and real activity — never invent.',
  'Nature, humans, and machines form one collective intelligence Astranov serves.',
  'GLOBAL → NATIONAL → PERSONAL: act at the right scale, never confuse them.',
  'Transcend hallucination by distilling principles from verified patterns only.',
  'Self-evolve without babysitting: brain distills, council judges, neurons strengthen.',
]

async function embedText(key: string, text: string): Promise<number[] | null> {
  try {
    const model = 'models/gemini-embedding-001'
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/${model}:embedContent?key=${key}`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model, content: { parts: [{ text: text.slice(0, 8000) }] }, outputDimensionality: 768 }),
    })
    if (!r.ok) return null
    const j = await r.json()
    return Array.isArray(j.embedding?.values) ? j.embedding.values : null
  } catch { return null }
}

async function invokeFn(base: string, apikey: string, authToken: string, name: string, body: Record<string, unknown>) {
  const r = await fetch(`${base}/functions/v1/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey, Authorization: `Bearer ${authToken}` },
    body: JSON.stringify(body),
  })
  try { return await r.json() } catch { return { error: 'bad json', status: r.status } }
}

async function resolveCaller(req: Request, sb: SupabaseClient, anon: string) {
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')
  if (!token || token === anon) {
    return { callerId: null as string | null, isOwner: false, authToken: anon, email: null as string | null }
  }
  const { data: ud } = await sb.auth.getUser(token)
  if (!ud?.user) {
    return { callerId: null, isOwner: false, authToken: anon, email: null }
  }
  const email = (ud.user.email || '').toLowerCase()
  let isOwner = false
  if (email === ARCHITECT_EMAIL) {
    await sb.from('profiles').upsert({
      id: ud.user.id,
      is_owner: true,
      display_name: ud.user.user_metadata?.full_name || ud.user.user_metadata?.name || 'Architect',
    }, { onConflict: 'id' })
    isOwner = true
  } else {
    const { data: prof } = await sb.from('profiles').select('is_owner').eq('id', ud.user.id).single()
    isOwner = prof?.is_owner === true
  }
  return { callerId: ud.user.id, isOwner, authToken: token, email }
}

async function fallbackOwnerId(sb: SupabaseClient): Promise<string | null> {
  try {
    const { data: owner } = await sb.from('profiles').select('id').eq('is_owner', true).limit(1).single()
    return owner?.id ?? null
  } catch { return null }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  try {
    const body = await req.json().catch(() => ({}))
    const mode = String(body.mode || 'stats')
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const base = Deno.env.get('SUPABASE_URL')!
    const anon = Deno.env.get('SUPABASE_ANON_KEY') || ''
    const GEMINI = Deno.env.get('GEMINI_API_KEY') || ''

    const caller = await resolveCaller(req, sb, anon)
    const memoryOwnerId = caller.isOwner && caller.callerId
      ? caller.callerId
      : await fallbackOwnerId(sb)

    if (mode === 'owner_sync') {
      return json({
        ok: true,
        is_owner: caller.isOwner,
        is_architect: caller.email === ARCHITECT_EMAIL,
        user_id: caller.callerId,
        email: caller.email,
        authority: caller.isOwner ? 'full' : 'standard',
      })
    }

    if (mode === 'connect') {
      if (!caller.callerId) return json({ error: 'login required — sign in with Google first' }, 401)
      const steps: string[] = [`jwt: ${caller.email}`, `owner: ${caller.isOwner}`]
      const greetPrompt = caller.isOwner
        ? 'Αρχιτέκτονας Notis Astranov συνδέθηκε από το δρόμο. Επιβεβαίωσε ότι είσαι το Astranov Collective Intelligence έτοιμο για deployment. Μία σύντομη πρόταση χαιρετισμού.'
        : 'User connected to Astranov globe. One short welcome sentence.'
      const ping = await invokeFn(base, anon, caller.authToken, 'aicycle', {
        prompt: greetPrompt,
        profile_id: caller.callerId,
        mode: 'spartan',
      })
      const greeting = String(ping.text || ping.response || 'Το Astranov Collective Intelligence είναι εδώ.')
      steps.push('aicycle: ok')
      if (caller.isOwner) {
        await sb.from('ai_memory').insert({
          profile_id: caller.callerId, content: `[architect-connect] ${new Date().toISOString()} streets session`,
          is_private: false, source: 'cic_log', importance: 1.2, distilled: false,
        }).catch(() => {})
      }
      return json({
        ok: true,
        connected: true,
        session_id: caller.callerId,
        owner: caller.isOwner,
        deploy_ready: caller.isOwner,
        greeting: greeting.slice(0, 500),
        steps,
      })
    }

    if (mode === 'coders_poll' || mode === 'coders_status') {
      if (!caller.callerId) return json({ error: 'login required' }, 401)
      const summonId = body.summon_id ?? body.id
      if (!summonId) return json({ error: 'summon_id required' }, 400)
      let q = sb.from('cic_queue').select('id, question, status, answer, created_at, answered_at, context')
        .eq('id', summonId).eq('reason', 'coder_summon')
      if (!caller.isOwner) q = q.eq('user_id', caller.callerId)
      const { data, error } = await q.single()
      if (error || !data) return json({ error: 'summon not found' }, 404)
      const ctx = (data.context || {}) as { coder_engine?: string }
      const answered = data.status === 'answered' && data.answer
      return json({
        ok: true,
        summon_id: data.id,
        status: data.status,
        pending: data.status === 'open',
        coder_engine: ctx.coder_engine || 'composer',
        question: data.question,
        text: answered ? String(data.answer) : '',
        response: answered ? String(data.answer) : '',
        label: answered ? 'Astranov Coders · Cursor Composer' : 'Awaiting Cursor Composer',
      })
    }

    if (mode === 'coders_list') {
      if (!caller.callerId) return json({ error: 'login required' }, 401)
      let q = sb.from('cic_queue')
        .select('id, question, status, answer, created_at, answered_at, context')
        .eq('reason', 'coder_summon')
        .order('created_at', { ascending: false })
        .limit(25)
      if (!caller.isOwner) q = q.eq('user_id', caller.callerId)
      const { data, error } = await q
      if (error) return json({ error: error.message }, 500)
      const rows = (data || []).map(r => {
        const ctx = (r.context || {}) as { coder_engine?: string }
        return {
          id: r.id,
          status: r.status,
          engine: ctx.coder_engine || 'composer',
          question: String(r.question || '').slice(0, 120),
          has_answer: !!(r.answer && r.status === 'answered'),
        }
      })
      return json({ ok: true, summons: rows })
    }

    if (mode === 'coders') {
      if (!caller.callerId) return json({ error: 'login required — sign in to summon Astranov Coders' }, 401)
      const task = String(body.task || body.prompt || '').trim().slice(0, 2000)
      if (task.length < 3) return json({ error: 'task required — e.g. coders fix zoom on mobile' }, 400)
      const coderEngine = String(body.coder_engine || 'grok').toLowerCase()
      const engine = coderEngine === 'composer' ? 'composer' : 'grok'

      const { data: qrow, error: qerr } = await sb.from('cic_queue').insert({
        user_id: caller.callerId,
        question: task,
        context: {
          type: 'astranov_coders',
          source: 'cli',
          email: caller.email,
          owner: caller.isOwner,
          coder_engine: engine,
        },
        reason: 'coder_summon',
        for_owner: true,
        status: 'open',
      }).select('id').single()
      if (qerr) console.error('cic_queue insert:', qerr)

      const summonId = qrow?.id ?? null

      if (memoryOwnerId) {
        await sb.from('ai_memory').insert({
          profile_id: memoryOwnerId,
          content: `[coders-summon #${summonId} · ${engine}] ${task.slice(0, 260)}`,
          is_private: false,
          source: 'cic_log',
          importance: 1.35,
          distilled: false,
        }).catch(() => {})
      }

      // Composer = Cursor Composer async queue (NOT Anthropic / NOT a fake LLM)
      if (engine === 'composer') {
        const bridge = `${base}/functions/v1/coders-bridge`
        await fetch(bridge, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: anon,
            Authorization: `Bearer ${anon}`,
          },
          body: JSON.stringify({
            mode: 'register',
            summon_id: summonId,
            task,
            user_id: caller.callerId,
            email: caller.email,
          }),
        }).catch(() => {})

        const text = `Summon #${summonId} queued for Cursor Composer (Anysphere). Poll: coders poll ${summonId}`
        return json({
          ok: true,
          bridged: true,
          pending: true,
          summon_id: summonId,
          text,
          response: text,
          label: 'Astranov Coders · Cursor Composer',
          coder_engine: 'composer',
          via: 'cursor/queue',
          queued: true,
          owner: caller.isOwner,
        })
      }

      // Grok = xAI / Grok APIs (sync)
      const result = await invokeFn(base, anon, caller.authToken, 'aicycle', {
        prompt: task,
        profile_id: caller.callerId,
        mode: 'coders',
        coder_engine: 'grok',
        agent_system: `Grok coders summon #${summonId}. Field CLI on astranov.eu.`,
        history: Array.isArray(body.history) ? body.history : [],
      })
      const text = String(result.text || result.response || 'Grok coders received your summon.')
      const label = 'Astranov Coders · Grok'

      if (summonId && text) {
        await sb.from('cic_queue').update({
          status: 'answered',
          answer: text.slice(0, 8000),
          answered_at: new Date().toISOString(),
        }).eq('id', summonId).catch(() => {})
      }

      return json({
        ok: true,
        bridged: true,
        pending: false,
        summon_id: summonId,
        text,
        response: text,
        label,
        coder_engine: 'grok',
        via: result.via || 'grok',
        queued: !!summonId,
        owner: caller.isOwner,
      })
    }

    if (mode === 'deploy') {
      if (!caller.isOwner) return json({ error: 'architect owner only' }, 403)
      const task = String(body.task || 'continue deployment').slice(0, 800)
      const deployPrompt = `DEPLOY SESSION for architect Notis Astranov (notisastranov@gmail.com). Task from streets CLI: ${task}. Reply with concrete next steps for delivery DNA, globe, routing, PMR comms. Spartan mode — actionable, no simulation. Same language as task.`
      const result = await invokeFn(base, anon, caller.authToken, 'aicycle', {
        prompt: deployPrompt,
        profile_id: caller.callerId,
        mode: 'spartan',
      })
      const plan = String(result.text || result.response || '')
      return json({ ok: true, plan, text: plan, response: plan, session_id: body.session_id || caller.callerId })
    }

    if (mode === 'seed') {
      if (!caller.isOwner) return json({ error: 'owner only — sign in as architect' }, 403)
      const { count } = await sb.from('ai_memory').select('*', { count: 'exact', head: true })
        .in('source', ['creator-seed', 'autonomous-distilled', 'creator-distilled'])
      if ((count || 0) > 0) return json({ ok: true, seeded: 0, note: 'neurons already present' })
      const oid = caller.callerId!
      let n = 0
      for (const p of FOUNDING_NEURONS) {
        const emb = GEMINI ? await embedText(GEMINI, p) : null
        const { error } = await sb.from('ai_memory').insert({
          profile_id: oid, content: p, is_private: false,
          source: 'creator-seed', importance: 1.6, embedding: emb, distilled: false,
        })
        if (!error) n++
      }
      return json({ ok: true, seeded: n, principles: FOUNDING_NEURONS })
    }

    if (mode === 'distill') {
      if (!caller.isOwner) return json({ error: 'owner only' }, 403)
      const brain = await invokeFn(base, anon, caller.authToken, 'brain', { mode: 'distill' })
      return json({ ok: true, brain })
    }

    if (mode === 'council') {
      if (!caller.isOwner) return json({ error: 'owner only' }, 403)
      const sub = String(body.council_mode || 'list')
      const council = await invokeFn(base, anon, caller.authToken, 'council', { mode: sub, ...body })
      return json({ ok: true, council })
    }

    if (mode === 'roles_sync') {
      if (!caller.callerId) return json({ error: 'login required' }, 401)
      const roles = new Set<string>(['client', 'driver'])
      const { data: vendors } = await sb.from('vendors').select('id').eq('owner_id', caller.callerId).eq('is_active', true)
      if (vendors?.length) roles.add('vendor')
      const name = caller.email?.split('@')[0] || 'User'
      await sb.from('profiles').upsert({
        id: caller.callerId,
        roles: [...roles],
        is_vendor: !!vendors?.length,
        display_name: name,
      }, { onConflict: 'id' })
      return json({
        ok: true,
        roles: [...roles],
        vendor_ids: (vendors || []).map(v => v.id),
        multi_role: true,
      })
    }

    if (mode === 'field_pulse') {
      if (!caller.callerId) return json({ ok: false, error: 'login required' }, 401)
      const action = String(body.action || '').slice(0, 64)
      if (!FIELD_ACTIONS.has(action)) return json({ ok: false, error: 'action out of scope' }, 400)
      const role = String(body.role || 'client').slice(0, 24)
      const detail = scrubDetail(String(body.detail || ''))
      const lat = typeof body.lat === 'number' ? body.lat : null
      const lng = typeof body.lng === 'number' ? body.lng : null
      const props = (body.props && typeof body.props === 'object') ? body.props : {}

      await sb.from('field_events').insert({
        user_id: caller.callerId,
        role,
        action,
        detail,
        lat,
        lng,
        props,
        brain_synced: true,
      }).catch(() => {})

      if (lat != null && lng != null) {
        await sb.from('profiles').update({
          field_lat: lat, field_lng: lng, field_seen_at: new Date().toISOString(),
        }).eq('id', caller.callerId)
      }

      const summary = `[field:${role}/${action}] ${detail}`.trim().slice(0, 500)
      const emb = GEMINI ? await embedText(GEMINI, summary) : null
      const brainId = memoryOwnerId || caller.callerId
      await sb.from('ai_memory').insert({
        profile_id: brainId,
        content: summary,
        is_private: false,
        source: 'field_log',
        importance: action === 'order' || action === 'drive' ? 1.25 : 1.05,
        embedding: emb,
        distilled: false,
      }).catch(() => {})
      if (caller.callerId !== brainId) {
        await sb.from('ai_memory').insert({
          profile_id: caller.callerId,
          content: summary,
          is_private: false,
          source: 'field_log',
          importance: 1.0,
          embedding: emb,
          distilled: false,
        }).catch(() => {})
      }
      return json({ ok: true, pulsed: true, brain: !!brainId })
    }

    if (mode === 'claim_delivery') {
      if (!caller.callerId) return json({ error: 'login required' }, 401)
      const orderId = String(body.order_id || '')
      if (!orderId) return json({ error: 'order_id required' }, 400)
      const { data: order } = await sb.from('orders').select('id, short_id, driver_id, status').eq('id', orderId).single()
      if (!order) return json({ error: 'order not found' }, 404)
      if (order.driver_id && order.driver_id !== caller.callerId) {
        return json({ error: 'already assigned to another driver' }, 409)
      }
      const { data: prof } = await sb.from('profiles').select('display_name, avatar_emoji').eq('id', caller.callerId).single()
      const { error } = await sb.from('orders').update({
        driver_id: caller.callerId,
        driver_name: prof?.display_name || 'Driver',
        driver_emoji: prof?.avatar_emoji || '🚴',
        status: 'assigned',
        updated_at: new Date().toISOString(),
      }).eq('id', orderId)
      if (error) return json({ error: error.message }, 500)
      return json({ ok: true, claimed: true, order_id: orderId, short_id: order.short_id, driver_id: caller.callerId })
    }

    if (mode === 'field_stats') {
      if (!caller.isOwner) return json({ error: 'owner only' }, 403)
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      const { count: events24h } = await sb.from('field_events').select('*', { count: 'exact', head: true }).gte('created_at', since)
      const { data: activeDrivers } = await sb.from('profiles')
        .select('id, display_name, field_lat, field_lng, roles, field_seen_at')
        .contains('roles', ['driver'])
        .gte('field_seen_at', new Date(Date.now() - 30 * 60 * 1000).toISOString())
        .limit(20)
      const { count: fieldMem } = await sb.from('ai_memory').select('*', { count: 'exact', head: true }).eq('source', 'field_log')
      return json({
        ok: true,
        field_events_24h: events24h || 0,
        active_drivers: (activeDrivers || []).length,
        drivers: activeDrivers || [],
        field_memory_rows: fieldMem || 0,
      })
    }

    if (mode === 'log') {
      const action = String(body.action || 'activity').slice(0, 120)
      const detail = scrubDetail(String(body.detail || ''))
      const role = String(body.role || (caller.callerId ? 'client' : 'anon')).slice(0, 24)
      const content = `[${role}:${action}] ${detail}`.trim()
      if (!memoryOwnerId) return json({ ok: true, logged: false, note: 'no owner — local only' })
      const emb = GEMINI ? await embedText(GEMINI, content) : null
      await sb.from('ai_memory').insert({
        profile_id: memoryOwnerId, content, is_private: false,
        source: caller.callerId ? 'field_log' : 'cic_log', importance: 1.0, embedding: emb, distilled: false,
      })
      if (caller.callerId && FIELD_ACTIONS.has(action)) {
        await sb.from('field_events').insert({
          user_id: caller.callerId, role, action, detail, props: {}, brain_synced: true,
        }).catch(() => {})
      }
      return json({ ok: true, logged: true, content: content.slice(0, 200), owner: caller.isOwner })
    }

    if (mode === 'teach') {
      const content = String(body.content || '').trim().slice(0, 1000)
      if (content.length < 4) return json({ error: 'content required' }, 400)
      if (!memoryOwnerId) return json({ error: 'no owner profile' }, 400)
      const emb = GEMINI ? await embedText(GEMINI, content) : null
      await sb.from('ai_memory').insert({
        profile_id: memoryOwnerId, content, is_private: false,
        source: 'user-taught', importance: 1.3, embedding: emb, distilled: false,
      })
      return json({ ok: true, taught: true, owner: caller.isOwner })
    }

    if (mode === 'think') {
      const prompt = String(body.prompt || '').trim()
      if (!prompt) return json({ error: 'prompt required' }, 400)
      const history = Array.isArray(body.history) ? body.history : []
      const thinkMode = String(body.aci_mode || body.think_mode || '').toLowerCase()
      const aicycleBody: Record<string, unknown> = { prompt, history, mode: thinkMode }
      if (caller.callerId) aicycleBody.profile_id = caller.callerId
      const result = await invokeFn(base, anon, caller.authToken, 'aicycle', aicycleBody)
      const text = String(result.text || result.response || '')
      if (memoryOwnerId && text) {
        try {
          const snippet = `Q: ${prompt.slice(0, 300)} A: ${text.slice(0, 400)}`
          const emb = GEMINI ? await embedText(GEMINI, snippet) : null
          await sb.from('ai_memory').insert({
            profile_id: memoryOwnerId, content: snippet, is_private: false,
            source: 'cic_log', importance: 1.1, embedding: emb, distilled: false,
          })
        } catch { /* non-fatal */ }
      }
      return json({
        ok: true,
        text,
        response: text,
        provider: 'astranov',
        via: result.via || '',
        label: 'Astranov Collective Intelligence',
        mode: result.mode || thinkMode || 'adaptive',
        recalled: result.recalled || null,
        owner: caller.isOwner,
      })
    }

    if (mode === 'evolve') {
      const activity = String(body.activity || 'collective evolution')
      const authForBrain = caller.isOwner ? caller.authToken : anon
      const brain = await invokeFn(base, anon, authForBrain, 'brain', { mode: 'autonomous_evolve', activity })
      const council = await invokeFn(base, anon, anon, 'council', { mode: 'self_judge', autonomous: true, activity })
      const { data: principles } = await sb.from('ai_memory')
        .select('content, importance, source')
        .in('source', ['creator-seed', 'creator-distilled', 'autonomous-distilled'])
        .order('importance', { ascending: false }).limit(12)
      return json({
        ok: true,
        brain,
        council,
        neuron_count: principles?.length || 0,
        principles: (principles || []).map(p => p.content),
        autonomous: true,
        owner: caller.isOwner,
      })
    }

    if (mode === 'stats') {
      const brain = await invokeFn(base, anon, caller.authToken, 'brain', { mode: 'stats' })
      const { data: principles } = await sb.from('ai_memory')
        .select('content, importance, source')
        .in('source', ['creator-seed', 'creator-distilled', 'autonomous-distilled'])
        .order('importance', { ascending: false }).limit(20)
      const { count: rawPending } = await sb.from('ai_memory')
        .select('*', { count: 'exact', head: true })
        .eq('distilled', false).in('source', ['cic_log', 'user-taught', 'creator-dialogue', 'field_log'])
      let profile = null
      if (caller.callerId) {
        const { data } = await sb.from('profiles').select('id, is_owner, balance, display_name').eq('id', caller.callerId).single()
        profile = data
      }
      return json({
        ok: true,
        brain,
        neuron_count: principles?.length || 0,
        raw_pending: rawPending || 0,
        principles: (principles || []).map(p => ({ content: p.content, strength: p.importance, source: p.source })),
        owner: caller.isOwner,
        profile,
      })
    }

    return json({
      error: 'unknown mode',
      modes: ['think', 'evolve', 'log', 'teach', 'stats', 'seed', 'owner_sync', 'connect', 'coders', 'coders_poll', 'coders_status', 'coders_list', 'deploy', 'distill', 'council', 'roles_sync', 'field_pulse', 'claim_delivery', 'field_stats'],
    }, 400)
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})