import { useSyncExternalStore } from 'react';
import { reloadNow, subscribeUpdateBanner, updateBannerVisible } from '../lib/appUpdate';

// Shown only while a new version is ready but the app is busy. Never blocks the screen.
export function UpdateBanner() {
  const visible = useSyncExternalStore(subscribeUpdateBanner, updateBannerVisible);
  if (!visible) return null;
  return (
    <button type="button" className="update-banner" onClick={reloadNow}>
      New version ready, tap to reload
    </button>
  );
}
