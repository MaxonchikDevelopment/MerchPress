// Run with: node scripts/check-update-policy.ts
import assert from 'node:assert/strict';
import { updateAction, reloadGuard, MIN_UPTIME_MS, type GuardInput } from '../src/lib/updatePolicy.ts';
import { acquireBusy, busyReasons, subscribeBusy } from '../src/lib/appBusy.ts';

let n = 0;
const check = (name: string, actual: unknown, expected: unknown) => {
  assert.deepEqual(actual, expected, name);
  n++;
  console.log(`ok ${n} ${name}`);
};

check('no update waits', updateAction({ updateReady: false, busyReasons: [] }), 'wait');
check('no update and busy still waits', updateAction({ updateReady: false, busyReasons: ['draft'] }), 'wait');
check('update and idle applies', updateAction({ updateReady: true, busyReasons: [] }), 'apply');
for (const r of ['draft', 'sending', 'alert', 'confirm', 'pin', 'status']) {
  check(`update and ${r} shows the banner`, updateAction({ updateReady: true, busyReasons: [r] }), 'banner');
}
check('several reasons show the banner', updateAction({ updateReady: true, busyReasons: ['draft', 'alert'] }), 'banner');

const ok: GuardInput = { online: true, sinceLoadMs: MIN_UPTIME_MS, buildId: 'bbb2222', reloadedFromBuild: null, appliedThisLoad: false };
check('guard open', reloadGuard(ok), null);
check('offline blocks', reloadGuard({ ...ok, online: false }), 'offline');
check('first 10 s block', reloadGuard({ ...ok, sinceLoadMs: MIN_UPTIME_MS - 1 }), 'too-early');
check('exactly 10 s allowed', reloadGuard({ ...ok, sinceLoadMs: MIN_UPTIME_MS }), null);
check('second apply in one page load blocked', reloadGuard({ ...ok, appliedThisLoad: true }), 'already-applied');
check('reloaded from this same build blocked', reloadGuard({ ...ok, reloadedFromBuild: 'bbb2222' }), 'no-progress');
check('reloaded from an older build allowed', reloadGuard({ ...ok, reloadedFromBuild: 'aaa1111' }), null);

check('registry starts empty', busyReasons(), []);
let calls = 0;
const off = subscribeBusy(() => calls++);
const r1 = acquireBusy('confirm');
const r2 = acquireBusy('confirm');
check('reason listed once', busyReasons(), ['confirm']);
r1();
check('second holder keeps it busy', busyReasons(), ['confirm']);
r1();
check('double release does nothing', busyReasons(), ['confirm']);
r2();
check('last release clears', busyReasons(), []);
const d = acquireBusy('draft');
const p = acquireBusy('pin');
check('different reasons are separate', busyReasons().sort(), ['draft', 'pin']);
d();
p();
check('listener called on every change', calls, 8);
off();
acquireBusy('alert')();
check('unsubscribed listener not called', calls, 8);
console.log(`all ${n} checks passed`);
