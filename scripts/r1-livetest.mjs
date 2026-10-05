// Live check of the order status lifecycle against the real Supabase project.
// Uses the anon key from .env.local. Creates an INACTIVE throwaway event
// "ZZ-R1-TEST", walks one order through the statuses, then deletes everything
// in a finally block and confirms nothing is left behind.
//
// Run: node scripts/r1-livetest.mjs
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

const EVENT_NAME = 'ZZ-R1-TEST';
let failures = 0;
const check = (label, ok, detail = '') => {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  (${detail})` : ''}`);
};
const must = ({ data, error }, what) => {
  if (error) throw new Error(`${what}: ${error.message}`);
  return data;
};

const fetchOrder = async (id) =>
  must(await sb.from('orders').select('*').eq('id', id).single(), 'select order');

let eventId = null;
try {
  // Refuse to start if an earlier run left a test event behind.
  const stale = must(await sb.from('events').select('id').eq('name', EVENT_NAME), 'pre-check');
  if (stale.length) throw new Error(`${stale.length} leftover "${EVENT_NAME}" event(s) exist; clean up first`);

  const ev = must(
    await sb.from('events').insert({ name: EVENT_NAME, is_active: false }).select().single(),
    'insert event',
  );
  eventId = ev.id;
  check('throwaway event is inactive', ev.is_active === false);

  // Any staff member works as the actor; null is fine if the list is empty.
  const staff = must(await sb.from('staff_v').select('id').limit(1), 'staff_v');
  const userId = staff[0]?.id ?? null;

  const created = must(
    await sb.rpc('create_order', {
      p_event_id: eventId,
      p_shirt_color: 'black',
      p_shirt_size: 'M',
      p_design_front_id: null,
      p_design_back_id: null,
      p_client_name: 'r1-test',
      p_created_by: null,
      p_cashier_key: 'r1-test',
      p_cashier_name: 'r1-test',
    }),
    'create_order',
  );
  const id = created.id;
  let row = await fetchOrder(id);
  check('create_order: status new, order no 1', row.status === 'new' && row.event_order_no === 1, `no=${row.event_order_no}`);
  check('create_order: new_at set, later stamps empty', !!row.new_at && !row.in_progress_at && !row.ready_at && !row.completed_at);

  const step = (status) => sb.rpc('set_order_status', { p_order_id: id, p_status: status, p_user_id: userId });

  must(await step('in_progress'), 'in_progress');
  row = await fetchOrder(id);
  check('-> in_progress: status', row.status === 'in_progress');
  check('-> in_progress: in_progress_at set, claimed_by set', !!row.in_progress_at && row.claimed_by === userId);
  check('-> in_progress: later stamps empty', !row.ready_at && !row.completed_at);

  must(await step('ready'), 'ready');
  row = await fetchOrder(id);
  check('-> ready: status', row.status === 'ready');
  check('-> ready: ready_at set, completed_at empty', !!row.ready_at && !row.completed_at);

  must(await step('completed'), 'completed');
  row = await fetchOrder(id);
  check('-> completed: status', row.status === 'completed');
  check('-> completed: completed_at set', !!row.completed_at);

  // Backward transition must be a no-op: same status, same timestamps.
  const before = row;
  must(await step('new'), 'backward new');
  must(await step('in_progress'), 'backward in_progress');
  must(await step('completed'), 'repeat completed');
  row = await fetchOrder(id);
  check(
    'backward/repeat transitions are no-ops',
    row.status === 'completed' &&
      row.in_progress_at === before.in_progress_at &&
      row.ready_at === before.ready_at &&
      row.completed_at === before.completed_at &&
      row.claimed_by === before.claimed_by,
  );
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
