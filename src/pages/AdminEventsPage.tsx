import { useState } from 'react';
import { useEvents } from '../hooks/useEvents';
import { useSession } from '../context/SessionContext';
import { SectionLabel } from '../components/ui/SectionLabel';
import { EmptyState } from '../components/ui/EmptyState';
import { Spinner } from '../components/ui/Spinner';
import type { EventRow } from '../types/db';
import { Toast } from '../components/ui/Toast';
import { EventEditor } from '../components/EventEditor';

export function AdminEventsPage() {
  const { reloadActiveEvent, refreshActiveEvent } = useSession();
  const { events, createEvent, updateEvent, activateEvent } = useEvents();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [date, setDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [activating, setActivating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const create = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    await createEvent(name.trim(), location.trim(), date);
    setName('');
    setLocation('');
    setDate('');
    setBusy(false);
  };

  const activate = async (id: string) => {
    if (activating) return;
    setActivating(id);
    setError(await activateEvent(id));
    await reloadActiveEvent();
    setActivating(null);
  };

  // After saving the active event the session picks up the change without the full-screen reload.
  const save = async (e: EventRow, patch: Parameters<typeof updateEvent>[1]) => {
    const err = await updateEvent(e.id, patch);
    if (!err && e.is_active) await refreshActiveEvent();
    return err;
  };

  return (
    <div className="grid" style={{ gap: 'var(--sp-5)' }}>
      <section className="card grid">
        <h2 style={{ margin: 0 }}>New event</h2>
        <div>
          <SectionLabel>Event name</SectionLabel>
          <input placeholder="e.g. Hyrox Gdansk" value={name} onChange={(e) => setName(e.target.value)} style={{ width: '100%' }} />
        </div>
        <div>
          <SectionLabel>Location (optional)</SectionLabel>
          <input placeholder="Venue / city" value={location} onChange={(e) => setLocation(e.target.value)} style={{ width: '100%' }} />
        </div>
        <div>
          <SectionLabel>Date (optional)</SectionLabel>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ width: '100%' }} />
        </div>
        <button className="btn btn-primary" onClick={create} disabled={!name.trim() || busy}>
          {busy ? <><Spinner /> Creating…</> : 'Create event'}
        </button>
      </section>

      <section>
        {error && <div style={{ marginBottom: 'var(--sp-3)' }}><Toast message={error} tone="error" /></div>}
        <SectionLabel>Events · {events.length}</SectionLabel>
        <div className="grid" style={{ gridTemplateColumns: '1fr' }}>
          {events.map((e) => (
            <div key={e.id} className="grid" style={{ gap: 'var(--sp-3)' }}>
              <div className="card row">
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800 }}>{e.name}</div>
                  <div className="muted" style={{ fontSize: 14 }}>
                    {[e.location, e.event_date].filter(Boolean).join(' · ') || '—'}
                  </div>
                </div>
                <div className="spacer" />
                <button className="btn" onClick={() => setEditingId(editingId === e.id ? null : e.id)} aria-expanded={editingId === e.id}>
                  Edit
                </button>
                {e.is_active ? (
                  <span className="badge" style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}>● Active</span>
                ) : (
                  <button className="btn btn-secondary" onClick={() => activate(e.id)} disabled={activating === e.id}>
                    {activating === e.id ? <><Spinner /> …</> : 'Set active'}
                  </button>
                )}
              </div>
              {editingId === e.id && (
                <EventEditor event={e} onSave={(patch) => save(e, patch)} onClose={() => setEditingId(null)} />
              )}
            </div>
          ))}
          {events.length === 0 && <EmptyState>No events yet.</EmptyState>}
        </div>
      </section>
    </div>
  );
}
