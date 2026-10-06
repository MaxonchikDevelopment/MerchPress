import type { Order } from '../types/db';

export interface CashierQueue {
  inProgress: Order[]; // my new and in-progress orders, FIFO by created_at
  ready: Order[]; // my ready orders, oldest ready first
}

// What a cashier sees in the Queue tab: only orders that cashier created, nothing from
// other cashiers. Pure and interface-only: the server does not check who cancels or
// completes an order. Closed orders (completed, cancelled) are never listed.
export function cashierQueue(orders: Order[], myId: string | undefined): CashierQueue {
  if (!myId) return { inProgress: [], ready: [] };
  const mine = orders.filter((o) => o.created_by === myId);
  return {
    inProgress: mine
      .filter((o) => o.status === 'new' || o.status === 'in_progress')
      .sort((a, b) => a.created_at.localeCompare(b.created_at)),
    ready: mine.filter((o) => o.status === 'ready').sort((a, b) => (a.ready_at ?? '').localeCompare(b.ready_at ?? '')),
  };
}
