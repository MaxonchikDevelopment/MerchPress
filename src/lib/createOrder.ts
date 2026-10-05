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

export type CreateOrderResult =
  | { ok: true; order: Order }
  | { ok: false; kind: 'network' } // timeout, no connection or an unclear server failure: may have landed
  | { ok: false; kind: 'rejected'; message: string }; // the server answered and refused

// Create an order via create_order_v2. The same requestId always yields the same
// order, so a retry after a timeout or dropped response never creates a second
// one. Aborts after 12 s. A network failure or timeout is told apart from a server
// rejection: only the latter is known not to have created the order.
export async function createOrder(input: NewOrderInput): Promise<CreateOrderResult> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const { data, error, status } = await supabase
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
    // status 0: fetch failed or aborted. 5xx: a gateway or server fault, outcome unclear.
    if (error) {
      if (status === 0 || status >= 500) return { ok: false, kind: 'network' };
      return { ok: false, kind: 'rejected', message: error.message };
    }
    if (!data) return { ok: false, kind: 'network' };
    return { ok: true, order: data as Order };
  } catch {
    return { ok: false, kind: 'network' };
  } finally {
    clearTimeout(timer);
  }
}
