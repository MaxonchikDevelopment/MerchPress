import { supabase } from './supabase';
import type { Order, OrderStatus } from '../types/db';

const TIMEOUT_MS = 10_000;

// Call set_order_status and return the resulting row, or null on any failure.
// Aborts after 10 s so a dead connection frees the button. Safe to retry: the
// RPC is forward-only and no-ops when the order is already at or past the
// target (or closed), even if the aborted call landed.
async function callSetOrderStatus(
  orderId: string,
  status: OrderStatus,
  userId: string | undefined,
): Promise<Order | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const { data, error } = await supabase
      .rpc('set_order_status', { p_order_id: orderId, p_status: status, p_user_id: userId })
      .abortSignal(ctrl.signal);
    if (error) return null;
    return (data as Order | null) ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// Advance an order. Returns true when the call succeeded.
export async function setOrderStatus(
  orderId: string,
  status: OrderStatus,
  userId: string | undefined,
): Promise<boolean> {
  return (await callSetOrderStatus(orderId, status, userId)) !== null;
}

export type CancelResult = 'cancelled' | 'already_closed' | 'failed';

// Cancel an order. If the returned row is not cancelled, the order was already
// completed (or otherwise closed) and the cancel was a no-op.
export async function cancelOrder(orderId: string, userId: string | undefined): Promise<CancelResult> {
  const row = await callSetOrderStatus(orderId, 'cancelled', userId);
  if (!row) return 'failed';
  return row.status === 'cancelled' ? 'cancelled' : 'already_closed';
}
