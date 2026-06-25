#!/usr/bin/env node
/** Watch open Cursor Composer summons — run beside Cursor while building Astranov */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SB_URL = process.env.SUPABASE_URL || 'https://lkoatrkhuigdolnjsbie.supabase.co';
const SB_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function loadKeyFromHtml() {
  try {
    const html = fs.readFileSync(path.join(ROOT, 'src', '20-aci.js'), 'utf8');
    const m = html.match(/key:\s*'([^']+)'/);
    return m?.[1] || '';
  } catch { return ''; }
}

const key = SB_KEY || loadKeyFromHtml();
if (!key) {
  console.error('Set SUPABASE_ANON_KEY or ensure src/20-aci.js has ACI.key');
  process.exit(1);
}

const interval = Number(process.argv[2]) || 12;

async function tick() {
  try {
    const r = await fetch(SB_URL + '/functions/v1/coders-bridge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: key, Authorization: 'Bearer ' + key },
      body: JSON.stringify({ mode: 'pending', limit: 20 }),
    });
    const j = await r.json().catch(() => ({}));
    const pending = j.pending || [];
    console.clear();
    console.log('Astranov Coders Watch — Cursor Composer queue — ' + new Date().toLocaleTimeString());
    console.log('Project:', SB_URL);
    if (!pending.length) {
      console.log('(no open composer summons)');
      return;
    }
    pending.forEach(p => {
      const ctx = p.context || {};
      console.log('\n#' + p.id + ' [' + p.status + '] ' + (ctx.email || p.user_id || ''));
      console.log('  ' + String(p.question || '').slice(0, 200));
      console.log('  → answer: node scripts/coders-answer.mjs ' + p.id + ' "your reply"');
      console.log('  → or continue in Cursor Composer with summon #' + p.id);
    });
  } catch (err) {
    console.log('\n⚠ fetch failed — retrying: ' + (err.cause?.message || err.message || err));
  }
}

console.log('Watching every ' + interval + 's. Ctrl+C to stop.');
await tick();
setInterval(tick, interval * 1000);