import type { Order } from '../types/db';

export interface CashierCancelNotice {
  orderNo: number;
  by: string | null; // user id of whoever cancelled, null when unknown
}

// Cashier notice for MY order that someone else cancelled. Pure: decides from one realtime
// UPDATE (new row, old row). Silent for another cashier's order, for my own cancel, for an
// order that was not open before (old status not new, in_progress or ready, or unknown), and
// for any other change. Visual only; it never touches queue state or alerts.
export function cashierCancelNotice(
  prev: Order | null,
  next: Order,
  myId: string | undefined,
): CashierCancelNotice | null {
  if (!myId || next.created_by !== myId) return null;
  if (next.status !== 'cancelled') return null;
  if (!prev || (prev.status !== 'new' && prev.status !== 'in_progress' && prev.status !== 'ready')) return null;
  if (next.cancelled_by === myId) return null;
  return { orderNo: next.event_order_no, by: next.cancelled_by };
}
