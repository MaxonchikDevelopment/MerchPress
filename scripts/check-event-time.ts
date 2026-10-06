// Run with: node scripts/check-event-time.ts
import assert from 'node:assert/strict';
import { formatEventTime, eventDay, EVENT_TZ } from '../src/lib/eventTime.ts';

let n = 0;
const test = (name: string, fn: () => void) => {
  fn();
  n++;
  console.log(`ok - ${name}`);
};

test('zone constant', () => assert.equal(EVENT_TZ, 'Europe/Warsaw'));
test('summer time', () =>
  assert.equal(formatEventTime('2026-10-10T12:12:31Z'), '2026-10-10 14:12'));
test('across midnight', () =>
  assert.equal(formatEventTime('2026-10-10T22:30:00Z'), '2026-10-11 00:30'));
test('winter time', () =>
  assert.equal(formatEventTime('2026-11-21T12:00:00Z'), '2026-11-21 13:00'));
test('exact midnight is 00, not 24', () =>
  assert.equal(formatEventTime('2026-10-10T22:00:00Z'), '2026-10-11 00:00'));
test('timestamptz offset form', () =>
  assert.equal(formatEventTime('2026-10-10T12:12:31.123+00:00'), '2026-10-10 14:12'));
test('null', () => assert.equal(formatEventTime(null), ''));
test('empty', () => assert.equal(formatEventTime(''), ''));
test('garbage', () => assert.equal(formatEventTime('nope'), ''));
test('eventDay', () => assert.equal(eventDay('2026-10-10T22:30:00Z'), '2026-10-11'));

console.log(`${n} checks passed`);
