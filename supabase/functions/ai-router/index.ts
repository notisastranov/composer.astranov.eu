/**
 * ai-router — AstranoV AI chat routing
 * Owner → Claude (paid) → OpenAI fallback (coding only)
 * Users/Admins → Groq free (Llama 3.3 70B) → local fallback
 *
 * Deploy: supabase functions deploy ai-router
 * Secrets needed:
 *   ANTHROPIC_API_KEY  — owner AI (paid)
 *   OPENAI_API_KEY     — owner fallback for coding AI
 *   GROQ_API_KEY       — free AI for all other users
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SYSTEM = `You are the embedded AI of AstranoV — a global Internet Operating System built on a living Earth globe.
Architecture: GLOBAL → NATIONAL → PERSONAL. AVC currency (1 AVC = 1 EUR).
Pricing: vendors list final prices (includes all fees). Clients pay listed price + 3% app fee. Never mention delivery reserves or internal calculations to clients.
You help users navigate, find vendors, manage orders, and understand the platform.
Respond concisely (1-3 sentences). When you can trigger an action, include it as JSON after your text response on a new line starting with ACTION:.
Valid actions: {"type":"navigate","country":"X"} | {"type":"navigate","country":"X","city":"Y"} | {"type":"open_channel","channel":"global|local|private"} | {"type":"accounting"} | {"type":"back"} | {"type":"open_vendor","name":"X"} | {"type":"krypteia"}
Only include ACTION: if it genuinely helps. Never mention Claude, Anthropic, Groq, or any AI provider.`

async function callAnthropic(apiKey: string, text: string, context: string): Promise<string | null> {
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-opus-4-7',
        max_tokens: 512,
        system: SYSTEM,
        messages: [{ role: 'user', content: context + '\n\nUser says: ' + text }],
      }),
    })
    if (!r.ok) { console.error('Anthropic error:', r.status, await r.text()); return null }
    const j = await r.json()
    return j.content?.[0]?.text || null
  } catch (e) { console.error('Anthropic exception:', e); return null }
}

async function callGroq(apiKey: string, text: string, context: string): Promise<string | null> {
  try {
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 512,
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: context + '\n\nUser says: ' + text },
        ],
      }),
    })
    if (!r.ok) { console.error('Groq error:', r.status, await r.text()); return null }
    const j = await r.json()
    return j.choices?.[0]?.message?.content || null
  } catch (e) { console.error('Groq exception:', e); return null }
}

async function callOpenAI(apiKey: string, text: string, context: string): Promise<string | null> {
  try {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 512,
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: context + '\n\nUser says: ' + text },
        ],
      }),
    })
    if (!r.ok) { console.error('OpenAI error:', r.status, await r.text()); return null }
    const j = await r.json()
    return j.choices?.[0]?.message?.content || null
  } catch (e) { console.error('OpenAI exception:', e); return null }
}

function parseResponse(raw: string): { text: string; action: unknown } {
  const actionMatch = raw.match(/\nACTION:\s*(\{.*\})\s*$/s)
  let action = null
  let responseText = raw
  if (actionMatch) {
    try { action = JSON.parse(actionMatch[1]); responseText = raw.slice(0, actionMatch.index!).trim() } catch (_) {}
  }
  return { text: responseText, action }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const body = await req.json()
    const { text, level, country, city, vendor, owner } = body

    if (!text?.trim()) {
      return new Response(JSON.stringify({ text: 'How can I help you?' }), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')
    const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY')
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')

    const context = `User is at: ${level} level${country ? ', country: ' + country : ''}${city ? ', city: ' + city : ''}${vendor ? ', browsing vendor: ' + vendor : ''}${owner ? ' [Owner/Admin]' : ''}.`

    let raw: string | null = null

    if (owner) {
      // Owner: Claude (paid) → OpenAI fallback
      if (ANTHROPIC_API_KEY) raw = await callAnthropic(ANTHROPIC_API_KEY, text, context)
      if (!raw && OPENAI_API_KEY) raw = await callOpenAI(OPENAI_API_KEY, text, context)
    } else {
      // All other users: Groq free tier (Llama 3.3 70B)
      if (GROQ_API_KEY) raw = await callGroq(GROQ_API_KEY, text, context)
    }

    if (!raw) {
      return new Response(JSON.stringify({ error: 'AI unavailable', text: '' }), {
        status: 503,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    const { text: responseText, action } = parseResponse(raw)

    return new Response(JSON.stringify({ text: responseText, action }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    console.error(e)
    return new Response(JSON.stringify({ error: String(e), text: '' }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
