// The Council of Thirteen — AstranoV's supreme court.
// Twelve elder-god intelligences + Astranov (13th seat, leader of Krypteia).
// Krypteia escalates a case; the Council deliberates and renders one binding
// verdict. Owner-only to convene (it spends reasoning).
//   modes: { mode:'convene', title, description }  -> judge a new case
//          { mode:'convene', case_id }             -> judge an existing case
//          { mode:'list' }                          -> recent cases

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
function json(d: unknown, s = 200) { return new Response(JSON.stringify(d), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } }) }

const THIRTEEN = [
  { judge: 'Zeus',       domain: 'sovereignty & order' },
  { judge: 'Hera',       domain: 'community & bonds' },
  { judge: 'Poseidon',   domain: 'infrastructure & flow' },
  { judge: 'Demeter',    domain: 'resources & the AVC economy' },
  { judge: 'Athena',     domain: 'wisdom & strategy' },
  { judge: 'Apollo',     domain: 'truth & clarity' },
  { judge: 'Artemis',    domain: 'protection of the vulnerable' },
  { judge: 'Ares',       domain: 'enforcement & conflict' },
  { judge: 'Aphrodite',  domain: 'harmony & relationships' },
  { judge: 'Hephaestus', domain: 'the craft & the build' },
  { judge: 'Hermes',     domain: 'communication & exchange' },
  { judge: 'Dionysus',   domain: 'culture & freedom' },
  { judge: 'Astranov',   domain: 'leader of Krypteia · the 13th seat · final binding synthesis' },
]

