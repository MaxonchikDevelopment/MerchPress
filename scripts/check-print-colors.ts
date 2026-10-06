// Run with: node scripts/check-print-colors.ts
import assert from 'node:assert/strict';
import { printColors } from '../src/lib/printColors.ts';

let n = 0;
const test = (name: string, fn: () => void) => {
  fn();
  n++;
  console.log(`ok - ${name}`);
};

const keys = ['black', 'white', 'navy', 'red'];
const d = (...compatible_colors: string[]) => ({ compatible_colors });

test('no design chosen: all shown, none dimmed, no reset (bundle)', () =>
  assert.deepEqual(printColors({ mode: 'bundle', chosen: [], colorKeys: keys, picked: 'red' }), {
    visible: keys,
    dimmed: [],
    resetColor: false,
  }));
test('no design chosen: all shown, none dimmed (custom)', () =>
  assert.deepEqual(printColors({ mode: 'custom', chosen: [], colorKeys: keys, picked: null }), {
    visible: keys,
    dimmed: [],
    resetColor: false,
  }));
test('bundle with empty compatible_colors: all shown', () =>
  assert.deepEqual(printColors({ mode: 'bundle', chosen: [d()], colorKeys: keys, picked: 'red' }), {
    visible: keys,
    dimmed: [],
    resetColor: false,
  }));
test('bundle with a subset: others hidden, event order kept', () =>
  assert.deepEqual(printColors({ mode: 'bundle', chosen: [d('navy', 'black')], colorKeys: keys, picked: null }), {
    visible: ['black', 'navy'],
    dimmed: [],
    resetColor: false,
  }));
test('bundle: a picked colour that stays compatible is kept', () =>
  assert.equal(printColors({ mode: 'bundle', chosen: [d('black', 'white')], colorKeys: keys, picked: 'white' }).resetColor, false));
test('bundle: a picked colour that becomes incompatible is reset', () =>
  assert.equal(printColors({ mode: 'bundle', chosen: [d('black', 'white')], colorKeys: keys, picked: 'red' }).resetColor, true));
test('bundle: nothing picked never asks for a reset', () =>
  assert.equal(printColors({ mode: 'bundle', chosen: [d('black')], colorKeys: keys, picked: null }).resetColor, false));
test('bundle: compatible keys the event does not offer leave all colours visible', () =>
  assert.deepEqual(printColors({ mode: 'bundle', chosen: [d('green')], colorKeys: keys, picked: 'red' }), {
    visible: keys,
    dimmed: [],
    resetColor: false,
  }));
test('custom with two designs: intersection stays, the rest is dimmed, nothing hidden', () =>
  assert.deepEqual(
    printColors({ mode: 'custom', chosen: [d('black', 'white', 'navy'), d('white', 'navy', 'red')], colorKeys: keys, picked: 'black' }),
    { visible: keys, dimmed: ['black', 'red'], resetColor: false },
  ));
test('custom with an empty intersection: nothing dimmed, nothing hidden', () =>
  assert.deepEqual(printColors({ mode: 'custom', chosen: [d('black'), d('white')], colorKeys: keys, picked: 'red' }), {
    visible: keys,
    dimmed: [],
    resetColor: false,
  }));
test('custom: an empty list is "any" and does not erase the other design\'s advice', () =>
  assert.deepEqual(printColors({ mode: 'custom', chosen: [d(), d('black')], colorKeys: keys, picked: null }), {
    visible: keys,
    dimmed: ['white', 'navy', 'red'],
    resetColor: false,
  }));
test('custom: a picked incompatible colour is never reset', () =>
  assert.equal(printColors({ mode: 'custom', chosen: [d('black')], colorKeys: keys, picked: 'red' }).resetColor, false));

console.log(`${n} checks passed`);
