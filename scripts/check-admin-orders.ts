// Run with: node scripts/check-admin-orders.ts
import assert from 'node:assert/strict';
import { adminOrderList } from '../src/lib/adminOrders.ts';
import type { Order } from '../src/types/db';

let n = 0;
const test = (name: string, fn: () => void) => {
  fn();
  n++;
  console.log(`ok - ${name}`);
};

const o = (id: string, status: string, created_at: string): Order => ({ id, status, created_at }) as unknown as Order;
const ids = (l: Order[]) => l.map((x) => x.id);
const t = (m: number) => `2026-10-06T10:${String(m).padStart(2, '0')}:00Z`;

const sample = [
  o('n1', 'new', t(5)),
  o('r2', 'ready', t(9)),
  o('p1', 'in_progress', t(3)),
  o('r1', 'ready', t(2)),
  o('n0', 'new', t(1)),
  o('p2', 'in_progress', t(8)),
];

test('All: ready, then in progress, then new, oldest first inside each group', () =>
  assert.deepEqual(ids(adminOrderList(sample, 'all').list), ['r1', 'r2', 'p1', 'p2', 'n0', 'n1']));
test('each chip keeps only its status, oldest first', () => {
  assert.deepEqual(ids(adminOrderList(sample, 'new').list), ['n0', 'n1']);
  assert.deepEqual(ids(adminOrderList(sample, 'in_progress').list), ['p1', 'p2']);
  assert.deepEqual(ids(adminOrderList(sample, 'ready').list), ['r1', 'r2']);
});
test('counts cover all active orders whatever the filter', () => {
  const c = adminOrderList(sample, 'ready').counts;
  assert.deepEqual(c, { all: 6, new: 2, in_progress: 2, ready: 2 });
});
test('completed and cancelled orders never show or count', () => {
  const r = adminOrderList([...sample, o('c1', 'completed', t(0)), o('x1', 'cancelled', t(0))], 'all');
  assert.deepEqual(ids(r.list), ['r1', 'r2', 'p1', 'p2', 'n0', 'n1']);
  assert.equal(r.counts.all, 6);
});
test('empty list', () => assert.deepEqual(adminOrderList([], 'all'), { list: [], counts: { all: 0, new: 0, in_progress: 0, ready: 0 } }));
test('input list is not reordered', () => {
  const copy = ids(sample);
  adminOrderList(sample, 'all');
  assert.deepEqual(ids(sample), copy);
});

console.log(`${n} checks passed`);
