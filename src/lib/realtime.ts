import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { supabase } from './supabase';
import type { Order } from '../types/db';

type OrderPayload = RealtimePostgresChangesPayload<Order>;

export interface OrderChannelHandlers {
  onInsert: (order: Order) => void;
  onUpdate: (next: Order, prev: Order | null) => void;
  onDelete: (id: string) => void;
  // Fired when the socket (re)subscribes after an error/timeout — caller refetches.
  onResubscribe: () => void;
}

// Subscribe to all order changes for one event. Realtime only keeps an
// already-loaded list in sync; callers must load initial state via a query
// and refetch on resubscribe.
export function subscribeOrders(eventId: string, h: OrderChannelHandlers): RealtimeChannel {
  let hadError = false;

  const channel = supabase
    .channel(`orders:${eventId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'orders', filter: `event_id=eq.${eventId}` },
      (payload: OrderPayload) => {
        if (payload.eventType === 'INSERT') {
          h.onInsert(payload.new as Order);
        } else if (payload.eventType === 'UPDATE') {
          const prev = (payload.old && 'id' in payload.old ? (payload.old as Order) : null);
          h.onUpdate(payload.new as Order, prev);
        } else if (payload.eventType === 'DELETE') {
          const old = payload.old as Partial<Order>;
          if (old.id) h.onDelete(old.id);
        }
      },
    )
    .subscribe((status) => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        hadError = true;
      } else if (status === 'SUBSCRIBED' && hadError) {
        hadError = false;
        h.onResubscribe(); // reconnected: refetch to fill any gap
      }
    });

  return channel;
}
