// Run with: node scripts/check-compat-matrix.ts
import assert from 'node:assert/strict';
import { hasNoMatch, sameList, tickAll, tickKey, tickedKeys, toStored, toggleKey } from '../src/lib/compatMatrix.ts';

let n = 0;
const test = (name: string, fn: () => void) => {
  fn();
  n++;
  console.log(`ok - ${name}`);
};

const palette = ['black', 'white', 'navy', 'red'];

test('empty list reads as all ticked', () => assert.deepEqual(tickedKeys([], palette), palette));
test('a list reads as its palette keys, in palette order', () =>
  assert.deepEqual(tickedKeys(['red', 'black'], palette), ['black', 'red']));
test('unknown keys are ignored on display', () =>
  assert.deepEqual(tickedKeys(['ghost', 'white'], palette), ['white']));

test('unticking one colour from "all" gives the palette minus that key', () =>
  assert.deepEqual(toggleKey([], palette, 'navy'), { next: ['black', 'white', 'red'], blocked: false }));
test('ticking it back gives an empty list', () =>
  assert.deepEqual(toggleKey(['black', 'white', 'red'], palette, 'navy'), { next: [], blocked: false }));
test('ticking keeps palette order', () =>
  assert.deepEqual(toggleKey(['red'], palette, 'white'), { next: ['white', 'red'], blocked: false }));
test('unticking the last ticked colour is blocked and changes nothing', () =>
  assert.deepEqual(toggleKey(['white'], palette, 'white'), { next: ['white'], blocked: true }));
test('a one-colour palette cannot be unticked', () =>
  assert.deepEqual(toggleKey([], ['black'], 'black'), { next: [], blocked: true }));

test('unknown keys are dropped on save', () =>
  assert.deepEqual(toggleKey(['ghost', 'white'], palette, 'red'), { next: ['white', 'red'], blocked: false }));
test('stored orphans with all palette keys ticked save as an empty list', () =>
  assert.deepEqual(toStored(['ghost', ...palette], palette), []));
test('toStored never keeps unknown keys', () => assert.deepEqual(toStored(['ghost', 'red'], palette), ['red']));

test('a list with no palette key is flagged', () => assert.equal(hasNoMatch(['ghost'], palette), true));
test('not flagged: empty list, or at least one palette key', () => {
  assert.equal(hasNoMatch([], palette), false);
  assert.equal(hasNoMatch(['ghost', 'red'], palette), false);
});
test('flagged row shows nothing ticked, and a tap ticks only that colour', () => {
  assert.deepEqual(tickedKeys(['ghost'], palette), []);
  assert.deepEqual(toggleKey(['ghost'], palette, 'navy'), { next: ['navy'], blocked: false });
});

test('"All" gives an empty list', () => assert.deepEqual(tickAll(), []));
test('column action ticks one colour in palette order', () =>
  assert.deepEqual(tickKey(['black', 'red'], palette, 'navy'), ['black', 'navy', 'red']));
test('column action that completes the row stores an empty list', () =>
  assert.deepEqual(tickKey(['black', 'white', 'red'], palette, 'navy'), []));
test('column action on an "any" row changes nothing', () => assert.deepEqual(tickKey([], palette, 'navy'), []));
test('column action on a flagged row ticks just that colour', () =>
  assert.deepEqual(tickKey(['ghost'], palette, 'white'), ['white']));
test('unknown key in a tap or column action is a no-op', () => {
  assert.deepEqual(toggleKey(['red'], palette, 'ghost'), { next: ['red'], blocked: false });
  assert.deepEqual(tickKey(['red'], palette, 'ghost'), ['red']);
});

test('sameList compares order and content', () => {
  assert.equal(sameList(['a', 'b'], ['a', 'b']), true);
  assert.equal(sameList(['a', 'b'], ['b', 'a']), false);
  assert.equal(sameList([], ['a']), false);
});

console.log(`${n} checks passed`);
