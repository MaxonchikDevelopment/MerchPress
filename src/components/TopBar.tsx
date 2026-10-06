import { useSyncExternalStore, type ReactNode } from 'react';
import { useSession } from '../context/SessionContext';
import { SoundRetryButton } from './SoundGate';
import { getWakeLockState, retryWakeLock, subscribeWakeLockState } from '../hooks/useWakeLock';

export function TopBar({
  title,
  children,
  soundRetry,
}: {
  title: string;
  children?: ReactNode;
  soundRetry?: boolean; // Press and Cashier: show the retry button when audio is locked
}) {
  const { user, activeEvent, logout } = useSession();
  const wakeState = useSyncExternalStore(subscribeWakeLockState, getWakeLockState);
  return (
    <header className="topbar">
      <div>
        <h1>{title}</h1>
        <div className="sub">{activeEvent ? activeEvent.name : 'No active event'}</div>
      </div>
      <div className="row">
        {soundRetry && <SoundRetryButton />}
        {user && wakeState !== 'held' && (
          <button className="pill" onClick={retryWakeLock} style={{ cursor: 'pointer', color: 'inherit', fontFamily: 'inherit' }} title="The screen is not being kept awake. Tap to retry.">
            <span aria-hidden="true">💤</span> Screen may sleep
          </button>
        )}
        {children && <nav className="topbar-nav" aria-label="Sections">{children}</nav>}
        {user?.name && (
          <span className="pill" title={`Signed in as ${user.name}`}>
            <span aria-hidden="true">👤</span> {user.name}
          </span>
        )}
        <button className="btn" onClick={logout} >Sign out</button>
      </div>
    </header>
  );
}

// Amber banner shown when the realtime connection is down — reads as "degraded".
export function OfflineBanner({ connected }: { connected: boolean }) {
  if (connected) return null;
  return (
    <div className="banner banner-offline" role="alert">
      ⚠ Reconnecting… orders may be delayed
    </div>
  );
}
