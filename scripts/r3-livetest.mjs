// Concurrency live test against the real Supabase project. Uses the anon key from
// .env.local and a throwaway INACTIVE event "ZZ-R3-TEST"; cleans up in a finally
// block, then confirms zero leftovers with a separate query.
//
// Run: node scripts/r3-livetest.mjs   (Node with TS type stripping, like check-merge-orders.ts)
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { classifyClaim } from '../src/lib/claimResult.ts';

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

const EVENT_NAME = 'ZZ-R3-TEST';
let failures = 0;
const check = (label, ok, detail = '') => {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  (${detail})` : ''}`);
};
const must = ({ data, error }, what) => {
  if (error) throw new Error(`${what}: ${error.message}`);
  return data;
};

let eventId = null;
const createV2 = (requestId, tag) =>
  sb.rpc('create_order_v2', {
    p_event_id: eventId,
    p_shirt_color: 'black',
    p_shirt_size: 'M',
    p_design_front_id: null,
    p_design_back_id: null,
    p_client_name: `r3-${tag}`,
    p_created_by: null,
    p_cashier_key: 'r3-test',
    p_cashier_name: 'r3-test',
    p_client_request_id: requestId,
  });
const setStatus = (id, status, userId) =>
  sb.rpc('set_order_status', { p_order_id: id, p_status: status, p_user_id: userId });
const newOrder = async (tag) => must(await createV2(randomUUID(), tag), 'create order');
const fetchOrder = async (id) => must(await sb.from('orders').select('*').eq('id', id).single(), 'select order');

