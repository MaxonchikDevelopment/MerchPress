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
            aria-label={dim ? `${c.label}, not recommended for this print` : undefined}
            title={dim ? `${c.label} — not recommended for the selected print (still allowed)` : c.label}
            className={`btn swatch${selected ? ' swatch-selected' : ''}${dim ? ' swatch-dim' : ''}`}
            style={{ background: c.hex, color: c.text }}
          >
            {selected ? `✓ ${c.label}` : c.label}
          </button>
        );
      })}
    </div>
  );
}
