// Grace at app start: the realtime socket needs a moment to subscribe, so "not
// connected" alone is not worth an alarm. A failed first fetch still shows the banner
// once the grace has passed.
export const OFFLINE_GRACE_MS = 3000;

export function offlineBannerVisible(connected: boolean, loaded: boolean, graceElapsed: boolean): boolean {
  return !connected && (loaded || graceElapsed);
}
