import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { useSession } from '../context/SessionContext';
import { SoundRetryButton } from './SoundGate';
import { alertNewOrder, alertReady, unlockAudio } from '../lib/notify';
import { getWakeLockState, retryWakeLock, subscribeWakeLockState } from '../hooks/useWakeLock';

// Compact app bar. Title and event on the left (one line each), actions on the right:
// icon buttons on phones, icon plus label from 900 px. Sign out lives in the user menu.
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
  const [hint, setHint] = useState<string | null>(null);
  const hintTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(hintTimer.current), []);

  const showHint = (message: string) => {
    setHint(message);
    clearTimeout(hintTimer.current);
    hintTimer.current = setTimeout(() => setHint(null), 4000);
  };

  return (
    <header className="topbar">
      <div className="topbar-title">
        <h1>{title}</h1>
        <div className="sub">{activeEvent ? activeEvent.name : 'No active event'}</div>
      </div>
      {children && <nav className="topbar-nav" aria-label="Sections">{children}</nav>}
      <div className="topbar-actions">
        {soundRetry && <SoundRetryButton />}
        {soundRetry && user && (
          <button
            className="btn btn-bar"
            aria-label="Test sound"
            onClick={() => {
              unlockAudio();
              // Play what this person will hear: Press gets new orders, Cashier gets ready.
              if (user.role === 'press') alertNewOrder();
              else alertReady();
            }}
          >
            <span aria-hidden="true">🔔</span>
            <span className="lbl">Test sound</span>
          </button>
        )}
        {soundRetry && user && (wakeState === 'released' || wakeState === 'unsupported') && (
          <button
            className="btn btn-bar"
            aria-label={wakeState === 'unsupported' ? 'Screen may sleep. Set Auto-Lock to Never.' : 'Screen may sleep. Tap to retry.'}
            onClick={() => {
              retryWakeLock();
              showHint(
                wakeState === 'unsupported'
                  ? 'This browser cannot keep the screen on. Set Auto-Lock to Never.'
                  : 'The screen is not being kept awake. Retrying…',
              );
            }}
          >
            <span aria-hidden="true">💤</span>
            <span className="lbl">{wakeState === 'unsupported' ? 'Set Auto-Lock to Never' : 'Screen may sleep'}</span>
          </button>
        )}
        <UserMenu name={user?.name} onLogout={logout} />
      </div>
      {hint && <div className="topbar-toast" role="status" aria-live="polite">{hint}</div>}
    </header>
  );
}

// User chip that opens a small menu with Sign out. Closes on outside tap and Escape.
function UserMenu({ name, onLogout }: { name?: string; onLogout: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="user-menu" ref={ref}>
      <button
        className="btn btn-bar user-chip"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={name ? `Account menu, signed in as ${name}` : 'Account menu'}
        onClick={() => setOpen((o) => !o)}
      >
        <span aria-hidden="true">👤</span>
        <span className="user-chip-name">{name ?? 'Account'}</span>
      </button>
      {open && (
        <div className="user-menu-pop" role="menu">
          {name && <div className="user-menu-who">Signed in as {name}</div>}
          <button className="btn user-menu-item" role="menuitem" onClick={onLogout}>
            Sign out
          </button>
        </div>
      )}
    </div>
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
