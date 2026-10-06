// Run with: node scripts/check-pin-key.ts
import assert from 'node:assert/strict';
import { pinKeyAction } from '../src/lib/pinKey.ts';

let n = 0;
const test = (name: string, fn: () => void) => {
  fn();
  n++;
  console.log(`ok - ${name}`);
};

test('digits 0 to 9', () => {
  for (const d of '0123456789') assert.deepEqual(pinKeyAction({ key: d }), { kind: 'digit', digit: d });
});
test('Backspace and Enter', () => {
  assert.deepEqual(pinKeyAction({ key: 'Backspace' }), { kind: 'backspace' });
  assert.deepEqual(pinKeyAction({ key: 'Enter' }), { kind: 'enter' });
});
test('other keys are ignored', () => {
  for (const k of ['a', 'Tab', 'Escape', ' ', '10', 'ArrowLeft', 'Delete']) assert.equal(pinKeyAction({ key: k }), null);
});
test('shortcuts are ignored', () => {
  assert.equal(pinKeyAction({ key: '1', ctrlKey: true }), null);
  assert.equal(pinKeyAction({ key: '1', metaKey: true }), null);
  assert.equal(pinKeyAction({ key: 'Backspace', altKey: true }), null);
});
test('auto-repeat is ignored', () => assert.equal(pinKeyAction({ key: '5', repeat: true }), null));
test('text fields and editable targets are ignored', () => {
  assert.equal(pinKeyAction({ key: '5', targetTag: 'INPUT' }), null);
  assert.equal(pinKeyAction({ key: 'Backspace', targetTag: 'textarea' }), null);
  assert.equal(pinKeyAction({ key: '5', targetTag: 'SELECT' }), null);
  assert.equal(pinKeyAction({ key: '5', targetTag: 'DIV', targetEditable: true }), null);
});
test('a button or the page body still accepts keys', () => {
  assert.deepEqual(pinKeyAction({ key: '5', targetTag: 'BUTTON' }), { kind: 'digit', digit: '5' });
  assert.deepEqual(pinKeyAction({ key: '5', targetTag: 'BODY' }), { kind: 'digit', digit: '5' });
});

console.log(`${n} checks passed`);
