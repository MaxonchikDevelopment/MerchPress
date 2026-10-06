// At app start the realtime socket needs a moment to subscribe, and the first fetch
// usually lands before it does. So "not connected" alone is not worth an alarm: wait for
// the first connection, or for the grace to pass (it cannot connect). After a first
// connection, losing it shows the banner at once.
export const OFFLINE_GRACE_MS = 3000;

export function offlineBannerVisible(connected: boolean, everConnected: boolean, graceElapsed: boolean): boolean {
  return !connected && (everConnected || graceElapsed);
}
