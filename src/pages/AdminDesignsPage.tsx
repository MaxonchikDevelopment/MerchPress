import { useMemo, useState } from 'react';
import { supabase, designPhotoUrl } from '../lib/supabase';
import { eventOptions, type EffectiveColor } from '../lib/eventOptions';
import { errorMessage, removePhotos, uploadDesignPhoto, type UploadStage } from '../lib/imageUpload';
import { initials } from '../lib/initials';
import { ImageLightbox } from '../components/ImageLightbox';
import { useEvents } from '../hooks/useEvents';
import { useDesigns } from '../hooks/useDesigns';
import { useSession } from '../context/SessionContext';
import { SectionLabel } from '../components/ui/SectionLabel';
import { EmptyState } from '../components/ui/EmptyState';
import { Spinner } from '../components/ui/Spinner';
import { AdminCompatPage } from './AdminCompatPage';
import type { Design, DesignType } from '../types/db';

// designs.type is `not null` with no default (0001_init.sql). The UI no longer offers it,
// so new rows get this constant and edits never touch the column.
const DEFAULT_DESIGN_TYPE: DesignType = 'big';

const STAGE_LABEL: Record<UploadStage, string> = { preparing: 'Preparing photo…', uploading: 'Uploading…' };

type SubTab = 'catalog' | 'compat';

// Catalog and Compatibility share one admin tab. Compatibility unmounts on switch-away, so it refetches.
export function AdminDesignsPage() {
  const [sub, setSub] = useState<SubTab>('catalog');
  return (
    <div className="grid" style={{ gap: 'var(--sp-4)' }}>
      <div className="admin-subtabs" role="tablist" aria-label="Designs sections">
        <button role="tab" aria-selected={sub === 'catalog'} className={sub === 'catalog' ? 'tab tab-active' : 'tab'} onClick={() => setSub('catalog')}>
          Catalog
        </button>
        <button role="tab" aria-selected={sub === 'compat'} className={sub === 'compat' ? 'tab tab-active' : 'tab'} onClick={() => setSub('compat')}>
          Compatibility
        </button>
      </div>
      {sub === 'catalog' ? <DesignsCatalog /> : <AdminCompatPage />}
    </div>
  );
}

function DesignsCatalog() {
  const { activeEvent } = useSession();
  const { events } = useEvents();
  // Selector defaults to the active event; explicit pick overrides it.
  const [pickedId, setPickedId] = useState<string | null>(null);
  const eventId = pickedId ?? activeEvent?.id ?? null;
  const setEventId = setPickedId;

  const { designs, reload } = useDesigns(eventId);
  const { colors: shirtColors } = useMemo(
    () => eventOptions(events.find((e) => e.id === eventId)),
    [events, eventId],
  );

  const [name, setName] = useState('');
  const [colors, setColors] = useState<string[]>([]);
  const [front, setFront] = useState<File | null>(null);
  const [back, setBack] = useState<File | null>(null);
  const [stage, setStage] = useState<UploadStage | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const frontPreview = useMemo(() => (front ? URL.createObjectURL(front) : null), [front]);
  const backPreview = useMemo(() => (back ? URL.createObjectURL(back) : null), [back]);

  const toggleColor = (key: string) =>
    setColors((cur) => (cur.includes(key) ? cur.filter((c) => c !== key) : [...cur, key]));

  const add = async () => {
    if (!eventId || !name.trim()) return;
    setBusy(true);
    setErr(null);
    const uploaded: string[] = [];
    try {
      let photo_front: string | null = null;
      let photo_back: string | null = null;
      if (front) uploaded.push((photo_front = await uploadDesignPhoto(eventId, front, 'front', setStage)));
      if (back) uploaded.push((photo_back = await uploadDesignPhoto(eventId, back, 'back', setStage)));
      const { error } = await supabase.from('designs').insert({
        event_id: eventId,
        name: name.trim(),
        type: DEFAULT_DESIGN_TYPE,
        photo_front,
        photo_back,
        compatible_colors: colors,
      });
      if (error) throw error;
      uploaded.length = 0; // now referenced by the row
      setName('');
      setColors([]);
      setFront(null);
      setBack(null);
      await reload();
    } catch (e) {
      await removePhotos(uploaded); // don't orphan photos of a design that was not created
      setErr(errorMessage(e, 'Upload failed'));
    } finally {
      setBusy(false);
      setStage(null);
    }
  };

  return (
    <div className="grid" style={{ gap: 'var(--sp-5)' }}>
      <section className="card grid">
        <div className="row">
          <h2 style={{ margin: 0 }}>Designs for</h2>
          <select value={eventId ?? ''} onChange={(e) => setEventId(e.target.value)} aria-label="Event">
            <option value="" disabled>Select event…</option>
            {events.map((e) => (
              <option key={e.id} value={e.id}>{e.name}{e.is_active ? ' (active)' : ''}</option>
            ))}
          </select>
        </div>

        <div>
          <SectionLabel>Design name</SectionLabel>
          <input placeholder="e.g. City Map" value={name} onChange={(e) => setName(e.target.value)} style={{ width: '100%' }} />
        </div>

        <div>
          <SectionLabel>Compatible colors</SectionLabel>
          <div className="muted" style={{ fontSize: 13, marginBottom: 'var(--sp-2)' }}>
            None selected means all colors are allowed.
          </div>
          <ColorToggles palette={shirtColors} selected={colors} onToggle={toggleColor} />
        </div>

        <div>
          <SectionLabel>Photos</SectionLabel>
          <div className="row">
            <PhotoDrop label="Front photo" file={front} preview={frontPreview} onPick={setFront} />
            <PhotoDrop label="Back photo" file={back} preview={backPreview} onPick={setBack} />
          </div>
        </div>

        {err && <div className="toast toast-error">{err}</div>}
        <button className="btn btn-primary" onClick={add} disabled={!eventId || !name.trim() || busy}>
          {busy ? <><Spinner /> {stage ? STAGE_LABEL[stage] : 'Saving…'}</> : 'Add design'}
        </button>
      </section>

      <section>
        <SectionLabel>Catalog · {designs.length}</SectionLabel>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
          {designs.map((d) => (
            <DesignCard key={d.id} design={d} palette={shirtColors} onChanged={reload} />
          ))}
          {designs.length === 0 && <EmptyState>No designs for this event yet.</EmptyState>}
        </div>
      </section>
    </div>
  );
}

