import { useMemo, useState } from 'react';
import { supabase, designPhotoUrl } from '../lib/supabase';
import { SHIRT_COLORS } from '../config';
import { useEvents } from '../hooks/useEvents';
import { useDesigns } from '../hooks/useDesigns';
import { useSession } from '../context/SessionContext';
import { SectionLabel } from '../components/ui/SectionLabel';
import { EmptyState } from '../components/ui/EmptyState';
import { Spinner } from '../components/ui/Spinner';
import type { DesignType } from '../types/db';

async function uploadPhoto(eventId: string, file: File, side: string): Promise<string> {
  const ext = file.name.split('.').pop() || 'jpg';
  const path = `${eventId}/${crypto.randomUUID()}-${side}.${ext}`;
  const { error } = await supabase.storage.from('designs').upload(path, file, { upsert: false });
  if (error) throw error;
  return path;
}

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('');
}

export function AdminDesignsPage() {
  const { activeEvent } = useSession();
  const { events } = useEvents();
  // Selector defaults to the active event; explicit pick overrides it.
  const [pickedId, setPickedId] = useState<string | null>(null);
  const eventId = pickedId ?? activeEvent?.id ?? null;
  const setEventId = setPickedId;

  const { designs, reload } = useDesigns(eventId);

  const [name, setName] = useState('');
  const [type, setType] = useState<DesignType>('big');
  const [colors, setColors] = useState<string[]>([]);
  const [front, setFront] = useState<File | null>(null);
  const [back, setBack] = useState<File | null>(null);
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
    try {
      const photo_front = front ? await uploadPhoto(eventId, front, 'front') : null;
      const photo_back = back ? await uploadPhoto(eventId, back, 'back') : null;
      const { error } = await supabase.from('designs').insert({
        event_id: eventId,
        name: name.trim(),
        type,
        photo_front,
        photo_back,
        compatible_colors: colors,
      });
      if (error) throw error;
      setName('');
      setColors([]);
      setFront(null);
      setBack(null);
      await reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string, dName: string) => {
    if (!window.confirm(`Delete design "${dName}"? This cannot be undone.`)) return;
    await supabase.from('designs').delete().eq('id', id);
    await reload();
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
          <input placeholder="e.g. Riga Skyline" value={name} onChange={(e) => setName(e.target.value)} style={{ width: '100%' }} />
        </div>

        <div>
          <SectionLabel>Type</SectionLabel>
          <div className="row">
            <button className={type === 'big' ? 'btn btn-primary' : 'btn'} aria-pressed={type === 'big'} onClick={() => setType('big')}>Big</button>
            <button className={type === 'small' ? 'btn btn-primary' : 'btn'} aria-pressed={type === 'small'} onClick={() => setType('small')}>Small</button>
          </div>
        </div>

        <div>
          <SectionLabel>Compatible colors</SectionLabel>
          <div className="row">
            {SHIRT_COLORS.map((c) => (
              <button
                key={c.key}
                onClick={() => toggleColor(c.key)}
                aria-pressed={colors.includes(c.key)}
                className={colors.includes(c.key) ? 'btn btn-selected' : 'btn'}
                style={{ background: c.hex, color: c.text, border: '1px solid var(--border-strong)' }}
              >
                {c.label}
              </button>
            ))}
          </div>
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
          {busy ? <><Spinner /> Uploading…</> : 'Add design'}
        </button>
      </section>

      <section>
        <SectionLabel>Catalog · {designs.length}</SectionLabel>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
          {designs.map((d) => {
            const url = designPhotoUrl(d.photo_front) ?? designPhotoUrl(d.photo_back);
            return (
              <div key={d.id} className="card grid" style={{ gap: 8 }}>
                {url ? (
                  <img src={url} alt={d.name} loading="lazy" style={{ width: '100%', height: 140, objectFit: 'cover', borderRadius: 'var(--r-inner)', border: '1px solid var(--border-subtle)' }} />
                ) : (
                  <div style={{ height: 140, background: 'var(--surface-raised)', borderRadius: 'var(--r-inner)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 800, color: 'var(--text-secondary)' }}>
                    {initials(d.name)}
                  </div>
                )}
                <div style={{ fontWeight: 800 }}>{d.name}</div>
                <div className="muted" style={{ fontSize: 13 }}>{d.type} · {d.compatible_colors.join(', ') || 'any'}</div>
                <button className="btn-text" style={{ alignSelf: 'start' }} onClick={() => remove(d.id, d.name)}>Delete</button>
              </div>
            );
          })}
          {designs.length === 0 && <EmptyState>No designs for this event yet.</EmptyState>}
        </div>
      </section>
    </div>
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
