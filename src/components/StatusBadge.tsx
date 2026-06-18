import { STATUS_COLORS } from '../lib/colors';
import type { OrderStatus } from '../types/db';

export function StatusBadge({ status }: { status: OrderStatus }) {
  const c = STATUS_COLORS[status];
  return (
    <span className="badge" style={{ background: c.bg, color: c.fg }}>
      {c.label}
    </span>
  );
}
