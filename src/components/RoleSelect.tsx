import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { unlockAudio } from '../lib/notify';
import { useSession } from '../context/SessionContext';
import { PinPad } from './PinPad';
import type { Staff, UserRole } from '../types/db';

const ROLE_LABELS: Record<UserRole, string> = {
  cashier: 'Cashier',
  press: 'Press',
  admin: 'Admin',
};

// Login screen: pick role → pick name → enter 4-digit PIN.
export function RoleSelect() {
  const { login, activeEvent } = useSession();
  const [staff, setStaff] = useState<Staff[]>([]);
  const [role, setRole] = useState<UserRole | null>(null);
  const [picked, setPicked] = useState<Staff | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
    login(picked);
  };

  return (
    <div className="app">
      <div className="topbar">
        <div>
          <h1>MerchPress Queue</h1>
          <div className="sub">{activeEvent ? activeEvent.name : 'No active event'}</div>
        </div>
      </div>

      <div className="content" style={{ maxWidth: 640, margin: '0 auto', width: '100%' }}>
        {!role && (
          <>
            <div className="label">Select your station</div>
            <div className="grid" style={{ gridTemplateColumns: '1fr' }}>
              {(['cashier', 'press', 'admin'] as UserRole[]).map((r) => (
                <button key={r} className="btn btn-lg btn-primary" onClick={() => setRole(r)}>
                  {ROLE_LABELS[r]}
                </button>
              ))}
            </div>
          </>
        )}

        {role && !picked && (
          <>
            <div className="row" style={{ marginBottom: 12 }}>
              <button className="btn" onClick={() => setRole(null)}>← Back</button>
              <div className="label" style={{ margin: 0 }}>Who are you? ({ROLE_LABELS[role]})</div>
            </div>
            <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
              {peopleForRole.map((p) => (
                <button key={p.id} className="btn btn-lg" onClick={() => { setPicked(p); setError(null); }}>
                  {p.name}
                </button>
              ))}
              {peopleForRole.length === 0 && <div className="muted">No staff for this role yet.</div>}
            </div>
          </>
        )}

        {picked && (
          <>
            <div className="row" style={{ marginBottom: 12 }}>
              <button className="btn" onClick={() => { setPicked(null); setError(null); }}>← Back</button>
              <div className="label" style={{ margin: 0 }}>Enter PIN — {picked.name}</div>
            </div>
            <PinPad onSubmit={handlePin} error={error} busy={busy} />
          </>
        )}
      </div>
    </div>
  );
}
