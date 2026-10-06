import { useState } from 'react';
import { useEvents } from '../hooks/useEvents';
import { useSession } from '../context/SessionContext';
import { SectionLabel } from '../components/ui/SectionLabel';
import { EmptyState } from '../components/ui/EmptyState';
import { Spinner } from '../components/ui/Spinner';
import type { EventRow } from '../types/db';
import { Toast } from '../components/ui/Toast';
import { END_DATE_ERROR, formatEventDates, isEndBeforeStart } from '../lib/eventDates';
import { EventEditor } from '../components/EventEditor';
import { ConfirmDialog } from '../components/ConfirmDialog';

export function AdminEventsPage() {
  const { reloadActiveEvent, refreshActiveEvent } = useSession();
  const { events, createEvent, updateEvent, activateEvent } = useEvents();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [date, setDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [activating, setActivating] = useState<string | null>(null);
  const [switchTo, setSwitchTo] = useState<EventRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  const create = async () => {
    if (!name.trim() || busy) return;
    if (isEndBeforeStart(date, endDate)) return setCreateError(END_DATE_ERROR);
    setBusy(true);
    setCreateError(null);
    const err = await createEvent(name.trim(), location.trim(), date, endDate);
    setBusy(false);
    if (err) return setCreateError(err);
    setName('');
    setLocation('');
    setDate('');
    setEndDate('');
  };

  const activate = async (id: string) => {
    if (activating) return;
    setActivating(id);
    setError(await activateEvent(id));
    await reloadActiveEvent();
    setActivating(null);
  };

  // Switching away from a live event moves every station, so ask first.
  const askActivate = (e: EventRow) => {
    if (events.some((x) => x.is_active)) setSwitchTo(e);
    else void activate(e.id);
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
          <SectionLabel>Start date (optional)</SectionLabel>
          <input
            type="date"
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              if (!e.target.value) setEndDate('');
            }}
            style={{ width: '100%' }}
            aria-label="Start date"
          />
        </div>
        <div>
          <SectionLabel>End date (optional)</SectionLabel>
          <input
            type="date"
            value={endDate}
            min={date || undefined}
            disabled={!date}
            onChange={(e) => setEndDate(e.target.value)}
            style={{ width: '100%' }}
            aria-label="End date"
          />
        </div>
        {createError && <Toast message={createError} tone="error" />}
        <button className="btn btn-primary" onClick={create} disabled={!name.trim() || busy}>
          {busy ? <><Spinner /> Creating…</> : 'Create event'}
        </button>
      </section>

      <section>
        {error && <div style={{ marginBottom: 'var(--sp-3)' }}><Toast message={error} tone="error" /></div>}
        <SectionLabel>Events · {events.length}</SectionLabel>
        <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 1fr)' }}>
          {events.map((e) => (
            <div key={e.id} className="grid" style={{ gap: 'var(--sp-3)' }}>
              <div className="card row">
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800 }}>{e.name}</div>
                  <div className="muted" style={{ fontSize: 14 }}>
                    {[e.location, formatEventDates(e.event_date, e.event_end_date)].filter(Boolean).join(' · ') || '—'}
                  </div>
                </div>
                <div className="spacer" />
                <button className="btn" onClick={() => setEditingId(editingId === e.id ? null : e.id)} aria-expanded={editingId === e.id}>
                  Edit
                </button>
                {e.is_active ? (
                  <span className="badge" style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}>● Active</span>
                ) : (
                  <button className="btn btn-secondary" onClick={() => askActivate(e)} disabled={activating === e.id}>
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
      {switchTo && (
        <ConfirmDialog
          title={`Switch the active event to ${switchTo.name}? All stations will switch within about 30 seconds.`}
          confirmLabel="Switch"
          cancelLabel="Keep current"
          onConfirm={() => {
            const id = switchTo.id;
            setSwitchTo(null);
            void activate(id);
          }}
          onCancel={() => setSwitchTo(null)}
        />
      )}
    </div>
  );
}
