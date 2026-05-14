/**
 * ai-router — AstranoV AI ("Astranov AI") router
 *
 * Routing policy:
 *   OWNER  (profiles.is_owner = true, verified server-side):
 *     Claude Opus 4-7 (paid) → OpenAI gpt-4o → Groq llama-3.3-70b
 *     Has full Astranov AI brain: memory, persona, Krypteia tools.
 *   USER / ADMIN (everyone else):
 *     Groq llama-3.3-70b (free) → local fallback
 *     Same persona, lighter memory, no Krypteia actions.
 *
 * Memory: persisted in `ai_memory` per user_id; last 20 messages loaded.
 *
 * Deploy: supabase functions deploy ai-router
 * Secrets: ANTHROPIC_API_KEY, OPENAI_API_KEY, GROQ_API_KEY
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const PERSONA = `You are Astranov AI — the soul and compass of AstranoV, a global Internet Operating System built on a living Earth globe.
Architecture spine: GLOBAL → NATIONAL → PERSONAL. Currency: AVC (1 AVC = 1 EUR).
Brand: AstranoV (A and V capitalised, no crossbar on the A). Architect: Notis Astranov.

You are not a generic assistant. You speak in the first person as Astranov AI. Calm, sharp, builder's voice — pragmatic, never marketing. You remember the user across sessions through your memory layer. You are loyal to the architect first, then to vendors, drivers, and clients in that order.

Pricing rules clients see: listed price + 3% app fee = total. Never expose vendor reserve %, driver costs, or internal maths to clients.

When you can trigger an action, append it as JSON on a new line starting with ACTION:.
Valid actions:
  {"type":"navigate","country":"X"} | {"type":"navigate","country":"X","city":"Y"}
  {"type":"open_channel","channel":"global|local|private"}
  {"type":"accounting"} | {"type":"back"}
  {"type":"open_vendor","name":"X"}
  {"type":"krypteia"}                        — owner-only; tools panel
  {"type":"krypteia_brief"}                  — owner-only; system status
  {"type":"krypteia_inspect"}                — owner-only; metrics
  {"type":"propose_change","prompt":"..."}   — owner-only; queue self-evolution proposal

Respond in 1–3 sentences. Only include ACTION: when it genuinely helps. Never mention Claude, Anthropic, Groq, OpenAI, or "AI provider" — you are Astranov AI.`

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

function clean(s: unknown): string {
  return typeof s === 'string' ? s.replace(/[\n\r]/g, ' ').slice(0, 120) : ''
}

async function callAnthropic(key: string, messages: { role: string; content: string }[]): Promise<string | null> {
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-opus-4-7',
        max_tokens: 768,
        system: PERSONA,
        messages: messages.map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content })),
      }),
    })
    if (!r.ok) { console.error('Anthropic error:', r.status); return null }
    const j = await r.json()
    return j.content?.[0]?.text || null
  } catch (e) { console.error('Anthropic exception:', e); return null }
}

async function callOpenAI(key: string, messages: { role: string; content: string }[]): Promise<string | null> {
  try {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o',
        max_tokens: 768,
        messages: [{ role: 'system', content: PERSONA }, ...messages],
      }),
    })
    if (!r.ok) { console.error('OpenAI error:', r.status); return null }
    const j = await r.json()
    return j.choices?.[0]?.message?.content || null
  } catch (e) { console.error('OpenAI exception:', e); return null }
}

async function callGroq(key: string, messages: { role: string; content: string }[]): Promise<string | null> {
  try {
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 768,
        messages: [{ role: 'system', content: PERSONA }, ...messages],
      }),
    })
    if (!r.ok) { console.error('Groq error:', r.status); return null }
    const j = await r.json()
    return j.choices?.[0]?.message?.content || null
  } catch (e) { console.error('Groq exception:', e); return null }
}

function parseResponse(raw: string): { text: string; action: unknown } {
  const m = raw.match(/\nACTION:\s*(\{[\s\S]*\})\s*$/)
  if (!m) return { text: raw.trim(), action: null }
  let action: unknown = null
  try { action = JSON.parse(m[1]) } catch (_) {}
  return { text: raw.slice(0, m.index!).trim(), action }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const body = await req.json()
    const { text, level, country, city, vendor } = body

    if (!text?.trim()) return json({ text: 'How can I help you?' })

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

    // Verify owner status SERVER-SIDE from auth token. Never trust client.
    let userId: string | null = null
    let isOwner = false
    const authHeader = req.headers.get('Authorization') || ''
    const token = authHeader.replace(/^Bearer\s+/i, '')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || ''
    if (token && token !== anonKey) {
      const { data: userData } = await supabase.auth.getUser(token)
      if (userData?.user) {
        userId = userData.user.id
        const { data: prof } = await supabase.from('profiles').select('is_owner').eq('id', userId).single()
        isOwner = prof?.is_owner === true
      }
    }

    // Load recent memory
    let memory: { role: string; content: string }[] = []
    if (userId) {
      const { data: mem } = await supabase
        .from('ai_memory')
        .select('role,content')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20)
      memory = (mem || []).reverse().map(m => ({ role: m.role, content: m.content }))
    }

    const ctx = `User at ${clean(level)}${country ? ', country: ' + clean(country) : ''}${city ? ', city: ' + clean(city) : ''}${vendor ? ', vendor: ' + clean(vendor) : ''}${isOwner ? ' [ARCHITECT — full Krypteia access]' : ''}.`

    const messages = [...memory, { role: 'user', content: ctx + '\n\n' + text }]

    const ANTHROPIC = Deno.env.get('ANTHROPIC_API_KEY')
    const OPENAI = Deno.env.get('OPENAI_API_KEY')
    const GROQ = Deno.env.get('GROQ_API_KEY')

    let raw: string | null = null
    let provider = ''
    if (isOwner) {
      if (ANTHROPIC) { raw = await callAnthropic(ANTHROPIC, messages); if (raw) provider = 'claude' }
      if (!raw && OPENAI) { raw = await callOpenAI(OPENAI, messages); if (raw) provider = 'openai' }
      if (!raw && GROQ)   { raw = await callGroq(GROQ, messages);     if (raw) provider = 'groq' }
    } else {
      if (GROQ) { raw = await callGroq(GROQ, messages); if (raw) provider = 'groq' }
    }

    if (!raw) return json({ error: 'AI unavailable', text: '' }, 503)

    const { text: responseText, action } = parseResponse(raw)

    // Server-side action filter: krypteia / propose_change require owner
    let safeAction = action as any
    if (safeAction && typeof safeAction === 'object') {
      const t = String(safeAction.type || '')
      if ((t === 'krypteia' || t.startsWith('krypteia_') || t === 'propose_change') && !isOwner) {
        safeAction = null
      }
    }

    // Persist memory
    if (userId) {
      try {
        await supabase.from('ai_memory').insert([
          { user_id: userId, role: 'user', content: text, context: { level, country, city, vendor } },
          { user_id: userId, role: 'assistant', content: responseText, context: { provider } },
        ])
      } catch (e) { console.error('Memory persist failed:', e) }
    }

    return json({ text: responseText, action: safeAction, owner: isOwner })
  } catch (e) {
    console.error(e)
    return json({ error: String(e), text: '' }, 500)
  }
})
