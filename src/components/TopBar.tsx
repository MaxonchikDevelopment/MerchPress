import type { ReactNode } from 'react';
import { useSession } from '../context/SessionContext';

export function TopBar({ title, children }: { title: string; children?: ReactNode }) {
  const { user, activeEvent, logout } = useSession();
  return (
    <header className="topbar">
      <div>
        <h1>{title}</h1>
        <div className="sub">{activeEvent ? activeEvent.name : 'No active event'}</div>
      </div>
      <div className="row">
        {children && <nav className="topbar-nav" aria-label="Sections">{children}</nav>}
        {user?.name && (
          <span className="pill" title={`Signed in as ${user.name}`}>
            <span aria-hidden="true">👤</span> {user.name}
          </span>
        )}
        <button className="btn" onClick={logout} aria-label="Sign out">Exit</button>
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
