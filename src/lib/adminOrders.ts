import type { Order } from '../types/db';

export type OrdersFilter = 'all' | 'new' | 'in_progress' | 'ready';

export const ORDERS_FILTERS: OrdersFilter[] = ['all', 'new', 'in_progress', 'ready'];

// Ready first (to hand out), then in progress, then new.
const GROUP_RANK = { ready: 0, in_progress: 1, new: 2 } as const;

export interface AdminOrderList {
  list: Order[]; // after the filter, grouped and sorted
  counts: Record<OrdersFilter, number>; // per chip, over all active orders
}

// Admin Orders screen: every active order of the event, filtered by chip, Ready then
// In progress then New, oldest created_at first inside a group. Closed orders never show.
// Pure; the input list is not reordered.
export function adminOrderList(orders: Order[], filter: OrdersFilter): AdminOrderList {
  const active = orders.filter((o) => o.status === 'new' || o.status === 'in_progress' || o.status === 'ready');
  const counts: Record<OrdersFilter, number> = {
    all: active.length,
    new: active.filter((o) => o.status === 'new').length,
    in_progress: active.filter((o) => o.status === 'in_progress').length,
    ready: active.filter((o) => o.status === 'ready').length,
  };
  const list = active
    .filter((o) => filter === 'all' || o.status === filter)
    .sort(
      (a, b) =>
        GROUP_RANK[a.status as keyof typeof GROUP_RANK] - GROUP_RANK[b.status as keyof typeof GROUP_RANK] ||
        a.created_at.localeCompare(b.created_at),
    );
  return { list, counts };
}
