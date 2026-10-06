// Run with: node scripts/check-send-hint.ts
import assert from 'node:assert/strict';
import { sendHint } from '../src/lib/sendHint.ts';

let n = 0;
const test = (name: string, fn: () => void) => {
  fn();
  n++;
  console.log(`ok - ${name}`);
};

test('color missing', () => assert.equal(sendHint(null, 'M'), 'Pick a color'));
test('size missing', () => assert.equal(sendHint('white', null), 'Pick a size'));
test('both missing', () => assert.equal(sendHint(null, null), 'Pick a color and a size'));
test('none missing', () => assert.equal(sendHint('white', 'M'), null));

console.log(`${n} checks passed`);
