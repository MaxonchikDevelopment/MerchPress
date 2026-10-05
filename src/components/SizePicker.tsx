import type { ShirtSize } from '../types/db';

export function SizePicker({
  sizes,
  value,
  onChange,
}: {
  sizes: ShirtSize[];
  value: ShirtSize | null;
  onChange: (size: ShirtSize) => void;
}) {
  return (
    <div className="row" role="group" aria-label="Shirt size">
      {sizes.map((s) => (
        <button
          key={s}
          onClick={() => onChange(s)}
          aria-pressed={value === s}
          className={value === s ? 'btn btn-primary btn-selected' : 'btn'}
          style={{ minWidth: 72, minHeight: 'var(--touch-min)' }}
        >
          {s}
        </button>
      ))}
    </div>
  );
}
