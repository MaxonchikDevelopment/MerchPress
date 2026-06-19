import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { unlockAudio } from '../lib/notify';
import { getLastUser, setLastUser } from '../lib/lastUser';
import { DEV_LOGIN } from '../lib/devAuth';
import { useSession } from '../context/SessionContext';
import { PinPad } from './PinPad';
import { SectionLabel } from './ui/SectionLabel';
import { EmptyState } from './ui/EmptyState';
import type { Staff, UserRole } from '../types/db';

const ROLE_LABELS: Record<UserRole, string> = {
  cashier: 'Cashier',
  press: 'Press',
  admin: 'Admin',
};

const ROLE_HINTS: Record<UserRole, string> = {
  cashier: 'Take orders at a booth station',
  press: 'Print queue for the press tablet',
  admin: 'Events, designs and stats',
};

// Login screen: pick role → pick name → enter 4-digit PIN.
export function RoleSelect() {
  const { login, activeEvent } = useSession();
  const [staff, setStaff] = useState<Staff[]>([]);
  const [role, setRole] = useState<UserRole | null>(null);
  const [picked, setPicked] = useState<Staff | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const lastUser = useMemo(() => getLastUser(), []);

  useEffect(() => {
    void supabase
      .from('staff_v')
      .select('*')
      .order('name')
      .then(({ data }) => setStaff((data as Staff[]) ?? []));
  }, []);

  const peopleForRole = useMemo(
    () => staff.filter((s) => s.role === role),
    [staff, role],
  );

  const handlePin = async (pin: string) => {
    if (!picked) return;
    setBusy(true);
    setError(null);
    const { data, error: rpcErr } = await supabase.rpc('verify_pin', {
      p_user_id: picked.id,
      p_pin: pin,
    });
    setBusy(false);
    // verify_pin returns the user row (or a null row) — data is null/object.
    if (rpcErr || !data || !(data as Staff).id) {
      setError('Wrong PIN');
      return;
    }
    unlockAudio(); // first user gesture: enable sound on this tablet
    setLastUser(picked); // remember for "Continue as" next time
    login(picked);
  };

  // Dev-only: skip PIN. Gated by import.meta.env.DEV — absent from prod build.
  const devLogin = (u: Staff) => {
    unlockAudio(); // keep notification audio functional (called from the click)
    setLastUser(u);
    login(u);
  };

  return (
    <div className="app">
      <header className="topbar">
        <div>
          <h1>MerchPress Queue</h1>
          <div className="sub">{activeEvent ? activeEvent.name : 'No active event'}</div>
        </div>
      </header>

      <div className="content page-enter" style={{ maxWidth: 640, margin: '0 auto', width: '100%' }}>
        {!role && (
          <div className="grid" style={{ gap: 'var(--sp-5)' }}>
            {lastUser && (
              <div>
                <SectionLabel>Quick start</SectionLabel>
                <button
                  className="btn btn-lg btn-primary"
                  onClick={() => { setRole(lastUser.role); setPicked(lastUser); setError(null); }}
                >
                  Continue as {lastUser.name} · {ROLE_LABELS[lastUser.role]}
                </button>
              </div>
            )}

            <div>
              <SectionLabel>Select your station</SectionLabel>
              <div className="grid" style={{ gridTemplateColumns: '1fr' }}>
                {(['cashier', 'press', 'admin'] as UserRole[]).map((r) => (
                  <button key={r} className="btn btn-lg" onClick={() => setRole(r)} style={{ flexDirection: 'column', gap: 4, padding: 'var(--sp-4)' }}>
                    <span>{ROLE_LABELS[r]}</span>
                    <span className="muted" style={{ fontSize: 13, fontWeight: 500 }}>{ROLE_HINTS[r]}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {role && !picked && (
          <>
            <div className="row" style={{ marginBottom: 'var(--sp-4)' }}>
              <button className="btn" onClick={() => setRole(null)}>← Back</button>
              <SectionLabel style={{ margin: 0 }}>Who are you? · {ROLE_LABELS[role]}</SectionLabel>
            </div>
            <div className="grid stagger" style={{ gridTemplateColumns: '1fr 1fr' }}>
              {peopleForRole.map((p, i) => (
                <button
                  key={p.id}
                  className="btn btn-lg"
                  style={{ ['--i' as string]: i }}
                  onClick={() => { setPicked(p); setError(null); }}
                >
                  {p.name}
                </button>
              ))}
            </div>
            {peopleForRole.length === 0 && <EmptyState>No staff for this role yet.</EmptyState>}
          </>
        )}

        {picked && (
          <>
            <div className="row" style={{ marginBottom: 'var(--sp-4)' }}>
              <button className="btn" onClick={() => { setPicked(null); setError(null); }}>← Back</button>
              <SectionLabel style={{ margin: 0 }}>Enter PIN · {picked.name}</SectionLabel>
            </div>
            <PinPad onSubmit={handlePin} error={error} busy={busy} />
            {DEV_LOGIN && (
              <div style={{ maxWidth: 300, margin: '20px auto 0', textAlign: 'center' }}>
                <button className="btn btn-secondary" style={{ width: '100%' }} onClick={() => devLogin(picked)}>
                  🛠 Dev login (skip PIN)
                </button>
                <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
                  Development build only — not present in production.
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
