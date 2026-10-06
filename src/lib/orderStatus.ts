import { supabase } from './supabase';
import type { Order, OrderStatus } from '../types/db';
import { classifyClaim, type ClaimResult } from './claimResult';

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

export type { ClaimResult };

// Claim an order for userId. 'claimed' also covers a safe retry of an aborted
// call that actually landed (same claimed_by).
export async function claimOrder(orderId: string, userId: string | undefined): Promise<ClaimResult> {
  return classifyClaim(await callSetOrderStatus(orderId, 'in_progress', userId), userId);
}

// Name of a staff member. `ok` is false only when the read itself failed; a person that
// staff_v does not list (deactivated) is ok with a null name.
export async function staffNameLookup(id: string): Promise<{ name: string | null; ok: boolean }> {
  try {
    const { data, error } = await supabase.from('staff_v').select('name').eq('id', id).maybeSingle();
    if (error) return { name: null, ok: false };
    return { name: (data as { name: string } | null)?.name ?? null, ok: true };
  } catch {
    return { name: null, ok: false };
  }
}

// Name of a staff member, looked up only after a lost claim. Null on any failure.
export async function staffName(id: string | null): Promise<string | null> {
  if (!id) return null;
  return (await staffNameLookup(id)).name;
}

export type CancelResult = 'cancelled' | 'already_closed' | 'failed';

// Cancel an order. If the returned row is not cancelled, the order was already
// completed (or otherwise closed) and the cancel was a no-op.
export async function cancelOrder(orderId: string, userId: string | undefined): Promise<CancelResult> {
  const row = await callSetOrderStatus(orderId, 'cancelled', userId);
  if (!row) return 'failed';
  return row.status === 'cancelled' ? 'cancelled' : 'already_closed';
}
