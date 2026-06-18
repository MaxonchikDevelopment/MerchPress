import { useState } from 'react';
import { supabase, designPhotoUrl } from '../lib/supabase';
import { SHIRT_COLORS } from '../config';
import { useEvents } from '../hooks/useEvents';
import { useDesigns } from '../hooks/useDesigns';
import { useSession } from '../context/SessionContext';
import type { DesignType } from '../types/db';

async function uploadPhoto(eventId: string, file: File, side: string): Promise<string> {
  const ext = file.name.split('.').pop() || 'jpg';
  const path = `${eventId}/${crypto.randomUUID()}-${side}.${ext}`;
  const { error } = await supabase.storage.from('designs').upload(path, file, { upsert: false });
  if (error) throw error;
  return path;
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

  const remove = async (id: string) => {
    await supabase.from('designs').delete().eq('id', id);
    await reload();
  };

  return (
    <div className="grid">
      <div className="card grid">
        <div className="row">
          <h2 style={{ margin: 0 }}>Designs for</h2>
          <select value={eventId ?? ''} onChange={(e) => setEventId(e.target.value)}>
            <option value="" disabled>Select event…</option>
            {events.map((e) => (
              <option key={e.id} value={e.id}>{e.name}{e.is_active ? ' (active)' : ''}</option>
            ))}
          </select>
        </div>

        <input placeholder="Design name (e.g. Riga Skyline)" value={name} onChange={(e) => setName(e.target.value)} />

        <div className="row">
          <div className="label" style={{ margin: 0 }}>Type</div>
          <button className={type === 'big' ? 'btn btn-primary' : 'btn'} onClick={() => setType('big')}>Big</button>
          <button className={type === 'small' ? 'btn btn-primary' : 'btn'} onClick={() => setType('small')}>Small</button>
        </div>

        <div>
          <div className="label">Compatible colors</div>
          <div className="row">
            {SHIRT_COLORS.map((c) => (
              <button
                key={c.key}
                onClick={() => toggleColor(c.key)}
                className={colors.includes(c.key) ? 'btn btn-selected' : 'btn'}
                style={{ background: c.hex, color: c.text }}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        <div className="row">
          <label className="btn">
            {front ? `Front: ${front.name}` : 'Front photo'}
            <input type="file" accept="image/*" hidden onChange={(e) => setFront(e.target.files?.[0] ?? null)} />
          </label>
          <label className="btn">
            {back ? `Back: ${back.name}` : 'Back photo'}
            <input type="file" accept="image/*" hidden onChange={(e) => setBack(e.target.files?.[0] ?? null)} />
          </label>
        </div>

        {err && <div style={{ color: 'var(--danger)', fontWeight: 700 }}>{err}</div>}
        <button className="btn btn-primary" onClick={add} disabled={!eventId || !name.trim() || busy}>
          {busy ? 'Uploading…' : 'Add design'}
        </button>
      </div>

      <h2>Catalog ({designs.length})</h2>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
        {designs.map((d) => {
          const url = designPhotoUrl(d.photo_front) ?? designPhotoUrl(d.photo_back);
          return (
            <div key={d.id} className="card grid" style={{ gap: 8 }}>
              {url ? (
                <img src={url} alt={d.name} style={{ width: '100%', height: 140, objectFit: 'cover', borderRadius: 10 }} />
              ) : (
                <div style={{ height: 140, background: 'var(--panel-2)', borderRadius: 10 }} />
              )}
              <div style={{ fontWeight: 800 }}>{d.name}</div>
              <div className="muted" style={{ fontSize: 13 }}>{d.type} · {d.compatible_colors.join(', ') || 'any'}</div>
              <button className="btn btn-danger" onClick={() => remove(d.id)}>Delete</button>
            </div>
          );
        })}
        {designs.length === 0 && <div className="muted">No designs for this event yet.</div>}
      </div>
    </div>
  );
}
