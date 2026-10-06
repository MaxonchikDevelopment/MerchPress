import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase, designPhotoUrl } from '../lib/supabase';
import { eventOptions } from '../lib/eventOptions';
import { errorMessage } from '../lib/imageUpload';
import { initials } from '../lib/initials';
import { hasNoMatch, sameList, tickAll, tickKey, tickedKeys, toggleKey } from '../lib/compatMatrix';
import { useEvents } from '../hooks/useEvents';
import { useDesigns } from '../hooks/useDesigns';
import { useSession } from '../context/SessionContext';
import { EmptyState } from '../components/ui/EmptyState';
import { Toast } from '../components/ui/Toast';
import type { Design } from '../types/db';

const LAST_COLOR_HINT = 'At least one colour must stay ticked.';

// Which shirt colours each design is printed on, on one screen. Writes go straight to
// designs.compatible_colors (policy designs_all), one at a time per design.
export function AdminCompatPage() {
  const { activeEvent } = useSession();
  const { events } = useEvents();
  // Selector defaults to the active event; explicit pick overrides it.
  const [pickedId, setPickedId] = useState<string | null>(null);
  const eventId = pickedId ?? activeEvent?.id ?? null;
  const event = events.find((e) => e.id === eventId);

  const { designs } = useDesigns(eventId);
  const { colors } = useMemo(() => eventOptions(event), [event]);
  const keys = useMemo(() => colors.map((c) => c.key), [colors]);
  // useDesigns keeps the previous event's rows until the new fetch lands.
  const rows = useMemo(() => designs.filter((d) => d.event_id === eventId), [designs, eventId]);

  // Optimistic lists by design id; `confirmed` is what the database has, `desired` the latest tap.
  const [view, setView] = useState<Record<string, string[]>>({});
  const confirmed = useRef(new Map<string, string[]>());
  const desired = useRef(new Map<string, string[]>());
  const running = useRef(new Map<string, Promise<boolean>>());
  const stored = (d: Design) => view[d.id] ?? d.compatible_colors;

  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'error' } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(toastTimer.current), []);
  const flash = useCallback((message: string, tone: 'success' | 'error') => {
    setToast({ message, tone });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), tone === 'error' ? 5000 : 2500);
  }, []);

  // Sends the latest wanted list until it matches the database, so taps made while a save is in
  // flight go out afterwards, in order. A failure rolls the row back to the last saved list.
  const drain = useCallback(
    async (id: string): Promise<boolean> => {
      for (;;) {
        const want = desired.current.get(id) as string[];
        if (sameList(want, confirmed.current.get(id) as string[])) return true;
        let failure: string | null = null;
        try {
          const { data, error } = await supabase
            .from('designs')
            .update({ compatible_colors: want })
            .eq('id', id)
            .select('id');
          if (error) throw error;
          // An update that matched no row reports no error; do not call that a success.
          if (!data || data.length === 0) throw new Error('Design not found. Reload the page.');
        } catch (e) {
          failure = errorMessage(e, 'Could not save. Try again.');
        }
        if (failure === null) {
          confirmed.current.set(id, want);
          continue;
        }
        const back = confirmed.current.get(id) as string[];
        desired.current.set(id, back);
        setView((v) => ({ ...v, [id]: back }));
        flash(failure, 'error');
        return false;
      }
    },
    [flash],
  );

  const save = (d: Design, next: string[]): Promise<boolean> => {
    if (!confirmed.current.has(d.id)) confirmed.current.set(d.id, d.compatible_colors);
    desired.current.set(d.id, next);
    setView((v) => ({ ...v, [d.id]: next }));
    const inFlight = running.current.get(d.id);
    if (inFlight) return inFlight;
    const p = drain(d.id).finally(() => running.current.delete(d.id));
    running.current.set(d.id, p);
    return p;
  };

  const onToggle = (d: Design, key: string) => {
    const { next, blocked } = toggleKey(stored(d), keys, key);
    if (blocked) return flash(LAST_COLOR_HINT, 'error');
    void save(d, next).then((ok) => ok && flash(`Saved: ${d.name}`, 'success'));
  };

  const onAll = (d: Design) => {
    if (sameList(stored(d), tickAll())) return;
    void save(d, tickAll()).then((ok) => ok && flash(`Saved: ${d.name}`, 'success'));
  };

  const needsColor = (key: string) => rows.filter((d) => !tickedKeys(stored(d), keys).includes(key));

  const onColumn = (key: string, label: string) => {
    const targets = needsColor(key);
    if (targets.length === 0) return;
    void Promise.all(targets.map((d) => save(d, tickKey(stored(d), keys, key)))).then((oks) => {
      // A failed save has already shown its own error.
      if (oks.every(Boolean)) flash(`${label} ticked for ${targets.length} ${targets.length === 1 ? 'design' : 'designs'}`, 'success');
    });
  };

  return (
    <div className="grid" style={{ gap: 'var(--sp-5)' }}>
      <section className="card grid">
        <div className="row">
          <h2 style={{ margin: 0 }}>Compatibility for</h2>
          <select value={eventId ?? ''} onChange={(e) => setPickedId(e.target.value)} aria-label="Event">
            <option value="" disabled>Select event…</option>
            {events.map((e) => (
              <option key={e.id} value={e.id}>{e.name}{e.is_active ? ' (active)' : ''}</option>
            ))}
          </select>
        </div>
        <div className="muted" style={{ fontSize: 13 }}>
          All ticked = any colour (new colours are allowed automatically). At least one colour must stay ticked.
        </div>

        {!event ? (
          <EmptyState>Select an event.</EmptyState>
        ) : rows.length === 0 ? (
          <EmptyState>No designs for this event yet.</EmptyState>
        ) : (
          <div className="compat-scroll">
            <table className="compat-table">
              <thead>
                <tr>
                  <th scope="col" className="compat-first">Design</th>
                  {colors.map((c) => (
                    <th key={c.key} scope="col" className="compat-col">
                      <div className="compat-colhead">
                        <span className="compat-dot" style={{ background: c.hex }} aria-hidden="true" />
                        <span>{c.label}</span>
                      </div>
                      <button
                        className="compat-link"
                        onClick={() => onColumn(c.key, c.label)}
                        disabled={needsColor(c.key).length === 0}
                        aria-label={`Tick ${c.label} for all designs`}
                      >
                        All designs
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((d) => {
                  const list = stored(d);
                  const ticked = tickedKeys(list, keys);
                  return (
                    <tr key={d.id} className={d.is_active ? undefined : 'compat-hidden'}>
                      <th scope="row" className="compat-first">
                        <div className="compat-id">
                          <Thumb design={d} />
                          <div className="compat-idtext">
                            <div className="compat-name">{d.name}</div>
                            {!d.is_active && <span className="badge compat-tag">Hidden</span>}
                            {hasNoMatch(list, keys) && (
                              <div className="compat-warn">⚠ No colour of this event matches</div>
                            )}
                            <button className="compat-link" onClick={() => onAll(d)} aria-label={`Tick all colours for ${d.name}`}>
                              All
                            </button>
                          </div>
                        </div>
                      </th>
                      {colors.map((c) => {
                        const on = ticked.includes(c.key);
                        return (
                          <td key={c.key} className="compat-td">
                            <button
                              className="compat-cell"
                              aria-pressed={on}
                              aria-label={`${d.name} on ${c.label}`}
                              onClick={() => onToggle(d, c.key)}
                            >
                              {on ? '✓' : ''}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {toast && (
        <div className="compat-toast">
          <Toast message={toast.message} tone={toast.tone} />
        </div>
      )}
    </div>
  );
}

// Front photo, else initials (also when the photo fails to load).
function Thumb({ design: d }: { design: Design }) {
  const url = designPhotoUrl(d.photo_front);
  const [failed, setFailed] = useState(false);
  return (
    <div className="compat-thumb" aria-hidden="true">
      {url && !failed ? <img src={url} alt="" loading="lazy" onError={() => setFailed(true)} /> : initials(d.name)}
    </div>
  );
}
