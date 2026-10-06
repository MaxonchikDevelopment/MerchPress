import { useState, type ReactNode } from 'react';
import { designPhotoUrl } from '../lib/supabase';
import { initials } from '../lib/initials';
import type { Design } from '../types/db';
import { ImageLightbox } from './ImageLightbox';

// Image-tile picker so staff recognize prints by picture, not text.
// `side` chooses which photo to show on the tile; 'bundle' shows front and back side by side
// (one design on both sides) and labels the empty choice "No print".
export function DesignPicker({
  designs,
  side,
  value,
  onChange,
}: {
  designs: Design[];
  side: 'front' | 'back' | 'bundle';
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  return (
    <div
      role="group"
      aria-label={side === 'bundle' ? 'bundle print' : `${side} print`}
      className={side === 'bundle' ? 'design-grid-bundle' : undefined}
      style={{
        display: 'grid',
        ...(side === 'bundle' ? {} : { gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))' }),
        gap: 12,
      }}
    >
      <Tile selected={value === null} onClick={() => onChange(null)}>
        <div
          style={{
            height: 'var(--tile-h, 120px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 16,
            fontWeight: 700,
            color: 'var(--text-secondary)',
          }}
        >
          {side === 'bundle' ? 'No print' : 'None'}
        </div>
      </Tile>

      {designs.map((d) => {
        const url = designPhotoUrl(side === 'back' ? d.photo_back : d.photo_front);
        return (
          <Tile key={d.id} selected={value === d.id} onClick={() => onChange(d.id)}>
            {side === 'bundle' ? (
              <div style={{ display: 'flex' }}>
                <div style={{ flex: 1, minWidth: 0 }}><TileImage url={url} name={d.name} /></div>
                <div style={{ flex: 1, minWidth: 0 }}><TileImage url={designPhotoUrl(d.photo_back)} name={d.name} /></div>
              </div>
            ) : (
              <TileImage url={url} name={d.name} />
            )}
            <div style={{ fontSize: 13, fontWeight: 700, padding: '6px 8px' }}>{d.name}</div>
          </Tile>
        );
      })}
    </div>
  );
}

function TileImage({ url, name, height = 'var(--tile-h, 120px)' }: { url: string | null; name: string; height?: number | string }) {
  const [failed, setFailed] = useState(false);
  if (url && !failed) {
    return (
      <img
        src={url}
        alt={name}
        loading="lazy"
        onError={() => setFailed(true)}
        style={{ width: '100%', height, objectFit: 'cover', display: 'block' }}
      />
    );
  }
  return (
    <div
      style={{
        height,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--surface-raised)',
        color: 'var(--text-secondary)',
        fontSize: 24,
        fontWeight: 800,
      }}
    >
      {initials(name)}
    </div>
  );
}

function Tile({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={selected}
      style={{
        padding: 0,
        overflow: 'hidden',
        background: 'var(--surface-card)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--r-inner)',
        boxShadow: selected ? '0 0 0 3px var(--accent)' : 'none',
        textAlign: 'left',
        transition: 'box-shadow var(--dur-fast) var(--ease)',
      }}
    >
      {children}
    </button>
  );
}

// The chosen print as one compact row: small photos (tap enlarges), the name and a Change button
// that reopens the picker. `design` null is the "No print" / "None" choice. A side without a
// photo shows the initials tile.
export function ChosenPrint({
  design,
  sides,
  onChange,
}: {
  design: Design | null;
  sides: ('front' | 'back')[];
  onChange: () => void;
}) {
  return (
    <div
      className="row"
      style={{
        flexWrap: 'nowrap',
        gap: 'var(--sp-3)',
        padding: 'var(--sp-2)',
        background: 'var(--surface-raised)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--r-inner)',
      }}
    >
      {design &&
        sides.map((side) => (
          <CompactThumb key={side} side={side} name={design.name} url={designPhotoUrl(side === 'front' ? design.photo_front : design.photo_back)} />
        ))}
      <div style={{ flex: 1, minWidth: 0, fontWeight: 700, overflowWrap: 'anywhere' }}>
        {design ? design.name : sides.length === 2 ? 'No print' : 'None'}
      </div>
      <button type="button" className="btn btn-secondary" onClick={onChange} style={{ flex: 'none', minHeight: 44, fontSize: 15 }}>
        Change
      </button>
    </div>
  );
}

function CompactThumb({ url, name, side }: { url: string | null; name: string; side: 'front' | 'back' }) {
  const [failed, setFailed] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const box = { width: 56, height: 56, borderRadius: 'var(--r-inner)', border: '1px solid var(--border-subtle)', flex: 'none' } as const;
  if (url && !failed) {
    return (
      <>
        <button
          type="button"
          aria-label={`Enlarge ${side} print — ${name}`}
          onClick={() => setZoomed(true)}
          style={{ padding: 0, border: 0, background: 'none', display: 'block', cursor: 'zoom-in', flex: 'none' }}
        >
          <img src={url} alt={`${side} — ${name}`} onError={() => setFailed(true)} style={{ ...box, display: 'block', objectFit: 'cover' }} />
        </button>
        {zoomed && <ImageLightbox src={url} alt={`${side} — ${name}`} onClose={() => setZoomed(false)} />}
      </>
    );
  }
  return (
    <div
      aria-label={`${name} (no ${side} photo)`}
      style={{
        ...box,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--surface-card)',
        color: 'var(--text-secondary)',
        fontSize: 16,
        fontWeight: 800,
      }}
    >
      {initials(name)}
    </div>
  );
}
