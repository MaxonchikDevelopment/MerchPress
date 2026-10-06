// Run with: node scripts/check-claim-result.ts
import assert from 'node:assert/strict';
import { classifyClaim } from '../src/lib/claimResult.ts';

const ME = 'u-me';
const OTHER = 'u-other';
let n = 0;
const test = (name: string, fn: () => void) => {
  fn();
  n++;
  console.log(`ok - ${name}`);
};

test('null row is failed', () => assert.deepEqual(classifyClaim(null, ME), { kind: 'failed' }));
test('new is failed', () =>
  assert.deepEqual(classifyClaim({ status: 'new', claimed_by: null }, ME), { kind: 'failed' }));
test('in_progress own is claimed', () =>
  assert.deepEqual(classifyClaim({ status: 'in_progress', claimed_by: ME }, ME), { kind: 'claimed' }));
test('in_progress other is taken', () =>
  assert.deepEqual(classifyClaim({ status: 'in_progress', claimed_by: OTHER }, ME), { kind: 'taken', by: OTHER }));
test('in_progress null claimed_by is taken', () =>
  assert.deepEqual(classifyClaim({ status: 'in_progress', claimed_by: null }, ME), { kind: 'taken', by: null }));
test('ready own is claimed', () =>
  assert.deepEqual(classifyClaim({ status: 'ready', claimed_by: ME }, ME), { kind: 'claimed' }));
test('ready other is taken', () =>
  assert.deepEqual(classifyClaim({ status: 'ready', claimed_by: OTHER }, ME), { kind: 'taken', by: OTHER }));
test('ready null claimed_by is taken', () =>
  assert.deepEqual(classifyClaim({ status: 'ready', claimed_by: null }, ME), { kind: 'taken', by: null }));
test('completed is closed', () =>
  assert.deepEqual(classifyClaim({ status: 'completed', claimed_by: ME }, ME), { kind: 'closed' }));
test('cancelled is closed', () =>
  assert.deepEqual(classifyClaim({ status: 'cancelled', claimed_by: null }, ME), { kind: 'closed' }));
test('userId undefined never claims (in_progress)', () =>
  assert.deepEqual(classifyClaim({ status: 'in_progress', claimed_by: ME }, undefined), { kind: 'taken', by: ME }));
test('userId undefined never claims (ready, null claimed_by)', () =>
  assert.deepEqual(classifyClaim({ status: 'ready', claimed_by: null }, undefined), { kind: 'taken', by: null }));

console.log(`${n} checks passed`);
