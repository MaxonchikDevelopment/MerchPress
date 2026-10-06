// Run with: node scripts/check-build-id.ts
import assert from 'node:assert/strict';
import { buildId } from '../src/lib/buildId.ts';

let n = 0;
const check = (name: string, actual: string, expected: string) => {
  assert.equal(actual, expected, name);
  n++;
  console.log(`ok ${n} ${name}`);
};

check('env value present', buildId('abc1234', 'zzz9999'), 'abc1234');
check('env missing, git value present', buildId(undefined, 'def5678'), 'def5678');
check('env empty string falls back to git', buildId('', 'def5678'), 'def5678');
check('both missing gives dev', buildId(undefined, undefined), 'dev');
check('both blank gives dev', buildId('  ', '\n'), 'dev');
check('longer value cut to 7', buildId('5988366a1b2c3d4e5f', ''), '5988366');
check('git value cut to 7', buildId(undefined, '0123456789'), '0123456');
check('whitespace trimmed', buildId('  abc1234\n', undefined), 'abc1234');
check('trim happens before the cut', buildId('  abcdefghij ', undefined), 'abcdefg');
check('git newline trimmed', buildId(undefined, 'def5678\n'), 'def5678');
check('short value kept as is', buildId('abc', undefined), 'abc');
console.log(`all ${n} checks passed`);
