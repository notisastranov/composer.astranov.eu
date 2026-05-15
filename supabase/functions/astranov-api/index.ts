/**
 * astranov-api — General API + Krypteia self-development engine
 *
 * Deploy: supabase functions deploy astranov-api
 * Secrets needed:
 *   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
 *   supabase secrets set GITHUB_TOKEN=ghp_...         (for auto-push)
 *   supabase secrets set GITHUB_REPO=notisastranov/Astranov
 *   supabase secrets set GITHUB_BRANCH=claude/build-astranov-app-DHkQw
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  let body: Record<string, unknown> = {}
  try { body = await req.json() } catch (_) {}

  const path = String(body.path || '')

  // ── /debug/write ──────────────────────────────────────────────────
  // Self-diagnosis fallback: same payload shape as the dedicated debug-write
  // function. Lives here so the in-app logger always has a deployed endpoint.
  if (path === '/debug/write') {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )
    try {
      await supabase.storage.createBucket('debug-pub', { public: true }).catch(() => {})
      const blob = JSON.stringify({ received_at: new Date().toISOString(), ...body }, null, 2)
      await supabase.storage.from('debug-pub').upload('errors.json',
        new Blob([blob], { type: 'application/json' }), { upsert: true })
      const events = Array.isArray(body.events) ? body.events as Array<Record<string, unknown>> : []
      const rows = events.slice(0, 50).map((ev) => ({
        type: 'debug_' + String(ev.type || 'event'),
        data: ev.data ?? null,
        session_id: String(body.session || ''),
        ts: Number(ev.t) || Date.now(),
      }))
      if (rows.length) await supabase.from('analytics_events').insert(rows).catch(() => {})
      return json({ ok: true, wrote: events.length })
    } catch (e) {
      return json({ ok: false, error: String(e) }, 500)
    }
  }

  // ── /balance/recharge ─────────────────────────────────────────────
  if (path === '/balance/recharge') {
    const authHeader = req.headers.get('Authorization') || ''
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )
    const { data: { user }, error } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
    if (error || !user) return json({ error: 'Unauthorized' }, 401)
    const amount = Number(body.amount) || 0
    if (amount < 1) return json({ error: 'Invalid amount' }, 400)
    const { error: e2 } = await supabase.rpc('add_balance', { uid: user.id, delta: amount })
    if (e2) return json({ error: e2.message }, 500)
    return json({ credited: amount, ok: true })
  }

  // ── /auth/owner-check ─────────────────────────────────────────────
  if (path === '/auth/owner-check') {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )
    const userId = String(body.user_id || '')
    if (!userId) return json({ authorized: false })
    const { data } = await supabase.from('profiles').select('is_owner').eq('id', userId).single()
    return json({ authorized: data?.is_owner === true })
  }

  // ── /invoices/mydata ──────────────────────────────────────────────
  // Future: submit invoice to AADE myDATA API and return MARK
  if (path === '/invoices/mydata') {
    // TODO: implement real myDATA submission when AADE credentials are available
    // For now return a local MARK so the system works offline
    const ts = Date.now().toString(36).toUpperCase()
    return json({ mydata_mark: 'LOCAL-' + ts, submitted: false, note: 'myDATA submission pending AADE credentials' })
  }

  // ── /ai/krypteia/develop ─────────────────────────────────────────
  if (path === '/ai/krypteia/develop') {
    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')
    if (!ANTHROPIC_API_KEY) return json({ error: 'ANTHROPIC_API_KEY not set' }, 503)

    const prompt = String(body.prompt || '').trim()
    const model = String(body.model || 'claude-opus-4-7')
    const maxTokens = Number(body.max_tokens) || 8192
    const currentHtml = String(body.current_html || '')

    if (!prompt) return json({ error: 'prompt required' }, 400)

    const SYSTEM = `You are the self-evolution engine of AstranoV — a single-file Internet OS (index.html).
Architecture law: GLOBAL→NATIONAL→PERSONAL. AVC currency only. All code in one HTML file. No new files.
The owner is requesting a code change. You will receive the current index.html and a description of the change.
Return ONLY the complete modified index.html — no explanation, no markdown, no code fences. Just the full HTML.
Preserve all existing functionality. Only change what is requested. Do not break working systems.`

    const userContent = currentHtml
      ? `Current index.html (${currentHtml.length} chars):\n${currentHtml.slice(0, 180000)}\n\n---\nRequested change: ${prompt}`
      : `Requested change: ${prompt}\n(index.html not provided — describe the change as a precise code patch instead)`

    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        system: SYSTEM,
        messages: [{ role: 'user', content: userContent }],
      }),
    })

    if (!r.ok) {
      const err = await r.text()
      return json({ error: 'Claude API error: ' + err }, 502)
    }

    const j = await r.json()
    const newHtml = j.content?.[0]?.text || ''

    // Auto-push to GitHub if token is available
    const GITHUB_TOKEN = Deno.env.get('GITHUB_TOKEN')
    const GITHUB_REPO = Deno.env.get('GITHUB_REPO') || 'notisastranov/Astranov'
    const GITHUB_BRANCH = Deno.env.get('GITHUB_BRANCH') || 'claude/build-astranov-app-DHkQw'
    let autoPush = false
    let commitSha = ''

    if (GITHUB_TOKEN && newHtml.includes('<!doctype html')) {
      try {
        // Get current file SHA
        const fileRes = await fetch(
          `https://api.github.com/repos/${GITHUB_REPO}/contents/index.html?ref=${GITHUB_BRANCH}`,
          { headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: 'application/vnd.github.v3+json' } }
        )
        const fileData = await fileRes.json()
        const currentSha = fileData.sha

        // Push updated file
        const pushRes = await fetch(
          `https://api.github.com/repos/${GITHUB_REPO}/contents/index.html`,
          {
            method: 'PUT',
            headers: {
              Authorization: `Bearer ${GITHUB_TOKEN}`,
              'Content-Type': 'application/json',
              Accept: 'application/vnd.github.v3+json',
            },
            body: JSON.stringify({
              message: `[Krypteia AI] ${prompt.slice(0, 72)}`,
              content: btoa(unescape(encodeURIComponent(newHtml))),
              sha: currentSha,
              branch: GITHUB_BRANCH,
            }),
          }
        )
        const pushData = await pushRes.json()
        if (pushData.commit?.sha) {
          autoPush = true
          commitSha = pushData.commit.sha
        }
      } catch (e) {
        console.error('GitHub push failed:', e)
      }
    }

    return json({
      html: newHtml.slice(0, 500) + (newHtml.length > 500 ? '…' : ''),
      full_html: newHtml,
      auto_push: autoPush,
      commit: commitSha,
      model,
      prompt_chars: prompt.length,
    })
  }

  return json({ error: 'Unknown path: ' + path }, 404)
})
