// Run with: node scripts/check-cancel-notice.ts
import assert from 'node:assert/strict';
import { cancelNotice } from '../src/lib/cancelNotice.ts';
import type { Order } from '../src/types/db';

let n = 0;
const test = (name: string, fn: () => void) => {
  fn();
  n++;
  console.log(`ok - ${name}`);
};

const base = { id: 'o1', event_order_no: 12, status: 'new', cancelled_by: null } as unknown as Order;
const row = (o: Partial<Order>): Order => ({ ...base, ...o }) as Order;

test('new cancelled by someone else', () =>
  assert.deepEqual(cancelNotice(row({}), row({ status: 'cancelled', cancelled_by: 'c1' }), 'p1'), { orderNo: 12, by: 'c1' }));
test('in progress cancelled by someone else', () =>
  assert.deepEqual(cancelNotice(row({ status: 'in_progress' }), row({ status: 'cancelled', cancelled_by: 'c1' }), 'p1'), {
    orderNo: 12,
    by: 'c1',
  }));
test('my own cancel is silent', () =>
  assert.equal(cancelNotice(row({}), row({ status: 'cancelled', cancelled_by: 'p1' }), 'p1'), null));
test('unknown canceller still shows, by is null', () =>
  assert.deepEqual(cancelNotice(row({}), row({ status: 'cancelled' }), 'p1'), { orderNo: 12, by: null }));
test('ready order was not in the press queue', () =>
  assert.equal(cancelNotice(row({ status: 'ready' }), row({ status: 'cancelled', cancelled_by: 'c1' }), 'p1'), null));
test('missing previous row is silent', () =>
  assert.equal(cancelNotice(null, row({ status: 'cancelled', cancelled_by: 'c1' }), 'p1'), null));
test('other transitions are silent', () => {
  assert.equal(cancelNotice(row({}), row({ status: 'in_progress' }), 'p1'), null);
  assert.equal(cancelNotice(row({ status: 'in_progress' }), row({ status: 'ready' }), 'p1'), null);
});
test('already cancelled row updated again is silent', () =>
  assert.equal(cancelNotice(row({ status: 'cancelled' }), row({ status: 'cancelled', cancelled_by: 'c1' }), 'p1'), null));

console.log(`${n} checks passed`);