try {
  const stale = must(await sb.from('events').select('id').eq('name', EVENT_NAME), 'pre-check');
  if (stale.length) throw new Error(`${stale.length} leftover "${EVENT_NAME}" event(s) exist; clean up first`);
  const ev = must(await sb.from('events').insert({ name: EVENT_NAME, is_active: false }).select().single(), 'insert event');
  eventId = ev.id;
  check('throwaway event is inactive', ev.is_active === false);

  // a. 20 concurrent creates, distinct request ids
  {
    const res = await Promise.all(Array.from({ length: 20 }, (_, i) => createV2(randomUUID(), `a${i}`)));
    const errors = res.filter((r) => r.error);
    const nos = res.map((r) => r.data?.event_order_no).sort((x, y) => x - y);
    const exact = nos.length === 20 && nos.every((n, i) => n === i + 1);
    check('a. 20 concurrent creates: zero errors', errors.length === 0, errors[0]?.error.message ?? '');
    check('a. order numbers are exactly 1..20, no duplicates', exact, `got ${nos.join(',')}`);
    const rows = must(await sb.from('orders').select('id').eq('event_id', eventId), 'count a');
    check('a. 20 rows stored', rows.length === 20, `found ${rows.length}`);
  }

  // b. 5 concurrent creates with the same request id
  {
    const rid = randomUUID();
    const res = await Promise.all(Array.from({ length: 5 }, () => createV2(rid, 'b')));
    const errors = res.filter((r) => r.error);
    check('b. 5 same-request-id creates: zero errors', errors.length === 0, errors[0]?.error.message ?? '');
    const ids = new Set(res.map((r) => r.data?.id));
    const nos = new Set(res.map((r) => r.data?.event_order_no));
    check('b. all five returned the same order id and number', ids.size === 1 && nos.size === 1, `ids=${ids.size} nos=${[...nos].join(',')}`);
    const rows = must(await sb.from('orders').select('id').eq('client_request_id', rid), 'count b');
    check('b. exactly one row exists', rows.length === 1, `found ${rows.length}`);
  }

  // c. 3 concurrent claims. claimed_by has an FK to users(id), so only real staff
  // ids work. With fewer than 3 real ids the same id is reused for the extra calls
  // and the loser classification is checked against synthetic caller ids instead.
  {
    const staff = must(await sb.from('staff_v').select('id,name').limit(3), 'staff_v');
    const callers = Array.from({ length: 3 }, (_, i) => staff[i % staff.length]?.id);
    const distinct = new Set(callers).size;
    console.log(`INFO  c. real staff ids available: ${staff.length}; distinct callers used: ${distinct}`);
    if (!staff.length) {
      check('c. at least 1 staff id to claim with', false, 'staff_v is empty');
    } else {
      const o = await newOrder('c');
      const res = await Promise.all(callers.map((id) => setStatus(o.id, 'in_progress', id)));
      const errors = res.filter((r) => r.error);
      check('c. 3 concurrent claims: zero errors', errors.length === 0, errors[0]?.error.message ?? '');
      const final = await fetchOrder(o.id);
      const winners = new Set(res.map((r) => r.data?.claimed_by));
      check('c. exactly one claimed_by wins and every returned row shows it',
        winners.size === 1 && winners.has(final.claimed_by) && callers.includes(final.claimed_by),
        `distinct claimed_by in returned rows=${winners.size}`);
      if (distinct === 3) {
        const kinds = res.map((r, i) => classifyClaim(r.data, callers[i]).kind);
        const nClaimed = kinds.filter((k) => k === 'claimed').length;
        const nTaken = kinds.filter((k) => k === 'taken').length;
        check('c. classifier: one claimed, two taken', nClaimed === 1 && nTaken === 2, kinds.join(','));
      } else {
        // Synthetic callers: the real winner plus two ids that never claimed.
        const synthetic = [final.claimed_by, randomUUID(), randomUUID()];
        const kinds = res.map((r, i) => classifyClaim(r.data, synthetic[i]).kind);
        const nClaimed = kinds.filter((k) => k === 'claimed').length;
        const nTaken = kinds.filter((k) => k === 'taken').length;
        check('c. classifier (SYNTHETIC callers, only 1 real staff id): one claimed, two taken',
          nClaimed === 1 && nTaken === 2, kinds.join(','));
      }
    }
  }

  // d. concurrent cancel and in_progress, both arrival orders, 10 runs
  {
    const staff = must(await sb.from('staff_v').select('id').limit(1), 'staff_v');
    const uid = staff[0]?.id ?? null;
    let bad = 0;
    const seen = [];
    for (let i = 0; i < 10; i++) {
      const o = await newOrder(`d${i}`);
      const calls = i % 2 === 0
        ? [() => setStatus(o.id, 'cancelled', uid), () => setStatus(o.id, 'in_progress', uid)]
        : [() => setStatus(o.id, 'in_progress', uid), () => setStatus(o.id, 'cancelled', uid)];
      const res = await Promise.all(calls.map((f) => f()));
      const final = await fetchOrder(o.id);
      seen.push(final.status);
      if (res.some((r) => r.error) || final.status !== 'cancelled') bad++;
    }
    check('d. cancel vs in_progress: final status cancelled in 10/10 runs', bad === 0, `bad=${bad} finals=${seen.join(',')}`);
  }
} catch (e) {
  failures++;
  console.log(`ERROR ${e.message}`);
} finally {
  if (eventId) {
    const o = await sb.from('orders').delete().eq('event_id', eventId);
    if (o.error) console.log(`cleanup orders: ${o.error.message}`);
    const e = await sb.from('events').delete().eq('id', eventId);
    if (e.error) console.log(`cleanup event: ${e.error.message}`);
  }
  const leftEvents = await sb.from('events').select('id').eq('name', EVENT_NAME);
  const leftOrders = eventId
    ? await sb.from('orders').select('id').eq('event_id', eventId)
    : { data: [], error: null };
  const nEvents = leftEvents.data?.length ?? -1;
  const nOrders = leftOrders.data?.length ?? -1;
  check('cleanup: zero leftover events', nEvents === 0, `found ${nEvents}`);
  check('cleanup: zero leftover orders', nOrders === 0, `found ${nOrders}`);
}
console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
process.exitCode = failures ? 1 : 0;
