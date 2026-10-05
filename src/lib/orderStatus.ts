import { supabase } from './supabase';
import type { OrderStatus } from '../types/db';

const TIMEOUT_MS = 10_000;

// Advance an order via set_order_status. Aborts after 10 s so a dead connection
// frees the button. Safe to retry: the RPC is forward-only and no-ops when the
// order is already at or past the target, even if the aborted call landed.
// (Not used for create_order, which is not idempotent.)
export async function setOrderStatus(
  orderId: string,
  status: OrderStatus,
  userId: string | undefined,
): Promise<boolean> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const { error } = await supabase
      .rpc('set_order_status', { p_order_id: orderId, p_status: status, p_user_id: userId })
      .abortSignal(ctrl.signal);
    return !error;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
