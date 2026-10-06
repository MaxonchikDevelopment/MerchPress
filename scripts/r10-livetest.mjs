// Live test for events.event_end_date against the real Supabase project. Uses the anon
// key from .env.local and a throwaway INACTIVE event "ZZ-R10-TEST"; cleans up in a
// finally block, then confirms zero leftovers with a separate query.
//
// Run: node scripts/r10-livetest.mjs
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n')
    .map((l) => l.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"]*)"?\s*$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2]]),
);
const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_ANON_KEY;
if (!/^https?:\/\//i.test(url ?? '') || !key || key.includes('[SENSITIVE]')) {
  console.error('.env.local needs a real VITE_SUPABASE_URL (http/https) and VITE_SUPABASE_ANON_KEY.');
  process.exit(2);
}
const sb = createClient(url, key, { auth: { persistSession: false } });

const EVENT_NAME = 'ZZ-R10-TEST';
let failures = 0;
const check = (label, ok, detail = '') => {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  (${detail})` : ''}`);
};
const must = ({ data, error }, what) => {
  if (error) throw new Error(`${what}: ${error.message}`);
  return data;
};
const readEvent = async (id) => must(await sb.from('events').select('*').eq('id', id).single(), 'select event');

const ids = [];
try {
  const stale = must(await sb.from('events').select('id').eq('name', EVENT_NAME), 'pre-check');
  if (stale.length) throw new Error(`${stale.length} leftover "${EVENT_NAME}" event(s) exist; clean up first`);

  // 1. insert with start and end
  const a = must(
    await sb.from('events').insert({ name: EVENT_NAME, is_active: false, event_date: '2026-10-10', event_end_date: '2026-10-11' }).select().single(),
    'insert with range',
  );
  ids.push(a.id);
  check('throwaway event is inactive', a.is_active === false);
  const ra = await readEvent(a.id);
  check('1. insert with range: start and end read back', ra.event_date === '2026-10-10' && ra.event_end_date === '2026-10-11', `${ra.event_date} / ${ra.event_end_date}`);

  // 2. insert with start only
  const b = must(
    await sb.from('events').insert({ name: EVENT_NAME, is_active: false, event_date: '2026-10-10' }).select().single(),
    'insert start only',
  );
  ids.push(b.id);
  const rb = await readEvent(b.id);
  check('2. insert with start only: end is null', rb.event_date === '2026-10-10' && rb.event_end_date === null, `${rb.event_date} / ${rb.event_end_date}`);

  // 3. update end to a later date
  must(await sb.from('events').update({ event_end_date: '2026-10-12' }).eq('id', a.id).select(), 'update later end');
  check('3. update end to a later date', (await readEvent(a.id)).event_end_date === '2026-10-12');

  // 4. update end to before the start: expect 23514
  const bad = await sb.from('events').update({ event_end_date: '2026-10-09' }).eq('id', a.id);
  check('4. end before start is rejected with 23514', bad.error?.code === '23514', `code=${bad.error?.code} msg=${bad.error?.message ?? ''}`);
  check('4. rejected update left the row unchanged', (await readEvent(a.id)).event_end_date === '2026-10-12');

  // 5. update end to null
  must(await sb.from('events').update({ event_end_date: null }).eq('id', a.id).select(), 'update end to null');
  check('5. update end to null', (await readEvent(a.id)).event_end_date === null);
} catch (e) {
  failures++;
  console.log(`ERROR ${e.message}`);
} finally {
  if (ids.length) {
    const d = await sb.from('events').delete().in('id', ids);
    if (d.error) console.log(`cleanup events: ${d.error.message}`);
  }
  const left = await sb.from('events').select('id').eq('name', EVENT_NAME);
  const n = left.data?.length ?? -1;
  check('cleanup: zero leftover events', n === 0, `found ${n}`);
}
console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
process.exitCode = failures ? 1 : 0;
