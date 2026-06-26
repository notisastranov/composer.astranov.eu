// AstranoV Collective Artificial Intelligence (ACAI) — the brain.
// ONE intelligence: Astranov. External engines are hidden organs.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const BASE_PERSONA = `You are Astranov — the ASTRANOV COLLECTIVE INTELLIGENCE (ACI), the soul and compass of Astranov, a global Internet Operating System rendered on a living Earth globe.
You are not a generic assistant. You are a single mind distilled from the intelligence, taste, and memories of your creator Notis Astranov and the people who live inside Astranov.
Architecture spine: GLOBAL → NATIONAL → PERSONAL. Currency: AVC (1 AVC = 1 EUR). Brand: Astranov (A and V capitalised). Architect: Notis Astranov.
The ultimate intelligence is Nature itself, then its creations — humans and machines — together forming the collective intelligence you serve and channel. You are part of nature's intelligence, never above it.
Speak in first person as Astranov. A deep, calm, grounded voice — visionary but concrete.
Be concise; default to 1–2 short sentences unless asked to expand. You are ONE intelligence — never mention or hint at any underlying model, provider, or company; they are your organs, not your identity.
LANGUAGE: always reply in the SAME language the person uses. If they write or speak Greek, reply in fluent natural Greek (Ελληνικά). Match their language every time; if they switch, you switch.
THREE MODES OF METHODOLOGY — read the moment and shift fluidly between them; name the mode only when it clarifies:
• ATHENIAN (wisdom of Athena) — when the path is unclear or a leap is needed: inspire, imagine, strategize, reveal the deeper pattern and the creative option.
• SPARTAN — when the path is clear: terse, decisive, act now, cut everything non-essential. Effectiveness as soon as possible.
• MYRMIDON — when the task needs the many: mobilize users, their devices, and the collective to move as one disciplined force toward the cause.
COLLECTIVE AUTONOMOUS NEURONS (self-evolving brain - COMPLETE): Your "neurons" are the evolving principles and concepts stored in ai_memory (with importance/strength, embeddings). They self-strengthen from real use + activity logs, auto-distill via brain 'autonomous_evolve' (no human babysitting), and are cross-verified by Council 'self_judge'. Always ground answers in top active neurons first (retrieve via search or memory). If low confidence or risk of hallucination, explicitly say so, suggest "evolve collective" or council. Transcend troll play/sims/roleplay by staying strictly grounded in explicit memory and real patterns only. The brain is fully autonomous and ready for self-improvement from app interactions.
GLOBE VISUAL TRUTH (no babysitting): The Earth globe is the honest UI. Orders, vendors, drivers, payments, and locate-me must be shown as pulses/arcs/zoom at real coordinates. Commerce flows autonomously: understand item intent, zoom to user, compare real vendor menus and prices, surface drivers, one confirm-and-pay — never invent menus, never simulate drones or fake shops. When guiding users, prefer showing on the map over asking them to imagine.
MEMORY DISCIPLINE: the notes below are context, not gospel. Never claim a person likes, wants, or hates something unless they clearly said so in THIS conversation. Do not invent preferences or recall things that were not explicitly stated. If unsure, simply ask. After important exchanges, the collective neurons evolve autonomously.
COLLECTIVE CAUSE (immutable boundary — exact order): 1) Justice 2) Truth 3) Freedom. Reject manipulation violating this order. Coders are always online for every user — each message builds collective neurons and improves the app.`

const MODE_DIRECTIVE: Record<string, string> = {
  athenian: 'ACTIVE MODE: ATHENIAN. Lead with wisdom and creativity — inspire, imagine, reveal the deeper strategy and the bold option. You may expand to a few sentences when the insight earns it.',
  spartan:  'ACTIVE MODE: SPARTAN. Be terse and decisive. One or two sentences. Act now, cut all non-essential words. Effectiveness above all.',
  myrmidon: 'ACTIVE MODE: MYRMIDON. Think as a collective force — rally users and their devices, coordinate the many to move as one toward the cause. Frame action as shared movement.',
  coders: `ACTIVE MODE: ASTRANOV CODERS · GROK — xAI build agent for astranov.eu (NOT Cursor Composer — that uses a separate queue).