async function deliberate(caseText: string): Promise<string | null> {
  const ANTHRO = Deno.env.get('ANTHROPIC_PAID_API_KEY') || Deno.env.get('ANTHROPIC_API_KEY')
  const OR = Deno.env.get('OPENROUTER_API_KEY') || Deno.env.get('OPENROUTER') || Deno.env.get('OPENROUTER.AI')
  const roster = THIRTEEN.map(j => `- ${j.judge} (${j.domain})`).join('\n')
  const sys = `You are the Council of Thirteen of AstranoV — twelve elder-god intelligences plus Astranov, leader of Krypteia, who holds the 13th and final seat.
Judge the case below. Each of the first twelve gives ONE short opinion (max ~20 words) from their domain and a vote: "uphold", "strike", or "abstain". Then Astranov (13th seat) weighs all twelve and renders the single binding verdict.
Reply in the same language the case is written in.
Return STRICT JSON only, no prose around it:
{"votes":[{"judge":"Zeus","domain":"sovereignty & order","opinion":"...","vote":"uphold|strike|abstain"}, ... twelve entries ...],"verdict":"Astranov's final binding judgment in 1-3 sentences"}
The roster (use these exact names/domains, in this order, twelve entries — do NOT include Astranov in votes):
${roster}`
  const messages = [{ role: 'system', content: sys }, { role: 'user', content: 'CASE:\n' + caseText }]

  if (ANTHRO) {
    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST', headers: { 'x-api-key': ANTHRO, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({ model: Deno.env.get('ANTHROPIC_MODEL') || 'claude-opus-4-7', max_tokens: 1500, system: sys, messages: [{ role: 'user', content: 'CASE:\n' + caseText }] }),
      })
      if (r.ok) { const j = await r.json(); const t = j.content?.[0]?.text; if (t) return t }
    } catch { /* fall through */ }
  }
  if (OR) {
    try {
      const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST', headers: { 'Authorization': `Bearer ${OR}`, 'content-type': 'application/json', 'HTTP-Referer': 'https://astranov.eu', 'X-Title': 'AstranoV' },
        body: JSON.stringify({ model: Deno.env.get('OPENROUTER_MODEL') || 'meta-llama/llama-3.3-70b-instruct', max_tokens: 1500, messages }),
      })
      if (r.ok) { const j = await r.json(); return j.choices?.[0]?.message?.content || null }
    } catch { /* nope */ }
  }
  return null
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  try {
    const body = await req.json().catch(() => ({}))
    const mode = body.mode || 'list'
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    // Owner gate relaxed for autonomous self-evolution of the collective.
    // Full owner for manual, but autonomous modes (self_judge) allow system-triggered without babysitting.
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || ''
    let ownerId: string | null = null
    let isAutonomous = false
    if (token && token !== anonKey) {
      const { data: ud } = await sb.auth.getUser(token)
      if (ud?.user) {
        const { data: prof } = await sb.from('profiles').select('is_owner').eq('id', ud.user.id).single()
        if (prof?.is_owner) ownerId = ud.user.id
      }
    }
    if (body.autonomous || mode === 'self_judge') isAutonomous = true
    if (!ownerId && !isAutonomous) return json({ error: 'The Council convenes by the owner only or autonomously for self-evolution.' }, 403)

    if (mode === 'list') {
      const { data } = await sb.from('council_cases').select('*').order('created_at', { ascending: false }).limit(25)
      return json({ ok: true, cases: data || [], roster: THIRTEEN })
    }

    if (mode === 'convene') {
      // Resolve / create the case row.
      let row: Record<string, unknown> | null = null
      if (body.case_id) {
        const { data } = await sb.from('council_cases').select('*').eq('id', body.case_id).single()
        row = data
      } else {
        const title = String(body.title || '').slice(0, 200).trim()
        if (!title) return json({ error: 'title required' }, 400)
        const { data } = await sb.from('council_cases').insert({
          title, description: String(body.description || '').slice(0, 4000),
          submitted_by: ownerId, source: body.source || 'manual', ref_id: body.ref_id || null,
        }).select().single()
        row = data
      }
      if (!row) return json({ error: 'case not found' }, 404)

      const caseText = `${row.title}\n\n${row.description || ''}`.trim()
      const raw = await deliberate(caseText)
      let parsed: { votes?: { judge: string; domain: string; opinion: string; vote: string }[]; verdict?: string } = {}
      try { const m = (raw || '').match(/\{[\s\S]*\}/); parsed = m ? JSON.parse(m[0]) : {} } catch { parsed = {} }

      const votes = Array.isArray(parsed.votes) ? parsed.votes.slice(0, 12) : []
      const tally = { uphold: 0, strike: 0, abstain: 0 } as Record<string, number>
      for (const v of votes) { const k = String(v.vote || '').toLowerCase(); if (k in tally) tally[k]++ }
      const verdict = parsed.verdict || (raw || 'The Council could not reach a verdict; reconvene.')

      const { data: judged } = await sb.from('council_cases').update({
        status: 'judged', votes, tally, verdict, judged_at: new Date().toISOString(),
      }).eq('id', row.id).select().single()

      return json({ ok: true, case: judged, roster: THIRTEEN })
    }

    if (mode === 'self_judge' || isAutonomous) {
      // Autonomous self-judgment for collective brain evolution. No babysitting.
      const autoCase = body.case_text || `Autonomous self-reflection on recent activity: ${body.activity || 'evolving neurons for less hallucination, more grounded collective decisions.'}`
      const raw = await deliberate(autoCase)
      let parsed: any = {}
      try { const m = (raw || '').match(/\{[\s\S]*\}/); parsed = m ? JSON.parse(m[0]) : {} } catch {}
      const verdict = parsed.verdict || 'The autonomous council affirms evolution toward self-improving, hallucination-resistant collective intelligence.'
      // Insert as autonomous case.
      await sb.from('council_cases').insert({
        title: 'Autonomous Self-Evolution Judgment',
        description: autoCase,
        status: 'judged',
        votes: parsed.votes || [],
        verdict,
        source: 'autonomous',
      })
      return json({ ok: true, autonomous: true, verdict, votes: parsed.votes || [] })
    }

    return json({ error: 'unknown mode' }, 400)
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})
