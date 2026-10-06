// Run with: node scripts/check-display-name.ts
import assert from 'node:assert/strict';
import { repeatsLabel } from '../src/lib/displayName.ts';

let n = 0;
const test = (name: string, fn: () => void) => {
  fn();
  n++;
  console.log(`ok - ${name}`);
};

test('same text', () => assert.equal(repeatsLabel('Admin', 'Admin'), true));
test('case-insensitive', () => assert.equal(repeatsLabel('admin', 'Admin'), true));
test('surrounding space', () => assert.equal(repeatsLabel('  ADMIN ', 'Admin'), true));
test('different name', () => assert.equal(repeatsLabel('Anna', 'Cashier', 'Cashier'), false));
test('matches any label', () => assert.equal(repeatsLabel('Press', 'Press queue', 'Press'), true));
test('partial match is not a match', () => assert.equal(repeatsLabel('Press', 'Press queue'), false));
test('empty or missing name', () => {
  assert.equal(repeatsLabel('', 'Admin'), false);
  assert.equal(repeatsLabel(undefined, 'Admin'), false);
  assert.equal(repeatsLabel('   ', ''), false);
});

console.log(`${n} checks passed`);
