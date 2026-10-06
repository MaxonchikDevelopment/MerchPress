// Run with: node scripts/check-offline-banner.ts
import assert from 'node:assert/strict';
import { offlineBannerVisible, OFFLINE_GRACE_MS } from '../src/lib/offlineBanner.ts';

let n = 0;
const test = (name: string, fn: () => void) => {
  fn();
  n++;
  console.log(`ok - ${name}`);
};

test('connected: no banner', () => {
  assert.equal(offlineBannerVisible(true, true, true), false);
  assert.equal(offlineBannerVisible(true, false, false), false);
});
test('not connected, never connected, inside grace (startup): no banner', () =>
  assert.equal(offlineBannerVisible(false, false, false), false));
test('not connected, never connected, grace elapsed (cannot connect): banner', () =>
  assert.equal(offlineBannerVisible(false, false, true), true));
test('not connected, was connected before: banner at once', () => {
  assert.equal(offlineBannerVisible(false, true, false), true);
  assert.equal(offlineBannerVisible(false, true, true), true);
});
test('grace is 3 s', () => assert.equal(OFFLINE_GRACE_MS, 3000));

console.log(`${n} checks passed`);
