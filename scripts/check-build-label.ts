// Run with: node scripts/check-build-label.ts
import assert from 'node:assert/strict';
import { formatBuildLabel } from '../src/lib/buildLabel.ts';

let n = 0;
const check = (name: string, actual: string, expected: string) => {
  assert.equal(actual, expected, name);
  n++;
  console.log(`ok ${n} ${name}`);
};

check('baseline', formatBuildLabel('1.0.0', 'be207e4'), 'v1.0 · be207e4');
check('minor bump', formatBuildLabel('1.9.0', 'be207e4'), 'v1.9 · be207e4');
check('patch hidden', formatBuildLabel('1.9.3', 'be207e4'), 'v1.9 · be207e4');
check('major 2 for Poznan', formatBuildLabel('2.0.0', 'abc1234'), 'v2.0 · abc1234');
check('two-digit minor', formatBuildLabel('1.12.0', 'abc1234'), 'v1.12 · abc1234');
check('major.minor only', formatBuildLabel('1.2', 'abc1234'), 'v1.2 · abc1234');
check('prerelease suffix ignored', formatBuildLabel('1.3.0-beta.1', 'abc1234'), 'v1.3 · abc1234');
check('whitespace trimmed', formatBuildLabel(' 1.4.0\n', ' abc1234 '), 'v1.4 · abc1234');
check('missing version falls back to id', formatBuildLabel(undefined, 'abc1234'), 'abc1234');
check('null version falls back to id', formatBuildLabel(null, 'abc1234'), 'abc1234');
check('empty version falls back to id', formatBuildLabel('', 'abc1234'), 'abc1234');
check('invalid version falls back to id', formatBuildLabel('latest', 'abc1234'), 'abc1234');
check('single number is invalid', formatBuildLabel('1', 'abc1234'), 'abc1234');
check('dev id kept', formatBuildLabel('1.0.0', 'dev'), 'v1.0 · dev');
check('id is always in the label', formatBuildLabel('1.0.0', 'be207e4').includes('be207e4') ? 'y' : 'n', 'y');
check('no id, valid version', formatBuildLabel('1.0.0', ''), 'v1.0');
console.log(`all ${n} checks passed`);
