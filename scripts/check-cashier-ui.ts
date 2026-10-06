// Run with: node scripts/check-cashier-ui.ts
import assert from 'node:assert/strict';
import { orderSummary } from '../src/lib/orderSummary.ts';
import { readyBadgeCount } from '../src/lib/readyBadge.ts';
import type { Order } from '../src/types/db.ts';

let n = 0;
const test = (name: string, fn: () => void) => {
  fn();
  n++;
  console.log(`ok - ${name}`);
};

const none = { colorLabel: null, size: null, frontName: null, backName: null };

test('summary: nothing chosen is empty', () => assert.equal(orderSummary(none), ''));
test('summary: color only', () => assert.equal(orderSummary({ ...none, colorLabel: 'Black' }), 'Black'));
test('summary: size only', () => assert.equal(orderSummary({ ...none, size: 'M' }), 'M'));
test('summary: color and size', () => assert.equal(orderSummary({ ...none, colorLabel: 'Black', size: 'M' }), 'Black · M'));
test('summary: front design only', () =>
  assert.equal(orderSummary({ ...none, frontName: 'Wolf' }), 'Front: Wolf'));
test('summary: skips unchosen parts in the middle', () =>
  assert.equal(orderSummary({ colorLabel: 'Navy', size: null, frontName: null, backName: 'Fox' }), 'Navy · Back: Fox'));
test('summary: all chosen with designs', () =>
  assert.equal(
    orderSummary({ colorLabel: 'Black', size: 'M', frontName: 'Name A', backName: 'Name B' }),
    'Black · M · Front: Name A · Back: Name B',
  ));
test('summary: all chosen without designs', () =>
  assert.equal(orderSummary({ colorLabel: 'White', size: 'XL', frontName: null, backName: null }), 'White · XL'));

const mk = (status: Order['status'], by: string | null) => ({ status, created_by: by });

test('badge: own ready orders are counted', () =>
  assert.equal(readyBadgeCount([mk('ready', 'u1'), mk('ready', 'u1'), mk('new', 'u1')], 'u1'), 2));
test("badge: others' ready orders are ignored", () =>
  assert.equal(readyBadgeCount([mk('ready', 'u2'), mk('ready', 'u1'), mk('ready', null)], 'u1'), 1));
test('badge: no ready orders is 0', () =>
  assert.equal(readyBadgeCount([mk('new', 'u1'), mk('in_progress', 'u1'), mk('completed', 'u1'), mk('cancelled', 'u1')], 'u1'), 0));
test('badge: empty list is 0', () => assert.equal(readyBadgeCount([], 'u1'), 0));
test('badge: unknown user is 0', () => assert.equal(readyBadgeCount([mk('ready', 'u1')], undefined), 0));

console.log(`${n} checks passed`);
