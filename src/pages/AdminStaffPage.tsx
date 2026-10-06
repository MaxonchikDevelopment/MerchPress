import { useCallback, useEffect, useState } from 'react';
import { useSession } from '../context/SessionContext';
import { clearAdminPin, getAdminPin, setAdminPin } from '../lib/adminPin';
import {
  staffCreate,
  staffList,
  staffSetPin,
  staffUpdate,
  type StaffResult,
} from '../lib/staffApi';
import { PinPad } from '../components/PinPad';
import { SectionLabel } from '../components/ui/SectionLabel';
import { EmptyState } from '../components/ui/EmptyState';
import { Spinner } from '../components/ui/Spinner';
import { Toast } from '../components/ui/Toast';
import { ConfirmDialog } from '../components/ConfirmDialog';
import type { Staff, UserRole } from '../types/db';

const ROLES: UserRole[] = ['cashier', 'press', 'admin'];
const ROLE_LABELS: Record<UserRole, string> = { cashier: 'Cashier', press: 'Press', admin: 'Admin' };
const defaultPin = (role: UserRole) => (role === 'admin' ? '' : '0000');
const digitsOnly = (v: string) => v.replace(/\D/g, '').slice(0, 4);

export function AdminStaffPage() {
  const { user } = useSession();
  const adminId = user?.id ?? null;
  const [needPin, setNeedPin] = useState(() => getAdminPin() === null);
  const [pinError, setPinError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [staff, setStaff] = useState<Staff[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Outcome of any staff_* call: not_admin drops the cached PIN and asks again.
  const handleFailure = useCallback((res: Extract<StaffResult<unknown>, { ok: false }>) => {
    if (res.code === 'not_admin') {
      clearAdminPin();
      setPinError('Admin PIN not accepted. Try again.');
      setNeedPin(true);
    } else {
      setError(res.message);
    }
  }, []);

  const load = useCallback(async () => {
    const pin = getAdminPin();
    if (!adminId || !pin) return;
    const res = await staffList(adminId, pin);
    if (!res.ok) return handleFailure(res);
    setStaff(res.data);
    setError(null);
  }, [adminId, handleFailure]);

  useEffect(() => {
    if (!needPin) void load();
  }, [needPin, load]);

  // First entry after a reload: validate the typed PIN with staff_list.
  const submitPin = async (pin: string) => {
    if (!adminId) return;
    setChecking(true);
    setPinError(null);
    const res = await staffList(adminId, pin);
    setChecking(false);
    if (!res.ok) {
      if (res.code === 'not_admin') setPinError('Admin PIN not accepted. Try again.');
      else setPinError(res.message);
      return;
    }
    setAdminPin(pin);
    setStaff(res.data);
    setError(null);
    setNeedPin(false);
  };

  // Run one staff mutation with the cached PIN, then refresh the list.
  // `onSuccess` runs before the refresh, so a changed own PIN is cached first.
  const act = async (
    run: (adminId: string, pin: string) => Promise<StaffResult<unknown>>,
    onSuccess?: () => void,
  ) => {
    const pin = getAdminPin();
    if (!adminId || !pin) {
      setNeedPin(true);
      return false;
    }
    setError(null);
    const res = await run(adminId, pin);
    if (!res.ok) {
      handleFailure(res);
      return false;
    }
    onSuccess?.();
    await load();
    return true;
  };

  if (needPin) {
    return (
      <div className="grid" style={{ gap: 'var(--sp-4)' }}>
        <SectionLabel style={{ textAlign: 'center' }}>Enter admin PIN to manage staff</SectionLabel>
        <PinPad onSubmit={submitPin} error={pinError} busy={checking} />
      </div>
    );
  }

  return (
    <div className="grid" style={{ gap: 'var(--sp-5)' }}>
      {error && <Toast message={error} tone="error" />}
      <AddPerson onCreate={(name, role, pin) => act((id, ap) => staffCreate(id, ap, name, role, pin))} />

      <section>
        <SectionLabel>Staff · {staff?.length ?? 0}</SectionLabel>
        <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 1fr)' }}>
          {staff === null && <EmptyState><Spinner /> Loading…</EmptyState>}
          {staff?.map((p) => (
            <PersonRow
              key={p.id}
              person={p}
              isSelf={p.id === adminId}
              onUpdate={(name, role, active) =>
                act((id, ap) => staffUpdate(id, ap, p.id, name, role, active))
              }
              onSetPin={(newPin) =>
                act(
                  (id, ap) => staffSetPin(id, ap, p.id, newPin),
                  () => {
                    if (p.id === adminId) setAdminPin(newPin); // keep the cache in step
                  },
                )
              }
            />
          ))}
          {staff?.length === 0 && <EmptyState>No staff yet.</EmptyState>}
        </div>
      </section>
    </div>
  );
}

function AddPerson({ onCreate }: { onCreate: (name: string, role: UserRole, pin: string) => Promise<boolean> }) {
  const [name, setName] = useState('');
  const [role, setRole] = useState<UserRole>('cashier');
  const [pin, setPin] = useState(defaultPin('cashier'));
  const [busy, setBusy] = useState(false);

  const changeRole = (next: UserRole) => {
    // Swap the prefill only if the PIN is still untouched.
    if (pin === defaultPin(role)) setPin(defaultPin(next));
    setRole(next);
  };

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    const ok = await onCreate(name, role, pin);
    setBusy(false);
    if (ok) {
      setName('');
      setRole('cashier');
      setPin(defaultPin('cashier'));
    }
  };

  return (
    <section className="card grid">
      <h2 style={{ margin: 0 }}>Add person</h2>
      <div>
        <SectionLabel>Name</SectionLabel>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Anna" autoComplete="off" style={{ width: '100%' }} />
      </div>
      <div>
        <SectionLabel>Role</SectionLabel>
        <select value={role} onChange={(e) => changeRole(e.target.value as UserRole)} style={{ width: '100%' }}>
          {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
        </select>
      </div>
      <div>
        <SectionLabel>PIN (4 digits)</SectionLabel>
        <input
          value={pin}
          onChange={(e) => setPin(digitsOnly(e.target.value))}
          inputMode="numeric"
          autoComplete="off"
          aria-label="PIN"
          style={{ width: '100%' }}
        />
      </div>
      <button className="btn btn-primary" onClick={submit} disabled={busy || !name.trim() || pin.length !== 4}>
        {busy ? <><Spinner /> Adding…</> : 'Add person'}
      </button>
    </section>
  );
}

type Mode = 'view' | 'edit' | 'pin';

function PersonRow({
  person,
  isSelf,
  onUpdate,
  onSetPin,
}: {
  person: Staff;
  isSelf: boolean;
  onUpdate: (name: string, role: UserRole, active: boolean) => Promise<boolean>;
  onSetPin: (pin: string) => Promise<boolean>;
}) {
  const [mode, setMode] = useState<Mode>('view');
  const [name, setName] = useState(person.name);
  const [role, setRole] = useState<UserRole>(person.role);
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const run = async (fn: () => Promise<boolean>) => {
    if (busy) return;
    setBusy(true);
    const ok = await fn();
    setBusy(false);
    if (ok) setMode('view');
  };

  return (
    <div className="card grid" style={{ gap: 'var(--sp-3)', opacity: person.is_active ? 1 : 0.7 }}>
      <div className="row">
        <div style={{ fontSize: 18, fontWeight: 800 }}>{person.name}</div>
        <span className="pill">{ROLE_LABELS[person.role]}</span>
        {!person.is_active && <span className="pill">Inactive</span>}
        {isSelf && <span className="pill">You</span>}
        <div className="spacer" />
        {mode === 'view' && (
          <>
            <button className="btn" onClick={() => { setName(person.name); setRole(person.role); setMode('edit'); }}>Edit</button>
            <button className="btn" onClick={() => { setPin(''); setMode('pin'); }}>Set PIN</button>
            <button
              className="btn btn-secondary"
              // Deactivating yourself would lock you out of this tab.
              disabled={busy || (isSelf && person.is_active)}
              onClick={() => {
                if (person.is_active) setConfirming(true);
                else void run(() => onUpdate(person.name, person.role, true));
              }}
            >
              {person.is_active ? 'Deactivate' : 'Activate'}
            </button>
          </>
        )}
      </div>

      {mode === 'edit' && (
        <div className="grid">
          <input value={name} onChange={(e) => setName(e.target.value)} aria-label="Name" style={{ width: '100%' }} />
          <select value={role} onChange={(e) => setRole(e.target.value as UserRole)} aria-label="Role" disabled={isSelf} style={{ width: '100%' }}>
            {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
          </select>
          <div className="row">
            <button className="btn btn-primary" disabled={busy || !name.trim()} onClick={() => run(() => onUpdate(name, role, person.is_active))}>
              {busy ? <><Spinner /> Saving…</> : 'Save'}
            </button>
            <button className="btn" disabled={busy} onClick={() => setMode('view')}>Cancel</button>
          </div>
        </div>
      )}

      {mode === 'pin' && (
        <div className="grid">
          <input
            value={pin}
            onChange={(e) => setPin(digitsOnly(e.target.value))}
            inputMode="numeric"
            autoComplete="off"
            placeholder="New 4-digit PIN"
            aria-label="New PIN"
            style={{ width: '100%' }}
          />
          <div className="row">
            <button className="btn btn-primary" disabled={busy || pin.length !== 4} onClick={() => run(() => onSetPin(pin))}>
              {busy ? <><Spinner /> Saving…</> : 'Set PIN'}
            </button>
            <button className="btn" disabled={busy} onClick={() => setMode('view')}>Cancel</button>
          </div>
        </div>
      )}
      {confirming && (
        <ConfirmDialog
          title={`Deactivate ${person.name}? They will be signed out within about 30 seconds.`}
          confirmLabel="Deactivate"
          cancelLabel="Cancel"
          onConfirm={() => {
            setConfirming(false);
            void run(() => onUpdate(person.name, person.role, false));
          }}
          onCancel={() => setConfirming(false)}
        />
      )}
    </div>
  );
}
