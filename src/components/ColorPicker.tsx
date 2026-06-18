import { SHIRT_COLORS } from '../config';

export function ColorPicker({
  value,
  onChange,
  allowed,
}: {
  value: string | null;
  onChange: (key: string) => void;
  allowed?: string[]; // if set, non-allowed colors are dimmed but still selectable
}) {
  return (
    <div className="row">
      {SHIRT_COLORS.map((c) => {
        const selected = value === c.key;
        const dim = allowed && allowed.length > 0 && !allowed.includes(c.key);
        return (
          <button
            key={c.key}
            onClick={() => onChange(c.key)}
            className={selected ? 'btn btn-selected' : 'btn'}
            style={{
              background: c.hex,
              color: c.text,
              minWidth: 92,
              opacity: dim ? 0.4 : 1,
              border: '1px solid var(--border)',
            }}
          >
            {c.label}
          </button>
        );
      })}
    </div>
  );
}
