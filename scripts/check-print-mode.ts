// Run with: node scripts/check-print-mode.ts
import assert from 'node:assert/strict';
import { printMode } from '../src/lib/printMode.ts';

let n = 0;
const test = (name: string, fn: () => void) => {
  fn();
  n++;
  console.log(`ok - ${name}`);
};

test('bundle', () => assert.equal(printMode('a', 'a'), 'Bundle'));
test('custom, two designs', () => assert.equal(printMode('a', 'b'), 'Custom'));
test('custom, front only', () => assert.equal(printMode('a', null), 'Custom'));
test('custom, back only', () => assert.equal(printMode(null, 'b'), 'Custom'));
test('none', () => assert.equal(printMode(null, null), 'None'));

console.log(`${n} checks passed`);
