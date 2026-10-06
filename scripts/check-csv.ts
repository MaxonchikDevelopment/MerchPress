// Run with: node scripts/check-csv.ts
import assert from 'node:assert/strict';
import { toCsv } from '../src/lib/csv.ts';

let n = 0;
const test = (name: string, fn: () => void) => {
  fn();
  n++;
  console.log(`ok - ${name}`);
};

const cols = [
  { key: 'a', header: 'A' },
  { key: 'b', header: 'B' },
];

test('semicolon separator', () =>
  assert.equal(toCsv([{ a: 1, b: 'x' }], cols, ';'), 'A;B\n1;x'));
test('field with separator is quoted', () =>
  assert.equal(toCsv([{ a: 'x;y', b: 'z' }], cols, ';'), 'A;B\n"x;y";z'));
test('quote inside a name is doubled', () =>
  assert.equal(toCsv([{ a: 'Big "Boss"', b: 'z' }], cols, ';'), 'A;B\n"Big ""Boss""";z'));
test('newline is quoted', () =>
  assert.equal(toCsv([{ a: 'x\ny', b: 'z' }], cols, ';'), 'A;B\n"x\ny";z'));
test('comma is not quoted with a semicolon', () =>
  assert.equal(toCsv([{ a: 'x,y', b: null }], cols, ';'), 'A;B\nx,y;'));
test('default separator stays a comma', () =>
  assert.equal(toCsv([{ a: 'x,y', b: 'z' }], cols), 'A,B\n"x,y",z'));

console.log(`${n} checks passed`);
