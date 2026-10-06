// Run with: node scripts/check-stats-tally.ts
import assert from 'node:assert/strict';
import { distinctDesignTally, byDay } from '../src/lib/statsTally.ts';

let n = 0;
const test = (name: string, fn: () => void) => {
  fn();
  n++;
  console.log(`ok - ${name}`);
};

const names = new Map([['a', 'Alpha'], ['b', 'Beta']]);
const o = (f: string | null, b: string | null) => ({ design_front_id: f, design_back_id: b });

test('bundle counts once', () =>
  assert.deepEqual(distinctDesignTally([o('a', 'a')], names), [['Alpha', 1]]));
test('custom with two designs counts each once', () =>
  assert.deepEqual(distinctDesignTally([o('a', 'b')], names), [['Alpha', 1], ['Beta', 1]]));
test('single side counts once', () =>
  assert.deepEqual(distinctDesignTally([o('a', null)], names), [['Alpha', 1]]));
test('no print counts nothing', () =>
  assert.deepEqual(distinctDesignTally([o(null, null)], names), []));
test('mixed orders, sorted by count', () =>
  assert.deepEqual(distinctDesignTally([o('a', 'a'), o('a', 'b'), o('b', null)], names), [
    ['Alpha', 2],
    ['Beta', 2],
  ]));
test('unknown id is skipped', () =>
  assert.deepEqual(distinctDesignTally([o('zzz', 'a')], names), [['Alpha', 1]]));
test('by day groups across Warsaw midnight, ascending', () =>
  assert.deepEqual(
    byDay([
      { created_at: '2026-10-11T10:00:00Z' },
      { created_at: '2026-10-10T21:59:00Z' }, // 23:59 Warsaw, 10th
      { created_at: '2026-10-10T22:00:00Z' }, // 00:00 Warsaw, 11th
      { created_at: '2026-10-09T08:00:00Z' },
    ]),
    [['2026-10-09', 1], ['2026-10-10', 1], ['2026-10-11', 2]],
  ));
test('by day empty', () => assert.deepEqual(byDay([]), []));

console.log(`${n} checks passed`);
