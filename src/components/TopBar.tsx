import type { ReactNode } from 'react';
import { useSession } from '../context/SessionContext';

export function TopBar({ title, children }: { title: string; children?: ReactNode }) {
  const { user, activeEvent, logout } = useSession();
  return (
    <div className="topbar">
      <div>
        <h1>{title}</h1>
        <div className="sub">{activeEvent ? activeEvent.name : 'No active event'}</div>
      </div>
      <div className="row">
        {children}
        <span className="pill">{user?.name}</span>
        <button className="btn" onClick={logout}>Exit</button>
      </div>
    </div>
  );
}

// Red banner shown when the realtime connection is down.
export function OfflineBanner({ connected }: { connected: boolean }) {
  if (connected) return null;
  return <div className="banner banner-offline">⚠ Reconnecting… orders may be delayed</div>;
}
