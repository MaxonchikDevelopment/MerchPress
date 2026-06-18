import { SHIRT_SIZES } from '../config';
import type { ShirtSize } from '../types/db';

export function SizePicker({
  value,
  onChange,
}: {
  value: ShirtSize | null;
  onChange: (size: ShirtSize) => void;
}) {
  return (
    <div className="row">
      {SHIRT_SIZES.map((s) => (
        <button
          key={s}
          onClick={() => onChange(s)}
          className={value === s ? 'btn btn-primary btn-selected' : 'btn'}
          style={{ minWidth: 72 }}
        >
          {s}
        </button>
      ))}
    </div>
  );
}
