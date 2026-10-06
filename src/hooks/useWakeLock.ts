import { useEffect } from 'react';

// Keep the screen awake (press station may be unattended; a locked screen means
// no sound). Re-acquires when the tab becomes visible again and when the system
// releases the lock itself. No-op where unsupported.

// 'unsupported': no Wake Lock API. 'held': we own a live sentinel. 'released':
// supported but nothing held (never acquired, denied, or released by the system).
export type WakeLockState = 'unsupported' | 'held' | 'released';

const MAX_FAILURES = 3; // consecutive failed re-acquires before waiting for a visibilitychange or a tap
const MIN_HELD_MS = 10_000; // a lock that dies sooner than this counts as a failure

let wakeState: WakeLockState =
  typeof navigator !== 'undefined' && 'wakeLock' in navigator ? 'released' : 'unsupported';
const listeners = new Set<() => void>();
let retry: (() => void) | null = null;

function setWakeState(next: WakeLockState) {
  if (wakeState === next) return;
  wakeState = next;
  listeners.forEach((l) => l());
}

export const getWakeLockState = (): WakeLockState => wakeState;
export function subscribeWakeLockState(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}
// Called from a tap on the "Screen may sleep" pill.
export function retryWakeLock(): void {
  retry?.();
}

export function useWakeLock() {
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;
    let busy = false;
    let failures = 0;
    let heldAt = 0;

    // Resolves true when a lock is held afterwards.
    const acquire = async (): Promise<boolean> => {
      if (cancelled || busy || lock || !('wakeLock' in navigator) || document.visibilityState !== 'visible') {
        return !!lock;
      }
      busy = true;
      try {
        const sentinel = await navigator.wakeLock.request('screen');
        if (cancelled) {
          void sentinel.release().catch(() => {});
          return false;
        }
        lock = sentinel;
        heldAt = Date.now();
        sentinel.addEventListener('release', () => onRelease(sentinel));
        setWakeState('held');
        return true;
      } catch {
        /* denied / unsupported — fine */
        return false;
      } finally {
        busy = false;
      }
    };

    const onRelease = (sentinel: WakeLockSentinel) => {
      if (cancelled || sentinel !== lock) return;
      lock = null;
      setWakeState('released');
      if (Date.now() - heldAt >= MIN_HELD_MS) failures = 0;
      else failures += 1;
      // Hidden tab: the system released it, visibilitychange will re-acquire.
      if (document.visibilityState !== 'visible' || failures >= MAX_FAILURES) return;
      void acquire().then((ok) => {
        if (!ok) failures += 1;
      });
    };

    const onVisible = () => {
      if (document.visibilityState === 'visible' && !cancelled) {
        failures = 0;
        void acquire();
      }
    };

    retry = onVisible;
    void acquire();
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      if (retry === onVisible) retry = null;
      document.removeEventListener('visibilitychange', onVisible);
      const held = lock;
      lock = null;
      void held?.release().catch(() => {});
      if (wakeState === 'held') setWakeState('released');
    };
  }, []);
}
