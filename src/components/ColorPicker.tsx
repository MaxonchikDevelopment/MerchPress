import { SHIRT_COLORS } from '../config';

export function ColorPicker({
  value,
  onChange,
  allowed,
}: {
  value: string | null;
  onChange: (key: string) => void;
  allowed?: string[]; // advisory: non-allowed colors are dimmed but still selectable
}) {
  return (
    <div className="row" role="group" aria-label="Shirt color">
      {SHIRT_COLORS.map((c) => {
        const selected = value === c.key;
        const dim = allowed && allowed.length > 0 && !allowed.includes(c.key);
        return (
          <button
            key={c.key}
            onClick={() => onChange(c.key)}
            aria-pressed={selected}
            title={dim ? `${c.label} — not recommended for the selected print (still allowed)` : c.label}
            className={selected ? 'btn btn-selected' : 'btn'}
            style={{
              background: c.hex,
              color: c.text,
              minWidth: 96,
              minHeight: 'var(--touch-min)',
              opacity: dim ? 0.45 : 1,
              border: '1px solid var(--border-strong)',
            }}
          >
            {c.label}
          </button>
        );
      })}
    </div>
  );
}
