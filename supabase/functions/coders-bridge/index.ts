// Astranov Coders Bridge — Cursor Composer queue (NOT Anthropic).
// Grok uses xAI via aci→aicycle. Composer summons land here for Cursor to pick up.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-coders-secret',
}

function json(d: unknown, s = 200) {
  return new Response(JSON.stringify(d), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } })
}

function bridgeSecret(req: Request) {
  const expected = Deno.env.get('CODERS_BRIDGE_SECRET') || ''
  if (!expected) return false
  return (req.headers.get('x-coders-secret') || '') === expected
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const sb = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )
    const body = await req.json().catch(() => ({}))
    const mode = String(body.mode || 'pending')

    if (mode === 'register') {
      const summonId = body.summon_id
      const task = String(body.task || '').slice(0, 2000)
      if (!summonId || !task) return json({ error: 'summon_id and task required' }, 400)

      const external = Deno.env.get('CODERS_COMPOSER_WEBHOOK_URL')
      if (external) {
        fetch(external, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            summon_id: summonId,
            task,
            coder_engine: 'composer',
            source: 'astranov-coders-bridge',
            user_id: body.user_id,
            email: body.email,
          }),
        }).catch(() => {})
      }

      return json({
        ok: true,
        registered: true,
        summon_id: summonId,
        engine: 'composer',
        label: 'Astranov Coders · Cursor Composer',
        hint: 'Cursor Composer picks up open summons — coders poll ' + summonId,
      })
    }

    if (mode === 'answer') {
      if (!bridgeSecret(req)) return json({ error: 'unauthorized — set CODERS_BRIDGE_SECRET' }, 401)
      const summonId = body.summon_id ?? body.id
      const answer = String(body.answer || body.text || '').trim()
      if (!summonId || answer.length < 1) return json({ error: 'summon_id and answer required' }, 400)

      const { data, error } = await sb.from('cic_queue').update({
        status: 'answered',
        answer: answer.slice(0, 8000),
        answered_at: new Date().toISOString(),
      }).eq('id', summonId).eq('reason', 'coder_summon').select('id, question, status').single()

      if (error) return json({ error: error.message }, 500)
      return json({ ok: true, summon_id: summonId, answered: true, row: data })
    }

    if (mode === 'status') {
      const summonId = body.summon_id ?? body.id
      if (!summonId) return json({ error: 'summon_id required' }, 400)
      const { data, error } = await sb.from('cic_queue')
        .select('id, question, status, answer, created_at, answered_at, context')
        .eq('id', summonId)
        .eq('reason', 'coder_summon')
        .single()
      if (error || !data) return json({ error: 'summon not found' }, 404)
      return json({ ok: true, summon: data })
    }

    if (mode === 'pending') {
      const limit = Math.min(30, Number(body.limit) || 15)
      const { data, error } = await sb.from('cic_queue')
        .select('id, question, status, created_at, context, user_id')
        .eq('reason', 'coder_summon')
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .limit(limit)
      if (error) return json({ error: error.message, hint: 'ensure cic_queue table exists' }, 500)
      const open = (data || []).filter((r) => {
        const ctx = r.context as { coder_engine?: string } | null
        return ctx?.coder_engine === 'composer' || !ctx?.coder_engine
      })
      return json({ ok: true, pending: open, count: open.length })
    }

    return json({
      error: 'unknown mode',
      modes: ['register', 'answer', 'status', 'pending'],
      note: 'Composer = Cursor Composer queue. Grok = xAI via aci coders mode.',
    }, 400)
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})