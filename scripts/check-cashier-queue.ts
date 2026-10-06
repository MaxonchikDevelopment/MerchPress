// Run with: node scripts/check-cashier-queue.ts
import assert from 'node:assert/strict';
import { cashierQueue } from '../src/lib/cashierQueue.ts';
import type { Order } from '../src/types/db';

let n = 0;
const test = (name: string, fn: () => void) => {
  fn();
  n++;
  console.log(`ok - ${name}`);
};

const o = (id: string, p: Partial<Order>): Order =>
  ({ id, status: 'new', created_by: 'c1', created_at: '2026-10-06T10:00:00Z', ready_at: null, ...p }) as unknown as Order;
const ids = (l: Order[]) => l.map((x) => x.id);

test('other cashiers orders never appear in either section', () => {
  const q = cashierQueue(
    [o('a', {}), o('b', { created_by: 'c2' }), o('c', { status: 'ready', created_by: 'c2' }), o('d', { status: 'in_progress', created_by: 'c2' })],
    'c1',
  );
  assert.deepEqual(ids(q.inProgress), ['a']);
  assert.deepEqual(ids(q.ready), []);
});
test('my ready orders are listed', () =>
  assert.deepEqual(ids(cashierQueue([o('a', { status: 'ready' })], 'c1').ready), ['a']));
test('new and in progress share the in progress section, FIFO by created_at', () =>
  assert.deepEqual(
    ids(
      cashierQueue(
        [
          o('late', { created_at: '2026-10-06T10:05:00Z' }),
          o('early', { status: 'in_progress', created_at: '2026-10-06T10:01:00Z' }),
        ],
        'c1',
      ).inProgress,
    ),
    ['early', 'late'],
  ));
test('ready is oldest ready first', () =>
  assert.deepEqual(
    ids(
      cashierQueue(
        [
          o('b', { status: 'ready', ready_at: '2026-10-06T10:09:00Z' }),
          o('a', { status: 'ready', ready_at: '2026-10-06T10:03:00Z' }),
        ],
        'c1',
      ).ready,
    ),
    ['a', 'b'],
  ));
test('closed orders are not listed', () => {
  const q = cashierQueue([o('a', { status: 'completed' }), o('b', { status: 'cancelled' })], 'c1');
  assert.deepEqual([...q.inProgress, ...q.ready], []);
});
test('no signed-in user gives empty lists', () => {
  const q = cashierQueue([o('a', {}), o('b', { status: 'ready' })], undefined);
  assert.deepEqual([...q.inProgress, ...q.ready], []);
});
test('input list is not reordered', () => {
  const list = [o('b', { created_at: '2026-10-06T10:09:00Z' }), o('a', { created_at: '2026-10-06T10:01:00Z' })];
  cashierQueue(list, 'c1');
  assert.deepEqual(ids(list), ['b', 'a']);
});

console.log(`${n} checks passed`);
