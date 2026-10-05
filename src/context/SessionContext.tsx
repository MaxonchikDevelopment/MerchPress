import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { supabase } from '../lib/supabase';
import type { EventRow, Staff } from '../types/db';

const STORAGE_KEY = 'mpq.session';
const EVENT_POLL_MS = 20_000;

interface SessionState {
  user: Staff | null;
  activeEvent: EventRow | null;
  loadingEvent: boolean;
  login: (user: Staff) => void;
  logout: () => void;
  reloadActiveEvent: () => Promise<void>;
}

const SessionContext = createContext<SessionState | null>(null);

function loadStoredUser(): Staff | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Staff) : null;
  } catch {
    return null;
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Staff | null>(loadStoredUser);
  const [activeEvent, setActiveEvent] = useState<EventRow | null>(null);
  const [loadingEvent, setLoadingEvent] = useState(true);

  const eventSeq = useRef(0); // issued request ids
  const eventApplied = useRef(0); // highest request id already applied

  // Fetches the active event. On error the current event is kept. `silent`
  // never touches loadingEvent: App unmounts the page while it is true.
  const fetchActiveEvent = useCallback(async (silent: boolean) => {
    if (!silent) setLoadingEvent(true);
    const seq = ++eventSeq.current;
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('is_active', true)
      .maybeSingle();
    if (seq >= eventApplied.current && !error) {
      eventApplied.current = seq;
      const next = (data as EventRow | null) ?? null;
      // Keep the same object when nothing changed so pages don't re-render.
      setActiveEvent((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
    }
    if (!silent) setLoadingEvent(false);
  }, []);

  const reloadActiveEvent = useCallback(() => fetchActiveEvent(false), [fetchActiveEvent]);

  useEffect(() => {
    void reloadActiveEvent();
  }, [reloadActiveEvent]);

  // Silent refresh so a tablet that slept or lost Wi-Fi notices an event switch.
  const signedIn = user !== null;
  useEffect(() => {
    if (!signedIn) return;
    const refresh = () => {
      if (document.visibilityState === 'visible') void fetchActiveEvent(true);
    };
    const timer = setInterval(refresh, EVENT_POLL_MS);
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('online', refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('online', refresh);
    };
  }, [signedIn, fetchActiveEvent]);

  const login = useCallback((u: Staff) => {
    setUser(u);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const value = useMemo<SessionState>(
    () => ({ user, activeEvent, loadingEvent, login, logout, reloadActiveEvent }),
    [user, activeEvent, loadingEvent, login, logout, reloadActiveEvent],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSession(): SessionState {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within SessionProvider');
  return ctx;
}
