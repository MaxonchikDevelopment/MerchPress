import { useState } from 'react';
import { SHIRT_SIZES } from '../config';
import { END_DATE_ERROR, isEndBeforeStart } from '../lib/eventDates';
import { DEFAULT_COLORS, eventOptions, inkFor, newColorKey } from '../lib/eventOptions';
import { SectionLabel } from './ui/SectionLabel';
import { Spinner } from './ui/Spinner';
import type { EventRow, ShirtSize } from '../types/db';

// A colour row in the editor. `key` is null until the first save, when a new
// colour gets a slug of its label; existing keys never change.
interface ColorDraft {
  key: string | null;
  label: string;
  hex: string;
}

type Patch = Pick<EventRow, 'name' | 'location' | 'event_date' | 'event_end_date' | 'shirt_colors' | 'shirt_sizes'>;

const toDrafts = (event: EventRow): ColorDraft[] =>
  eventOptions(event).colors.map(({ key, label, hex }) => ({ key, label, hex }));

export function EventEditor({
  event,
  onSave,
  onClose,
}: {
  event: EventRow;
  onSave: (patch: Patch) => Promise<string | null>; // error message or null
  onClose: () => void;
}) {
  const [name, setName] = useState(event.name);
  const [location, setLocation] = useState(event.location ?? '');
  const [date, setDate] = useState(event.event_date ?? '');
  const [endDate, setEndDate] = useState(event.event_end_date ?? '');
  const [colors, setColors] = useState<ColorDraft[]>(() => toDrafts(event));
  const [sizes, setSizes] = useState<ShirtSize[]>(() => [...eventOptions(event).sizes]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const patchColor = (i: number, change: Partial<ColorDraft>) =>
    setColors((cur) => cur.map((c, j) => (j === i ? { ...c, ...change } : c)));

  const toggleSize = (s: ShirtSize) =>
    setSizes((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : SHIRT_SIZES.filter((x) => x === s || cur.includes(x))));

  const save = async () => {
    if (busy) return;
    if (!name.trim()) return setError('Enter an event name.');
    if (colors.length === 0) return setError('Keep at least one colour, or reset to defaults.');
    if (colors.some((c) => !c.label.trim())) return setError('Every colour needs a name.');
    if (sizes.length === 0) return setError('Keep at least one size.');
    if (isEndBeforeStart(date, endDate)) return setError(END_DATE_ERROR);

    // New colours get a slug key, unique within the event.
    const taken = new Set(colors.flatMap((c) => (c.key ? [c.key] : [])));
    const final = colors.map((c) => {
      if (c.key) return { key: c.key, label: c.label.trim(), hex: c.hex };
      const key = newColorKey(c.label, taken);
      taken.add(key);
      return { key, label: c.label.trim(), hex: c.hex };
    });

    // Identical to the built-in defaults: store null so future default changes apply.
    const isDefaultColors =
      final.length === DEFAULT_COLORS.length &&
      final.every((c, i) => c.key === DEFAULT_COLORS[i].key && c.label === DEFAULT_COLORS[i].label && c.hex === DEFAULT_COLORS[i].hex);
    const isDefaultSizes = sizes.length === SHIRT_SIZES.length;

    setBusy(true);
    setError(null);
    const err = await onSave({
      name: name.trim(),
      location: location.trim() || null,
      event_date: date || null,
      event_end_date: date ? endDate || null : null,
      shirt_colors: isDefaultColors ? null : final,
      shirt_sizes: isDefaultSizes ? null : sizes,
    });
    setBusy(false);
    if (err) setError(err);
    else onClose();
  };

  return (
    <div className="card-raised grid" style={{ gap: 'var(--sp-4)' }}>
      <div>
        <SectionLabel>Event name</SectionLabel>
        <input value={name} onChange={(e) => setName(e.target.value)} style={{ width: '100%' }} aria-label="Event name" />
      </div>
      <div>
        <SectionLabel>Location</SectionLabel>
        <input value={location} onChange={(e) => setLocation(e.target.value)} style={{ width: '100%' }} aria-label="Location" />
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

      <div>
        <SectionLabel>Shirt colours</SectionLabel>
        <div className="grid" style={{ gap: 8 }}>
          {colors.map((c, i) => (
            <div key={i} className="row">
              <input
                type="color"
                value={c.hex}
                onChange={(e) => patchColor(i, { hex: e.target.value })}
                aria-label={`Colour for ${c.label || 'new colour'}`}
                style={{ width: 56, height: 'var(--touch-min)', padding: 2, flexShrink: 0 }}
              />
              <input
                value={c.label}
                onChange={(e) => patchColor(i, { label: e.target.value })}
                placeholder="Colour name"
                aria-label="Colour name"
                style={{ flex: 1, minWidth: 120, background: c.hex, color: inkFor(c.hex) }}
              />
              <button className="btn-text" onClick={() => setColors((cur) => cur.filter((_, j) => j !== i))}>Remove</button>
            </div>
          ))}
        </div>
        <div className="row" style={{ marginTop: 8 }}>
          <button className="btn" onClick={() => setColors((cur) => [...cur, { key: null, label: '', hex: '#808080' }])}>Add colour</button>
          <button className="btn-text" onClick={() => setColors(DEFAULT_COLORS.map((c) => ({ ...c })))}>Reset to defaults</button>
        </div>
      </div>

      <div>
        <SectionLabel>Sizes</SectionLabel>
        <div className="row">
          {SHIRT_SIZES.map((s) => (
            <button
              key={s}
              className={sizes.includes(s) ? 'btn btn-primary btn-selected' : 'btn'}
              aria-pressed={sizes.includes(s)}
              onClick={() => toggleSize(s)}
              style={{ minWidth: 64 }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="toast toast-error" role="alert">{error}</div>}
      <div className="row">
        <button className="btn btn-primary" onClick={save} disabled={busy}>
          {busy ? <><Spinner /> Saving…</> : 'Save'}
        </button>
        <button className="btn" onClick={onClose} disabled={busy}>Cancel</button>
      </div>
    </div>
  );
}
