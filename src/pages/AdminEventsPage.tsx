import { useState } from 'react';
import { useEvents } from '../hooks/useEvents';
import { useSession } from '../context/SessionContext';
import { SectionLabel } from '../components/ui/SectionLabel';
import { EmptyState } from '../components/ui/EmptyState';
import { Spinner } from '../components/ui/Spinner';

export function AdminEventsPage() {
  const { reloadActiveEvent } = useSession();
  const { events, createEvent, activateEvent } = useEvents();
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [date, setDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [activating, setActivating] = useState<string | null>(null);

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
    await activateEvent(id);
    await reloadActiveEvent();
    setActivating(null);
  };

  return (
    <div className="grid" style={{ gap: 'var(--sp-5)' }}>
      <section className="card grid">
        <h2 style={{ margin: 0 }}>New event</h2>
        <div>
          <SectionLabel>Event name</SectionLabel>
          <input placeholder="e.g. Hyrox Riga" value={name} onChange={(e) => setName(e.target.value)} style={{ width: '100%' }} />
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
        <SectionLabel>Events · {events.length}</SectionLabel>
        <div className="grid" style={{ gridTemplateColumns: '1fr' }}>
          {events.map((e) => (
            <div key={e.id} className="card row">
              <div>
                <div style={{ fontSize: 18, fontWeight: 800 }}>{e.name}</div>
                <div className="muted" style={{ fontSize: 14 }}>
                  {[e.location, e.event_date].filter(Boolean).join(' · ') || '—'}
                </div>
              </div>
              <div className="spacer" />
              {e.is_active ? (
                <span className="badge" style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}>● Active</span>
              ) : (
                <button className="btn btn-secondary" onClick={() => activate(e.id)} disabled={activating === e.id}>
                  {activating === e.id ? <><Spinner /> …</> : 'Set active'}
                </button>
              )}
            </div>
          ))}
          {events.length === 0 && <EmptyState>No events yet.</EmptyState>}
        </div>
      </section>
    </div>
  );
}
