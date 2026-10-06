// Run with: node scripts/check-event-dates.ts
import assert from 'node:assert/strict';
import { formatEventDates, isEndBeforeStart } from '../src/lib/eventDates.ts';

let n = 0;
const test = (name: string, fn: () => void) => {
  fn();
  n++;
  console.log(`PASS ${name}`);
};

test('no start gives an empty string', () => {
  assert.equal(formatEventDates(null, null), '');
  assert.equal(formatEventDates(null, '2026-10-11'), '');
});
test('start only', () => assert.equal(formatEventDates('2026-10-10', null), '10 Oct 2026'));
test('same day shows one date', () => assert.equal(formatEventDates('2026-10-10', '2026-10-10'), '10 Oct 2026'));
test('two days', () => assert.equal(formatEventDates('2026-10-10', '2026-10-11'), '10–11 Oct 2026'));
test('across months', () => assert.equal(formatEventDates('2026-10-30', '2026-11-02'), '30 Oct – 2 Nov 2026'));
test('across years', () => assert.equal(formatEventDates('2026-12-31', '2027-01-01'), '31 Dec 2026 – 1 Jan 2027'));
test('no day shift on the first and last day of a month', () => {
  assert.equal(formatEventDates('2026-01-01', null), '1 Jan 2026');
  assert.equal(formatEventDates('2026-03-31', null), '31 Mar 2026');
});
test('end before start is detected', () => {
  assert.equal(isEndBeforeStart('2026-10-11', '2026-10-10'), true);
  assert.equal(isEndBeforeStart('2026-10-10', '2026-10-10'), false);
  assert.equal(isEndBeforeStart('2026-10-10', '2026-10-11'), false);
  assert.equal(isEndBeforeStart(null, '2026-10-10'), false);
  assert.equal(isEndBeforeStart('2026-10-10', null), false);
});

console.log(`\n${n} checks passed`);
