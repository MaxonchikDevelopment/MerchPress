import type { Order } from '../types/db';

export interface CancelNotice {
  orderNo: number;
  by: string | null; // user id of whoever cancelled, null when unknown
}

// Press notice for an order that left the queue because someone else cancelled it.
// Pure: decides from one realtime UPDATE (new row, old row), shows nothing for my own
// cancel, for an order press could not see (old status not new/in_progress, or unknown),
// or for any other change. Visual only; it never touches queue state or alerts.
export function cancelNotice(prev: Order | null, next: Order, myId: string | undefined): CancelNotice | null {
  if (next.status !== 'cancelled') return null;
  if (!prev || (prev.status !== 'new' && prev.status !== 'in_progress')) return null;
  if (next.cancelled_by && next.cancelled_by === myId) return null;
  return { orderNo: next.event_order_no, by: next.cancelled_by };
}
