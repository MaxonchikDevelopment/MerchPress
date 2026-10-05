// Live check of migration round 2 (cancel, idempotent create, users lockdown,
// staff RPCs) against the real Supabase project. Uses the anon key from
// .env.local. Creates an INACTIVE throwaway event "ZZ-R2-TEST", deletes it and
// its orders in a finally block, and confirms nothing is left behind.
//
// Staff scenarios need an admin: set MP_ADMIN_ID and MP_ADMIN_PIN in the shell
// (never in a file in the repo). Without them those scenarios are skipped.
// There is no delete RPC, so the "ZZ-R2-STAFF" user stays, deactivated; the
// script prints its id and the SQL the owner must run to remove it.
//
// Run: MP_ADMIN_ID=<uuid> MP_ADMIN_PIN=<pin> node scripts/r2-livetest.mjs
import { randomUUID } from 'node:crypto';
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

const ADMIN_ID = process.env.MP_ADMIN_ID;
const ADMIN_PIN = process.env.MP_ADMIN_PIN;
const EVENT_NAME = 'ZZ-R2-TEST';
const STAFF_NAME = 'ZZ-R2-STAFF';
const STAFF_RENAMED = 'ZZ-R2-STAFF-RENAMED';
const NIL_UUID = '00000000-0000-0000-0000-000000000000';

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
let staffId = null;
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

  const staff = must(await sb.from('staff_v').select('id').limit(1), 'staff_v');
  const userId = staff[0]?.id ?? null;

  const createV2 = (requestId, label) =>
    sb.rpc('create_order_v2', {
      p_event_id: eventId,
      p_shirt_color: 'black',
      p_shirt_size: 'M',
      p_design_front_id: null,
      p_design_back_id: null,
      p_client_name: label,
      p_created_by: null,
      p_cashier_key: 'r2-test',
      p_cashier_name: 'r2-test',
      p_client_request_id: requestId,
    });
  const step = (id, status) =>
    sb.rpc('set_order_status', { p_order_id: id, p_status: status, p_user_id: userId });

  // ---- idempotent create ----
  const reqId = randomUUID();
  const a = must(await createV2(reqId, 'r2-idem'), 'create_order_v2 #1');
  const b = must(await createV2(reqId, 'r2-idem'), 'create_order_v2 #2');
  check('create_order_v2 twice, same request id: same order', a.id === b.id && a.event_order_no === b.event_order_no);
  const rows = must(await sb.from('orders').select('id').eq('client_request_id', reqId), 'count by request id');
  check('exactly one row for that request id', rows.length === 1, `found ${rows.length}`);
  const all = must(await sb.from('orders').select('id').eq('event_id', eventId), 'count in event');
  check('exactly one order in the event so far', all.length === 1, `found ${all.length}`);

  // same request id, different size: the first order comes back unchanged
  const c = must(
    await sb.rpc('create_order_v2', {
      p_event_id: eventId, p_shirt_color: 'black', p_shirt_size: 'XL',
      p_design_front_id: null, p_design_back_id: null, p_client_name: 'r2-idem',
      p_created_by: null, p_cashier_key: 'r2-test', p_cashier_name: 'r2-test',
      p_client_request_id: reqId,
    }),
    'create_order_v2 #3 (changed size)',
  );
  check('same request id, different size: first order unchanged', c.id === a.id && c.shirt_size === 'M', `size ${c.shirt_size}`);
  const all2 = must(await sb.from('orders').select('id').eq('event_id', eventId), 'count after changed resend');
  check('changed resend created no extra order', all2.length === 1, `found ${all2.length}`);

  // ---- cancel from new / in_progress / ready ----
  for (const from of ['new', 'in_progress', 'ready']) {
    const o = must(await createV2(randomUUID(), `r2-cancel-${from}`), `create (${from})`);
    if (from !== 'new') must(await step(o.id, 'in_progress'), 'in_progress');
    if (from === 'ready') must(await step(o.id, 'ready'), 'ready');
    const ret = must(await step(o.id, 'cancelled'), `cancel from ${from}`);
    const row = await fetchOrder(o.id);
    check(
      `cancel from ${from}: status cancelled, cancelled_at set`,
      row.status === 'cancelled' && !!row.cancelled_at && ret.status === 'cancelled',
    );
    check(`cancel from ${from}: cancelled_by is the actor`, row.cancelled_by === userId);
  }

  // ---- cancel on completed is a no-op ----
  const done = must(await createV2(randomUUID(), 'r2-completed'), 'create (completed)');
  for (const s of ['in_progress', 'ready', 'completed']) must(await step(done.id, s), s);
  const ret = must(await step(done.id, 'cancelled'), 'cancel completed');
  const doneRow = await fetchOrder(done.id);
  check(
    'cancel on completed: no-op (row returned unchanged)',
    doneRow.status === 'completed' && !doneRow.cancelled_at && ret.status === 'completed',
  );

  // ---- status change on a cancelled order is a no-op ----
  const dead = must(await createV2(randomUUID(), 'r2-dead'), 'create (dead)');
  must(await step(dead.id, 'cancelled'), 'cancel');
  const before = await fetchOrder(dead.id);
  for (const s of ['in_progress', 'ready', 'completed', 'new']) must(await step(dead.id, s), `after cancel: ${s}`);
  const after = await fetchOrder(dead.id);
  check(
    'status changes on a cancelled order are no-ops',
    after.status === 'cancelled' &&
      after.cancelled_at === before.cancelled_at &&
      !after.in_progress_at &&
      !after.ready_at &&
      !after.completed_at,
  );

  // ---- direct insert into users with the anon key is rejected ----
  const probe = await sb.from('users').insert({ name: 'ZZ-R2-PROBE', role: 'cashier', pin: '0000' });
  check('anon insert into users is rejected', !!probe.error && probe.status !== 201, probe.error?.message ?? 'NO ERROR');
  if (!probe.error) console.log('      A ZZ-R2-PROBE row was inserted. Delete it: delete from users where name = \'ZZ-R2-PROBE\';');

  // ---- staff_list with a wrong PIN ----
  const wrong = await sb.rpc('staff_list', { p_admin_id: ADMIN_ID ?? NIL_UUID, p_admin_pin: 'wrong' });
  check('staff_list with a wrong PIN fails with not_admin', !!wrong.error && /not_admin/.test(wrong.error.message), wrong.error?.message ?? 'NO ERROR');

  // ---- staff scenarios (need an admin) ----
  if (!ADMIN_ID || !ADMIN_PIN) {
    console.log('SKIP  staff scenarios: set MP_ADMIN_ID and MP_ADMIN_PIN to run them');
  } else {
    const admin = { p_admin_id: ADMIN_ID, p_admin_pin: ADMIN_PIN };
    const list = async () => must(await sb.rpc('staff_list', admin), 'staff_list');
    let people = await list();
    check('staff_list with the admin PIN returns rows', people.length > 0, `${people.length} rows`);
    check('staff_list never returns a pin column', people.every((p) => !('pin' in p)));

    let me = people.find((p) => p.name === STAFF_NAME || p.name === STAFF_RENAMED);
    if (me) {
      console.log(`      reusing existing staff row ${me.id} ("${me.name}")`);
      must(await sb.rpc('staff_update', { ...admin, p_user_id: me.id, p_name: STAFF_NAME, p_role: 'cashier', p_is_active: true }), 'reset reused row');
    } else {
      const id = must(
        await sb.rpc('staff_create', { ...admin, p_name: STAFF_NAME, p_role: 'cashier', p_pin: '4821' }),
        'staff_create',
      );
      people = await list();
      me = people.find((p) => p.id === id);
      check('staff_create: new cashier listed and active', !!me && me.is_active && me.role === 'cashier');
    }
    staffId = me?.id ?? null;

    if (staffId) {
      must(await sb.rpc('staff_update', { ...admin, p_user_id: staffId, p_name: STAFF_RENAMED, p_role: 'cashier', p_is_active: true }), 'rename');
      me = (await list()).find((p) => p.id === staffId);
      check('staff_update: renamed', me?.name === STAFF_RENAMED);

      must(await sb.rpc('staff_set_pin', { ...admin, p_user_id: staffId, p_new_pin: '5937' }), 'set pin');
      const good = must(await sb.rpc('verify_pin', { p_user_id: staffId, p_pin: '5937' }), 'verify new pin');
      const bad = must(await sb.rpc('verify_pin', { p_user_id: staffId, p_pin: '4821' }), 'verify old pin');
      check('staff_set_pin: new PIN verifies, old one does not', !!good?.id && !bad?.id);

      const weak = await sb.rpc('staff_set_pin', { ...admin, p_user_id: staffId, p_new_pin: '12' });
      check('staff_set_pin rejects a short PIN (invalid_pin)', /invalid_pin/.test(weak.error?.message ?? ''));

      must(await sb.rpc('staff_update', { ...admin, p_user_id: staffId, p_name: STAFF_RENAMED, p_role: 'cashier', p_is_active: false }), 'deactivate');
      me = (await list()).find((p) => p.id === staffId);
      check('staff_update: deactivated', me?.is_active === false);
      const picker = must(await sb.from('staff_v').select('id').eq('id', staffId), 'staff_v');
      check('deactivated user is gone from the login picker (staff_v)', picker.length === 0);
    }
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
  if (staffId) {
    console.log(`\nStaff row left behind (deactivated, no delete RPC): ${staffId}`);
    console.log("Owner, to remove it:  delete from users where id = '" + staffId + "';");
  }
}
console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
process.exitCode = failures ? 1 : 0;
