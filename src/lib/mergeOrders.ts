import type { Order } from '../types/db';

const CLOSED = new Set<string>(['completed', 'cancelled']);

// Overlay what realtime delivered while a refetch was in flight onto that
// refetch's snapshot, so an older snapshot never drops fresher data.
// - upserts win over the snapshot row with the same id, and are added if missing
// - deleted ids stay deleted
// - closed orders are dropped, matching the status filter of the query
// Result is FIFO by created_at.
export function mergeOrders(
  snapshot: Order[],
  upserts: Iterable<Order>,
  deletes: Iterable<string>,
): Order[] {
  const byId = new Map<string, Order>();
  for (const o of snapshot) byId.set(o.id, o);
  for (const o of upserts) byId.set(o.id, o);
  for (const id of deletes) byId.delete(id);
  const open = [...byId.values()].filter((o) => !CLOSED.has(o.status));
  // Stable sort; the snapshot is already ordered, so it only moves added rows.
  return open.sort((a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0));
}
