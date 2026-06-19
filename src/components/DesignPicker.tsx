import { useState, type ReactNode } from 'react';
import { designPhotoUrl } from '../lib/supabase';
import type { Design } from '../types/db';

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

// Image-tile picker so staff recognize prints by picture, not text.
// `side` chooses which photo to show on the tile.
export function DesignPicker({
  designs,
  side,
  value,
  onChange,
}: {
  designs: Design[];
  side: 'front' | 'back';
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  return (
    <div
      role="group"
      aria-label={`${side} print`}
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
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
          None
        </div>
      </Tile>

      {designs.map((d) => {
        const url = designPhotoUrl(side === 'front' ? d.photo_front : d.photo_back);
        return (
          <Tile key={d.id} selected={value === d.id} onClick={() => onChange(d.id)}>
            <TileImage url={url} name={d.name} />
            <div style={{ fontSize: 13, fontWeight: 700, padding: '6px 8px' }}>{d.name}</div>
          </Tile>
        );
      })}
    </div>
  );
}

function TileImage({ url, name }: { url: string | null; name: string }) {
  const [failed, setFailed] = useState(false);
  if (url && !failed) {
    return (
      <img
        src={url}
        alt={name}
        loading="lazy"
        onError={() => setFailed(true)}
        style={{ width: '100%', height: 120, objectFit: 'cover', display: 'block' }}
      />
    );
  }
  return (
    <div
      style={{
        height: 120,
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
