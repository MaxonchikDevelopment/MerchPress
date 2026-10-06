import { registerSW } from 'virtual:pwa-register';
import { busyReasons, subscribeBusy } from './appBusy';
import { MIN_UPTIME_MS, reloadGuard, updateAction } from './updatePolicy';

const POLL_MS = 60_000;
const SESSION_KEY = 'mpq.reloadedFrom';

const loadedAt = Date.now();
let updateReady = false;
let appliedThisLoad = false;
let bannerShown = false;
const listeners = new Set<() => void>();

const readReloadedFrom = (): string | null => {
  try {
    return sessionStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
};

const setBanner = (on: boolean) => {
  if (bannerShown === on) return;
  bannerShown = on;
  listeners.forEach((l) => l());
};

// The banner store, for useSyncExternalStore.
export const subscribeUpdateBanner = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
export const updateBannerVisible = () => bannerShown;

// Tap on the banner: the user chose it, so no guards.
export function reloadNow() {
  window.location.reload();
}

function evaluate() {
  const action = updateAction({ updateReady, busyReasons: busyReasons() });
  setBanner(action === 'banner');
  if (action !== 'apply') return;
  const guard = reloadGuard({
    online: navigator.onLine,
    sinceLoadMs: Date.now() - loadedAt,
    buildId: __BUILD_ID__,
    reloadedFromBuild: readReloadedFrom(),
    appliedThisLoad,
  });
  if (guard) return; // offline and too-early are re-checked by the online event and the 10 s timer
  appliedThisLoad = true;
  try {
    sessionStorage.setItem(SESSION_KEY, __BUILD_ID__);
  } catch {
    // appliedThisLoad still stops a loop inside this page load
  }
  window.location.reload();
}

// Registers the service worker, polls it for a new version and applies the update when the
// app is idle. Call once, outside React, so StrictMode cannot start it twice.
export function startAppUpdates() {
  let registration: ServiceWorkerRegistration | undefined;

  const check = () => {
    if (!registration || !navigator.onLine) return;
    registration.update().catch(() => {
      // network blip; the next tick tries again
    });
  };

  registerSW({
    immediate: true,
    // In autoUpdate mode the plugin would reload here by itself; this replaces that.
    onNeedReload() {
      updateReady = true;
      evaluate();
    },
    onRegisteredSW(_url, r) {
      registration = r;
    },
  });

  window.setInterval(() => {
    if (document.visibilityState === 'visible') check();
  }, POLL_MS);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      check();
      evaluate();
    }
  });
  window.addEventListener('online', () => {
    check();
    evaluate();
  });
  subscribeBusy(evaluate);
  window.setTimeout(evaluate, MIN_UPTIME_MS + 100);
}
