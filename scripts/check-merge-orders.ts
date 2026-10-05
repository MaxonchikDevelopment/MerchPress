// Run with: node scripts/check-merge-orders.ts
import assert from 'node:assert/strict';
import { mergeOrders } from '../src/lib/mergeOrders.ts';
import type { Order } from '../src/types/db.ts';

let n = 0;
const mk = (id: string, status: Order['status'], created: string): Order => ({
  id,
  event_id: 'e1',
  event_order_no: Number(id.slice(1)),
  created_at: created,
  shirt_color: 'white',
  shirt_size: 'M',
  design_front_id: null,
  design_back_id: null,
  client_name: null,
  status,
  created_by: null,
  cashier_key: null,
  cashier_name: null,
  claimed_by: null,
  new_at: created,
  in_progress_at: null,
  ready_at: null,
  completed_at: null,
});

const test = (name: string, fn: () => void) => {
  fn();
  n++;
  console.log(`PASS ${name}`);
};

const a = mk('o1', 'new', '2026-10-05T10:00:00+00:00');
const b = mk('o2', 'new', '2026-10-05T10:01:00+00:00');
const snapshot = [a, b];

test('no realtime activity returns the snapshot unchanged', () => {
  assert.deepEqual(mergeOrders(snapshot, [], []), snapshot);
});

test('an insert during refetch survives, in FIFO order', () => {
  const c = mk('o3', 'new', '2026-10-05T10:02:00+00:00');
  assert.deepEqual(mergeOrders(snapshot, [c], []).map((o) => o.id), ['o1', 'o2', 'o3']);
});

test('an update during refetch wins over the snapshot', () => {
  const newer = { ...b, status: 'ready' as const };
  const out = mergeOrders(snapshot, [newer], []);
  assert.equal(out.find((o) => o.id === 'o2')?.status, 'ready');
  assert.equal(out.length, 2);
});

test('a delete during refetch stays deleted', () => {
  assert.deepEqual(mergeOrders(snapshot, [], ['o1']).map((o) => o.id), ['o2']);
});

test('a closed order is dropped', () => {
  const done = mk('o4', 'completed', '2026-10-05T10:03:00+00:00');
  const cancelled = mk('o5', 'cancelled', '2026-10-05T10:04:00+00:00');
  const out = mergeOrders([a, done], [cancelled, { ...b, status: 'completed' }], []);
  assert.deepEqual(out.map((o) => o.id), ['o1']);
});

console.log(`${n} checks passed`);
