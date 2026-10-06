import { useState, type ReactNode } from 'react';
import { designPhotoUrl } from '../lib/supabase';
import { initials } from '../lib/initials';
import type { Design } from '../types/db';

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
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(auto-fill, minmax(${side === 'bundle' ? 160 : 120}px, 1fr))`,
        gap: 12,
      }}
    >
      <Tile selected={value === null} onClick={() => onChange(null)}>
        <div
          style={{
            height: 120,
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

function TileImage({ url, name, height = 120 }: { url: string | null; name: string; height?: number }) {
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

// Big front/back preview of the chosen bundle. A side without a photo shows the initials tile.
export function BundlePreview({ design }: { design: Design }) {
  return (
    <div style={{ display: 'flex', gap: 12, maxWidth: 520 }} aria-label={`Bundle preview: ${design.name}`}>
      {(['front', 'back'] as const).map((side) => (
        <div key={side} style={{ flex: 1, minWidth: 0 }}>
          <div style={{ borderRadius: 'var(--r-inner)', overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
            <TileImage url={designPhotoUrl(side === 'front' ? design.photo_front : design.photo_back)} name={design.name} height={200} />
          </div>
          <div className="muted" style={{ fontSize: 13, marginTop: 4, textAlign: 'center' }}>{side}</div>
        </div>
      ))}
    </div>
  );
}