// Colour chips for the event palette, plus any stored key the palette no longer has,
// so editing a design never silently drops one.
function ColorToggles({
  palette,
  selected,
  onToggle,
}: {
  palette: EffectiveColor[];
  selected: string[];
  onToggle: (key: string) => void;
}) {
  const orphans = selected.filter((k) => !palette.some((c) => c.key === k));
  return (
    <div className="row">
      {palette.map((c) => (
        <button
          key={c.key}
          onClick={() => onToggle(c.key)}
          aria-pressed={selected.includes(c.key)}
          className={selected.includes(c.key) ? 'btn swatch swatch-selected' : 'btn swatch'}
          style={{ background: c.hex, color: c.text }}
        >
          {selected.includes(c.key) ? `✓ ${c.label}` : c.label}
        </button>
      ))}
      {orphans.map((k) => (
        <button key={k} onClick={() => onToggle(k)} aria-pressed className="btn btn-selected" title="Not in this event's colours">
          {k}
        </button>
      ))}
    </div>
  );
}

function DesignCard({
  design: d,
  palette,
  onChanged,
}: {
  design: Design;
  palette: EffectiveColor[];
  onChanged: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(d.name);
  const [colors, setColors] = useState<string[]>(d.compatible_colors);
  const [working, setWorking] = useState<string | null>(null); // label of the running action
  const [err, setErr] = useState<string | null>(null);

  const [zoom, setZoom] = useState<{ src: string; alt: string } | null>(null);

  const run = async (label: string, fn: () => Promise<void>) => {
    if (working) return;
    setWorking(label);
    setErr(null);
    try {
      await fn();
    } catch (e) {
      setErr(errorMessage(e, 'Something went wrong. Try again.'));
    } finally {
      setWorking(null);
    }
  };

  const startEdit = () => {
    setName(d.name);
    setColors(d.compatible_colors);
    setErr(null);
    setEditing(true);
  };

  const saveEdit = () =>
    run('Saving…', async () => {
      if (!name.trim()) throw new Error('Enter a design name.');
      const { error } = await supabase
        .from('designs')
        .update({ name: name.trim(), compatible_colors: colors })
        .eq('id', d.id);
      if (error) throw error;
      setEditing(false);
      await onChanged();
    });

  const toggleActive = () =>
    run(d.is_active ? 'Hiding…' : 'Showing…', async () => {
      const { error } = await supabase.from('designs').update({ is_active: !d.is_active }).eq('id', d.id);
      if (error) throw error;
      await onChanged();
    });

  // Upload the new photo, point the row at it, then delete the old object.
  const replacePhoto = (side: 'front' | 'back', file: File) => {
    const col = side === 'front' ? 'photo_front' : 'photo_back';
    return run('Preparing photo…', async () => {
      const path = await uploadDesignPhoto(d.event_id, file, side, (s) => setWorking(STAGE_LABEL[s]));
      const { error } = await supabase.from('designs').update({ [col]: path }).eq('id', d.id);
      if (error) {
        await removePhotos([path]);
        throw error;
      }
      await removePhotos([d[col]]); // failure is only logged
      await onChanged();
    });
  };

  const remove = () => {
    if (!window.confirm(`Delete design "${d.name}"? This cannot be undone.`)) return;
    return run('Deleting…', async () => {
      const { error } = await supabase.from('designs').delete().eq('id', d.id);
      if (error) {
        // 23503: foreign key violation, an order still points at this design.
        throw new Error(error.code === '23503' ? 'This design is used by orders. Hide it instead.' : error.message);
      }
      await removePhotos([d.photo_front, d.photo_back]); // only after the row is gone
      await onChanged();
    });
  };

  return (
    <div className="card grid" style={{ gap: 8, opacity: d.is_active ? 1 : 0.6 }}>
      <div className="design-sides">
        {(['front', 'back'] as const).map((side) => {
          const url = designPhotoUrl(side === 'front' ? d.photo_front : d.photo_back);
          const label = side === 'front' ? 'Front' : 'Back';
          return (
            <div key={side} className="design-side">
              {url ? (
                <button
                  className="design-photo"
                  aria-label={`Enlarge ${label.toLowerCase()} photo of ${d.name}`}
                  onClick={() => setZoom({ src: url, alt: `${d.name} (${label.toLowerCase()})` })}
                >
                  <img src={url} alt="" loading="lazy" />
                </button>
              ) : (
                <div className="design-photo design-photo-empty">{initials(d.name)}</div>
              )}
              <div className="muted design-side-label">{label}</div>
              <PhotoReplace label={`Replace ${side} photo`} disabled={!!working} onPick={(f) => replacePhoto(side, f)} />
            </div>
          );
        })}
      </div>

      {editing ? (
        <>
          <input value={name} onChange={(e) => setName(e.target.value)} aria-label="Design name" style={{ width: '100%' }} />
          <div>
            <SectionLabel>Compatible colors</SectionLabel>
            <ColorToggles
              palette={palette}
              selected={colors}
              onToggle={(k) => setColors((cur) => (cur.includes(k) ? cur.filter((c) => c !== k) : [...cur, k]))}
            />
          </div>
          <div className="design-edit-actions">
            <button className="btn btn-primary" onClick={saveEdit} disabled={!!working}>
              {working === 'Saving…' ? <><Spinner /> Saving…</> : 'Save'}
            </button>
            <button className="btn" onClick={() => setEditing(false)} disabled={!!working}>Cancel</button>
          </div>
        </>
      ) : (
        <>
          <div style={{ fontWeight: 800 }}>
            {d.name}
            {!d.is_active && <span className="badge" style={{ marginLeft: 8 }}>Hidden</span>}
          </div>
          <div className="muted" style={{ fontSize: 13 }}>
            Colors: {d.compatible_colors.map((k) => palette.find((c) => c.key === k)?.label ?? k).join(', ') || 'any'}
          </div>
          <div className="design-actions">
            <button className="btn" onClick={startEdit} disabled={!!working}>Edit</button>
            <button className="btn" onClick={toggleActive} disabled={!!working}>{d.is_active ? 'Hide' : 'Show'}</button>
            <button className="btn" onClick={remove} disabled={!!working}>Delete</button>
          </div>
        </>
      )}
      {working && <div className="muted" style={{ fontSize: 13 }}><Spinner /> {working}</div>}
      {err && <div className="toast toast-error" role="alert">{err}</div>}
      {zoom && <ImageLightbox src={zoom.src} alt={zoom.alt} onClose={() => setZoom(null)} />}
    </div>
  );
}

function PhotoReplace({ label, disabled, onPick }: { label: string; disabled: boolean; onPick: (f: File) => void }) {
  return (
    <label className="btn-text design-replace" style={{ cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.5 : 1 }}>
      {label}
      <input
        type="file"
        accept="image/*"
        hidden
        disabled={disabled}
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = ''; // allow picking the same file again
          if (f) onPick(f);
        }}
      />
    </label>
  );
}

function PhotoDrop({
  label,
  file,
  preview,
  onPick,
}: {
  label: string;
  file: File | null;
  preview: string | null;
  onPick: (f: File | null) => void;
}) {
  return (
    <label
      className="card-raised"
      style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', minWidth: 200, flex: 1 }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 'var(--r-inner)',
          background: 'var(--surface-card)',
          border: '1px solid var(--border-subtle)',
          overflow: 'hidden',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-faint)',
          fontSize: 22,
        }}
      >
        {preview ? <img src={preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '＋'}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>{label}</div>
        <div className="muted" style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {file ? file.name : 'Tap to choose'}
        </div>
      </div>
      <input type="file" accept="image/*" hidden onChange={(e) => onPick(e.target.files?.[0] ?? null)} />
    </label>
  );
}
