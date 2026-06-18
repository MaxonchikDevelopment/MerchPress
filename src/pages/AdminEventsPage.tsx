import { useState } from 'react';
import { useEvents } from '../hooks/useEvents';
import { useSession } from '../context/SessionContext';

export function AdminEventsPage() {
  const { reloadActiveEvent } = useSession();
  const { events, createEvent, activateEvent } = useEvents();
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [date, setDate] = useState('');

  const create = async () => {
    if (!name.trim()) return;
    await createEvent(name.trim(), location.trim(), date);
    setName('');
    setLocation('');
    setDate('');
  };

  const activate = async (id: string) => {
    await activateEvent(id);
    await reloadActiveEvent();
  };

  return (
    <div className="grid">
      <div className="card grid">
        <h2 style={{ margin: 0 }}>New event</h2>
        <input placeholder="Event name (e.g. Hyrox Riga)" value={name} onChange={(e) => setName(e.target.value)} />
        <input placeholder="Location" value={location} onChange={(e) => setLocation(e.target.value)} />
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <button className="btn btn-primary" onClick={create} disabled={!name.trim()}>
          Create event
        </button>
      </div>

      <h2>Events</h2>
      <div className="grid" style={{ gridTemplateColumns: '1fr' }}>
        {events.map((e) => (
          <div key={e.id} className="card row">
            <div>
              <div style={{ fontSize: 18, fontWeight: 800 }}>{e.name}</div>
              <div className="muted">
                {[e.location, e.event_date].filter(Boolean).join(' · ') || '—'}
              </div>
            </div>
            <div className="spacer" />
            {e.is_active ? (
              <span className="badge" style={{ background: 'var(--ok)' }}>Active</span>
            ) : (
              <button className="btn" onClick={() => activate(e.id)}>Set active</button>
            )}
          </div>
        ))}
        {events.length === 0 && <div className="muted">No events yet.</div>}
      </div>
    </div>
  );
}
