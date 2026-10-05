import { supabase } from './supabase';
import type { Order, ShirtSize } from '../types/db';

const TIMEOUT_MS = 12_000;

export interface NewOrderInput {
  eventId: string;
  color: string;
  size: ShirtSize;
  frontId: string | null;
  backId: string | null;
  clientName: string;
  userId: string | undefined;
  userName: string | undefined;
  requestId: string;
}

// Create an order via create_order_v2. The same requestId always yields the same
// order, so a retry after a timeout or dropped response never creates a second
// one. Aborts after 12 s. Returns null when the result is not confirmed.
export async function createOrder(input: NewOrderInput): Promise<Order | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const { data, error } = await supabase
      .rpc('create_order_v2', {
        p_event_id: input.eventId,
        p_shirt_color: input.color,
        p_shirt_size: input.size,
        p_design_front_id: input.frontId,
        p_design_back_id: input.backId,
        p_client_name: input.clientName,
        p_created_by: input.userId,
        p_cashier_key: input.userId,
        p_cashier_name: input.userName,
        p_client_request_id: input.requestId,
      })
      .abortSignal(ctrl.signal);
    if (error || !data) return null;
    return data as Order;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
