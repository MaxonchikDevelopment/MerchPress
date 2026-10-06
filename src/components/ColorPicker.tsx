import type { EffectiveColor } from '../lib/eventOptions';

export function ColorPicker({
  colors,
  value,
  onChange,
  dimmed = [],
}: {
  colors: EffectiveColor[];
  value: string | null;
  onChange: (key: string) => void;
  dimmed?: string[]; // advisory (custom print): dimmed but still selectable. Callers hide colours by omitting them from `colors`.
}) {
  return (
    <div className="row" role="group" aria-label="Shirt color">
      {colors.map((c) => {
        const selected = value === c.key;
        const dim = dimmed.includes(c.key);
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
              opacity: dim ? 'var(--dim-opacity)' : 1,
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
