import type { Order } from '../types/db';

// Number shown on the Queue tab: Ready orders created by this cashier.
export function readyBadgeCount(orders: Pick<Order, 'status' | 'created_by'>[], userId: string | undefined): number {
  if (!userId) return 0;
  return orders.filter((o) => o.status === 'ready' && o.created_by === userId).length;
}
