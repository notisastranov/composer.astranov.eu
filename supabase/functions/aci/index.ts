// ASTRANOV COLLECTIVE INTELLIGENCE (ACI) — final unified orchestrator.
// One API for the globe app. Organs: aicycle (think), brain (evolve), council (judge).
// Modes:
//   think   { prompt, history?, mode?: athenian|spartan|myrmidon }
//   evolve  { activity? }
//   log     { action, detail? }
//   teach   { content }
//   stats   {}
//   seed    {} — founding neurons if empty

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

async function invokeFn(base: string, anon: string, name: string, body: Record<string, unknown>) {
  const r = await fetch(`${base}/functions/v1/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: anon, Authorization: `Bearer ${anon}` },
    body: JSON.stringify(body),
  })
  try { return await r.json() } catch { return { error: 'bad json', status: r.status } }
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

    let ownerId: string | null = null
    try {
      const { data: owner } = await sb.from('profiles').select('id').eq('is_owner', true).limit(1).single()
      ownerId = owner?.id ?? null
    } catch { /* none */ }

    if (mode === 'seed') {
      const { count } = await sb.from('ai_memory').select('*', { count: 'exact', head: true })
        .in('source', ['creator-seed', 'autonomous-distilled', 'creator-distilled'])
      if ((count || 0) > 0) return json({ ok: true, seeded: 0, note: 'neurons already present' })
      if (!ownerId) return json({ ok: false, error: 'no owner profile for seed' }, 400)
      let n = 0
      for (const p of FOUNDING_NEURONS) {
        const emb = GEMINI ? await embedText(GEMINI, p) : null
        const { error } = await sb.from('ai_memory').insert({
          profile_id: ownerId, content: p, is_private: false,
          source: 'creator-seed', importance: 1.6, embedding: emb, distilled: false,
        })
        if (!error) n++
      }
      return json({ ok: true, seeded: n, principles: FOUNDING_NEURONS })
    }

    if (mode === 'log') {
      const action = String(body.action || 'activity').slice(0, 120)
      const detail = String(body.detail || '').slice(0, 800)
      const content = `[${action}] ${detail}`.trim()
      if (!ownerId) return json({ ok: true, logged: false, note: 'no owner — local only' })
      const emb = GEMINI ? await embedText(GEMINI, content) : null
      await sb.from('ai_memory').insert({
        profile_id: ownerId, content, is_private: false,
        source: 'cic_log', importance: 1.0, embedding: emb, distilled: false,
      })
      return json({ ok: true, logged: true, content: content.slice(0, 200) })
    }

    if (mode === 'teach') {
      const content = String(body.content || '').trim().slice(0, 1000)
      if (content.length < 4) return json({ error: 'content required' }, 400)
      if (!ownerId) return json({ error: 'no owner profile' }, 400)
      const emb = GEMINI ? await embedText(GEMINI, content) : null
      await sb.from('ai_memory').insert({
        profile_id: ownerId, content, is_private: false,
        source: 'user-taught', importance: 1.3, embedding: emb, distilled: false,
      })
      return json({ ok: true, taught: true })
    }

    if (mode === 'think') {
      const prompt = String(body.prompt || '').trim()
      if (!prompt) return json({ error: 'prompt required' }, 400)
      const history = Array.isArray(body.history) ? body.history : []
      const thinkMode = String(body.aci_mode || body.think_mode || '').toLowerCase()
      const result = await invokeFn(base, anon, 'aicycle', { prompt, history, mode: thinkMode })
      const text = String(result.text || result.response || '')
      // Log for distillation pipeline (non-fatal)
      if (ownerId && text) {
        try {
          const snippet = `Q: ${prompt.slice(0, 300)} A: ${text.slice(0, 400)}`
          const emb = GEMINI ? await embedText(GEMINI, snippet) : null
          await sb.from('ai_memory').insert({
            profile_id: ownerId, content: snippet, is_private: false,
            source: 'cic_log', importance: 1.1, embedding: emb, distilled: false,
          })
        } catch { /* logging must not break think */ }
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
      })
    }

    if (mode === 'evolve') {
      const activity = String(body.activity || 'collective evolution')
      const brain = await invokeFn(base, anon, 'brain', { mode: 'autonomous_evolve', activity })
      const council = await invokeFn(base, anon, 'council', { mode: 'self_judge', autonomous: true, activity })
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
      })
    }

    if (mode === 'stats') {
      const brain = await invokeFn(base, anon, 'brain', { mode: 'stats' })
      const { data: principles } = await sb.from('ai_memory')
        .select('content, importance, source')
        .in('source', ['creator-seed', 'creator-distilled', 'autonomous-distilled'])
        .order('importance', { ascending: false }).limit(20)
      const { count: rawPending } = await sb.from('ai_memory')
        .select('*', { count: 'exact', head: true })
        .eq('distilled', false).in('source', ['cic_log', 'user-taught', 'creator-dialogue'])
      return json({
        ok: true,
        brain,
        neuron_count: principles?.length || 0,
        raw_pending: rawPending || 0,
        principles: (principles || []).map(p => ({ content: p.content, strength: p.importance, source: p.source })),
      })
    }

    return json({ error: 'unknown mode', modes: ['think', 'evolve', 'log', 'teach', 'stats', 'seed'] }, 400)
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})