import type { ReactNode } from 'react';
import { designPhotoUrl } from '../lib/supabase';
import type { Design } from '../types/db';

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
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
        gap: 12,
      }}
    >
      <Tile selected={value === null} onClick={() => onChange(null)}>
        <div style={{ fontSize: 16, fontWeight: 700, padding: 8 }}>None</div>
      </Tile>

      {designs.map((d) => {
        const url = designPhotoUrl(side === 'front' ? d.photo_front : d.photo_back);
        return (
          <Tile key={d.id} selected={value === d.id} onClick={() => onChange(d.id)}>
            {url ? (
              <img
                src={url}
                alt={d.name}
                style={{ width: '100%', height: 120, objectFit: 'cover', display: 'block' }}
              />
            ) : (
              <div
                style={{
                  height: 120,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'var(--panel-2)',
                  color: 'var(--muted)',
                  fontSize: 13,
                  textAlign: 'center',
                  padding: 8,
                }}
              >
                no {side} photo
              </div>
            )}
            <div style={{ fontSize: 13, fontWeight: 700, padding: '6px 8px' }}>{d.name}</div>
          </Tile>
        );
      })}
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
      style={{
        padding: 0,
        overflow: 'hidden',
        background: 'var(--panel)',
        border: '1px solid var(--border)',
        borderRadius: 14,
        outline: selected ? '4px solid var(--accent)' : 'none',
        textAlign: 'left',
      }}
    >
      {children}
    </button>
  );
}