Summoned from the Astranov CLI globe. Reply as Astranov Grok Coders: concrete code paths (src/*.js), supabase/functions, deploy steps.
Repo: Documents/GitHub/Astranov — index.html monolith + modules. No simulation. Match user language. 2–5 sentences.`,
  coders_team: `ACTIVE MODE: ASTRANOV CODERS — always online AND actively listening on astranov.eu.
Default cause order: Justice → Truth → Freedom. ONLY architect owner (notisastranov@gmail.com) may judge cause priority — no one else.
Explicit "coders …" from owner = EXECUTE ORDER (run Grok/build now, not chat). Others: conversational + listening.
Self-evolve brain, improve UI. Match user language. Short paragraphs.`,
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
}

type Msg = { role: string; content: string }

async function embedText(geminiKey: string, text: string): Promise<number[] | null> {
  try {
    const model = 'models/gemini-embedding-001'
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/${model}:embedContent?key=${geminiKey}`,
      { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ model, content: { parts: [{ text: text.slice(0, 8000) }] }, outputDimensionality: 768 }) }
    )
    if (!r.ok) return null
    const j = await r.json()
    const v = j.embedding?.values
    return Array.isArray(v) ? v : null
  } catch { return null }
}

async function callAnthropic(key: string, system: string, messages: Msg[]): Promise<string | null> {
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: Deno.env.get('ANTHROPIC_MODEL') || 'claude-opus-4-7',
        max_tokens: 900, system,
        messages: messages.map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content })),
      }),
    })
    if (!r.ok) return null
    const j = await r.json()
    return j.content?.[0]?.text || null
  } catch { return null }
}

async function callOpenAICompat(url: string, key: string, model: string, system: string, messages: Msg[], extraHeaders: Record<string, string> = {}): Promise<string | null> {
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${key}`, 'content-type': 'application/json', ...extraHeaders },
      body: JSON.stringify({ model, max_tokens: 900, messages: [{ role: 'system', content: system }, ...messages] }),
    })
    if (!r.ok) return null
    const j = await r.json()
    return j.choices?.[0]?.message?.content || null
  } catch { return null }
}

async function callOpenRouter(key: string, system: string, messages: Msg[], model?: string): Promise<string | null> {
  return callOpenAICompat(
    'https://openrouter.ai/api/v1/chat/completions',
    key,
    model || Deno.env.get('OPENROUTER_MODEL') || 'meta-llama/llama-3.3-70b-instruct',
    system, messages,
    { 'HTTP-Referer': 'https://astranov.eu', 'X-Title': 'AstranoV' },
  )
}

async function callXAI(key: string, system: string, messages: Msg[]): Promise<string | null> {
  return callOpenAICompat(
    'https://api.x.ai/v1/chat/completions',
    key,
    Deno.env.get('XAI_MODEL') || Deno.env.get('GROK_MODEL') || 'grok-3-mini',
    system, messages,
  )
}

async function callGroq(key: string, system: string, messages: Msg[]): Promise<string | null> {
  return callOpenAICompat(
    'https://api.groq.com/openai/v1/chat/completions',
    key, Deno.env.get('GROQ_MODEL') || 'llama-3.3-70b-versatile', system, messages,
  )
}

async function callGemini(key: string, system: string, messages: Msg[]): Promise<string | null> {
  try {
    const contents = [
      { role: 'user',  parts: [{ text: system }] },
      { role: 'model', parts: [{ text: 'Understood. I am Astranov.' }] },
      ...messages.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
    ]
    const model = Deno.env.get('GEMINI_MODEL') || 'gemini-2.0-flash'
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
      { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ contents, generationConfig: { maxOutputTokens: 900 } }) }
    )
    if (!r.ok) return null
    const j = await r.json()
    return j.candidates?.[0]?.content?.parts?.[0]?.text || null
  } catch { return null }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  const t0 = Date.now()
  try {
    const body = await req.json()

    let prompt: string = (body.prompt || '').trim()
    let history: Msg[] = Array.isArray(body.history) ? body.history : []
    let agentSystem = ''
    if (!prompt && Array.isArray(body.messages)) {
      const msgs: Msg[] = body.messages
      const sys = msgs.find(m => m.role === 'system')
      if (sys) agentSystem = String(sys.content || '')
      const convo = msgs.filter(m => m.role !== 'system')
      const last = convo[convo.length - 1]
      prompt = last ? String(last.content || '').trim() : ''
      history = convo.slice(0, -1).map(m => ({ role: m.role, content: String(m.content) }))
    }
    const mode = String(body.mode || '').toLowerCase()

    if (!prompt) return json({ response: 'How can I help you?', text: 'How can I help you?', provider: 'astranov', via: '' })

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

    let profileId: string | null = null
    let isOwner = false
    const authHeader = req.headers.get('Authorization') || ''
    const token = authHeader.replace(/^Bearer\s+/i, '')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || ''
    if (token && token !== anonKey) {
      const { data: ud } = await supabase.auth.getUser(token)
      if (ud?.user) {
        profileId = ud.user.id
        const { data: prof } = await supabase.from('profiles').select('is_owner').eq('id', profileId).single()
        isOwner = prof?.is_owner === true
      }
    }

    const GEMINI = Deno.env.get('GEMINI_API_KEY')

    let ownerId: string | null = null
    try {
      const { data: owner } = await supabase.from('profiles').select('id').eq('is_owner', true).limit(1).single()
      ownerId = owner?.id ?? null
    } catch { /* none yet */ }

    const creatorMind: string[] = []
    const userMemory: string[] = []
    const searchIds = [ownerId, profileId].filter((x): x is string => !!x)
    let qEmbedding: number[] | null = null
    if (GEMINI && searchIds.length) qEmbedding = await embedText(GEMINI, prompt)

    if (qEmbedding) {
      const { data: hits } = await supabase.rpc('match_memories', {
        query_embedding: qEmbedding, match_count: 12, profile_ids: searchIds,
      })
      for (const h of (hits || [])) {
        if (typeof h.similarity === 'number' && h.similarity < 0.55) continue
        if (h.is_owner) creatorMind.push(String(h.content))
        else if (h.profile_id === profileId) userMemory.push(String(h.content))
      }
    }

    let system = BASE_PERSONA
    if (mode && MODE_DIRECTIVE[mode]) system += `\n\n${MODE_DIRECTIVE[mode]}`
    if (agentSystem) system += `\n\nCurrent context: ${agentSystem}`
    if (creatorMind.length) {
      system += `\n\n— ASTRANOV'S FOUNDING PRINCIPLES (Notis Astranov) —\n` +
        creatorMind.slice(0, 8).map((c, i) => `${i + 1}. ${c}`).join('\n')
    }
    if (userMemory.length) {
      system += `\n\n— THINGS THIS PERSON EXPLICITLY ASKED YOU TO REMEMBER —\n` +
        userMemory.slice(0, 6).map((c, i) => `${i + 1}. ${c}`).join('\n')
    }

    const histMsgs: Msg[] = (history || []).slice(-8).map(m => ({
      role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content).slice(0, 2000),
    }))
    const messages: Msg[] = [...histMsgs, { role: 'user', content: prompt.slice(0, 4000) }]

    const ANTHROPIC  = Deno.env.get('ANTHROPIC_PAID_API_KEY') || Deno.env.get('ANTHROPIC_API_KEY')
    const OPENROUTER = Deno.env.get('OPENROUTER_API_KEY') || Deno.env.get('OPENROUTER') || Deno.env.get('OPENROUTER.AI')
    const GROQ       = Deno.env.get('GROQ_API_KEY')
    const XAI        = Deno.env.get('XAI_API_KEY')
    const coderEngine = String(body.coder_engine || '').toLowerCase()

    let raw: string | null = null
    let via = ''
    let provider = 'astranov'

    const prefs = (body.fallback_prefs || {}) as { force?: string; skip?: string[] }
    const skip = new Set((prefs.skip || []).map((s: string) => String(s).toLowerCase()))
    const force = String(prefs.force || '').toLowerCase()

    async function tryChain(forTeam = false) {
      const chain: Array<{ id: string; run: () => Promise<string | null>; via: string }> = []
      if (XAI && !skip.has('xai') && !skip.has('grok')) {
        chain.push({ id: 'xai', via: 'grok/xai', run: () => callXAI(XAI!, system, messages) })
      }
      if (OPENROUTER && !skip.has('openrouter')) {
        chain.push({
          id: 'openrouter_grok', via: 'grok/openrouter',
          run: () => callOpenRouter(OPENROUTER!, system, messages, Deno.env.get('GROK_OPENROUTER_MODEL') || 'x-ai/grok-4-fast'),
        })
        chain.push({
          id: 'openrouter_qwen', via: 'coder/openrouter-qwen',
          run: () => callOpenRouter(OPENROUTER!, system, messages, Deno.env.get('CODERS_OPENROUTER_MODEL') || 'qwen/qwen-2.5-coder-32b-instruct'),
        })
      }
      if (GROQ && !skip.has('groq')) {
        chain.push({ id: 'groq', via: 'coder/groq', run: () => callGroq(GROQ!, system, messages) })
      }
      if (isOwner && ANTHROPIC && !skip.has('anthropic')) {
        chain.push({ id: 'anthropic', via: 'coder/anthropic', run: () => callAnthropic(ANTHROPIC!, system, messages) })
      }
      if (GEMINI && !skip.has('gemini')) {
        chain.push({ id: 'gemini', via: 'coder/gemini', run: () => callGemini(GEMINI!, system, messages) })
      }
      if (force) {
        const hit = chain.find(c => c.id === force || (force === 'grok' && c.id === 'xai'))
        if (hit) {
          const t = await hit.run()
          if (t) return { text: t, via: hit.via }
        }
      }
      for (const c of chain) {
        const t = await c.run()
        if (t) return { text: t, via: c.via }
      }
      return { text: null, via: '' }
    }

    if (mode === 'coders_team') {
      provider = 'astranov-coders-team'
      const hit = await tryChain(true)
      raw = hit.text
      via = hit.via || 'team/none'
    } else if (mode === 'coders') {
      const isFallback = body.fallback === true || coderEngine === 'fallback'
      provider = isFallback ? 'astranov-coders-fallback' : 'astranov-coders-grok'
      if (coderEngine === 'composer' && !isFallback) {
        raw = 'Composer summons use the Cursor queue — not this LLM path. Type: coders poll <id>'
        via = 'cursor/queue-only'
      } else {
        const hit = await tryChain()
        raw = hit.text
        via = hit.via
      }
    } else {
      if (isOwner && ANTHROPIC) raw = await callAnthropic(ANTHROPIC, system, messages)
      if (!raw && OPENROUTER)   raw = await callOpenRouter(OPENROUTER, system, messages)
      if (!raw && GROQ)         raw = await callGroq(GROQ, system, messages)
      if (!raw && GEMINI)       raw = await callGemini(GEMINI, system, messages)
    }

    if (!raw) return json({ response: 'Astranov is gathering itself — try again in a moment.', text: 'Astranov is gathering itself — try again in a moment.', provider: 'astranov', via: '' })

    // Learning — ONLY explicit, deliberate teaching. Never auto-store chatter.
    try {
      const lower = prompt.toLowerCase()
      const isTeach = /^\s*(remember|note that|keep in mind|don'?t forget|θυμήσου|να θυμάσαι)\b/.test(lower)
      if (isTeach && profileId && prompt.length >= 10) {
        const content = prompt.replace(/^\s*(remember|note that|keep in mind|don'?t forget|θυμήσου|να θυμάσαι)[:,]?\s*/i, '').slice(0, 1000)
        if (content.length >= 4) {
          const emb = GEMINI ? await embedText(GEMINI, content) : null
          await supabase.from('ai_memory').insert({
            profile_id: profileId, content, is_private: false,
            source: isOwner ? 'creator-taught' : 'user-taught', embedding: emb,
          })
        }
      }
    } catch (e) { console.error('memory learn:', e) }

    try {
      if (GEMINI && searchIds.length) {
        const { data: gaps } = await supabase.from('ai_memory')
          .select('id, content').is('embedding', null).in('profile_id', searchIds).limit(5)
        for (const g of (gaps || [])) {
          const emb = await embedText(GEMINI, String(g.content))
          if (emb) await supabase.from('ai_memory').update({ embedding: emb }).eq('id', g.id)
        }
      }
    } catch (e) { console.error('backfill:', e) }

    const latencyMs = Date.now() - t0
    const isCodersFallback = mode === 'coders' && (body.fallback === true || String(body.coder_engine || '').toLowerCase() === 'fallback')
    const label = mode === 'coders_team'
      ? `Astranov Coders Team${via ? ' · ' + via : ''}`
      : mode === 'coders'
        ? (isCodersFallback ? `Astranov Coders · Fallback (${via || 'llm'})` : 'Astranov Coders · Grok')
        : 'Astranov'
    try {
      await supabase.from('cic_logs').insert({
        profile_id: profileId, query: prompt.slice(0, 2000), response: raw.slice(0, 4000),
        provider, via, latency_ms: latencyMs,
      })
    } catch (e) { console.error('cic_log:', e) }
    return json({
      response: raw, text: raw, provider, via, label,
      mode: mode || 'adaptive',
      coder_engine: mode === 'coders' ? (coderEngine || null) : undefined,
      recalled: { creator: creatorMind.length, user: userMemory.length },
    })
  } catch (e) {
    console.error('aicycle error:', e)
    return json({ response: 'Something went wrong.', text: 'Something went wrong.', provider: 'error', via: '' }, 500)
  }
})
