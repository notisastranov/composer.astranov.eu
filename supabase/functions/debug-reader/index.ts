import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Content-Type': 'application/json'
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const sb = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data, error } = await sb
      .from('analytics_events')
      .select('type, data, ts, session_id')
      .like('type', 'debug_%')
      .order('ts', { ascending: false })
      .limit(100)

    if (error) throw error

    const summary = {
      count: data?.length ?? 0,
      events: data ?? [],
      queried_at: new Date().toISOString()
    }

    return new Response(JSON.stringify(summary, null, 2), { headers: cors })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: cors })
  }
})
