// Run with: node scripts/check-cashier-cancel-notice.ts
import assert from 'node:assert/strict';
import { cashierCancelNotice } from '../src/lib/cashierCancelNotice.ts';
import type { Order } from '../src/types/db';

let n = 0;
const test = (name: string, fn: () => void) => {
  fn();
  n++;
  console.log(`ok - ${name}`);
};

const base = { id: 'o1', event_order_no: 7, status: 'new', created_by: 'c1', cancelled_by: null } as unknown as Order;
const row = (o: Partial<Order>): Order => ({ ...base, ...o }) as Order;
const cancelled = (by: string | null) => row({ status: 'cancelled', cancelled_by: by });

test('my new order cancelled by press', () =>
  assert.deepEqual(cashierCancelNotice(row({}), cancelled('p1'), 'c1'), { orderNo: 7, by: 'p1' }));
test('my in progress order cancelled by press', () =>
  assert.deepEqual(cashierCancelNotice(row({ status: 'in_progress' }), cancelled('p1'), 'c1'), { orderNo: 7, by: 'p1' }));
test('my ready order cancelled by press', () =>
  assert.deepEqual(cashierCancelNotice(row({ status: 'ready' }), cancelled('p1'), 'c1'), { orderNo: 7, by: 'p1' }));
test('my own cancel is silent', () => assert.equal(cashierCancelNotice(row({}), cancelled('c1'), 'c1'), null));
test("someone else's order is silent", () =>
  assert.equal(
    cashierCancelNotice(row({ created_by: 'c2' }), row({ created_by: 'c2', status: 'cancelled', cancelled_by: 'p1' }), 'c1'),
    null,
  ));
test('unknown canceller still shows, by is null', () =>
  assert.deepEqual(cashierCancelNotice(row({}), cancelled(null), 'c1'), { orderNo: 7, by: null }));
test('missing previous row is silent', () => assert.equal(cashierCancelNotice(null, cancelled('p1'), 'c1'), null));
test('completed order was not open', () =>
  assert.equal(cashierCancelNotice(row({ status: 'completed' }), cancelled('p1'), 'c1'), null));
test('already cancelled row updated again is silent', () =>
  assert.equal(cashierCancelNotice(row({ status: 'cancelled' }), cancelled('p1'), 'c1'), null));
test('not a cancel is silent', () => assert.equal(cashierCancelNotice(row({}), row({ status: 'in_progress' }), 'c1'), null));
test('no signed-in user is silent', () => assert.equal(cashierCancelNotice(row({}), cancelled('p1'), undefined), null));

console.log(`${n} checks passed`);
