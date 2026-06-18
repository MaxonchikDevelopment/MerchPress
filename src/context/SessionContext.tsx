import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { supabase } from '../lib/supabase';
import type { EventRow, Staff } from '../types/db';

const STORAGE_KEY = 'mpq.session';

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

  const reloadActiveEvent = useCallback(async () => {
    setLoadingEvent(true);
    const { data } = await supabase
      .from('events')
      .select('*')
      .eq('is_active', true)
      .maybeSingle();
    setActiveEvent((data as EventRow) ?? null);
    setLoadingEvent(false);
  }, []);

  useEffect(() => {
    void reloadActiveEvent();
  }, [reloadActiveEvent]);

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
