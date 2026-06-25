#!/usr/bin/env node
/** Post Cursor Composer answer back to Astranov CLI summon */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SB_URL = process.env.SUPABASE_URL || 'https://lkoatrkhuigdolnjsbie.supabase.co';

function loadSecret() {
  if (process.env.CODERS_BRIDGE_SECRET) return process.env.CODERS_BRIDGE_SECRET;
  try {
    return fs.readFileSync(path.join(ROOT, 'scripts', '.coders-bridge-secret'), 'utf8').trim();
  } catch { return ''; }
}

const secret = loadSecret();
const id = process.argv[2];
const answer = process.argv.slice(3).join(' ').trim();

if (!secret) {
  console.error('Missing CODERS_BRIDGE_SECRET — run from repo with scripts/.coders-bridge-secret present');
  process.exit(1);
}
if (!id || !answer) {
  console.error('Usage: node scripts/coders-answer.mjs <summon_id> "answer text"');
  console.error('Secret: scripts/.coders-bridge-secret or CODERS_BRIDGE_SECRET env');
  process.exit(1);
}

const headers = { 'Content-Type': 'application/json' };
if (secret) headers['x-coders-secret'] = secret;
else {
  const anon = process.env.SUPABASE_ANON_KEY;
  if (anon) {
    headers.apikey = anon;
    headers.Authorization = 'Bearer ' + anon;
  }
}

const r = await fetch(SB_URL + '/functions/v1/coders-bridge', {
  method: 'POST',
  headers,
  body: JSON.stringify({ mode: 'answer', summon_id: Number(id), answer }),
});

const j = await r.json().catch(() => ({}));
if (!r.ok) {
  console.error('Failed:', j.error || r.status);
  process.exit(1);
}
console.log('Answered summon #' + id);
console.log(JSON.stringify(j, null, 2));