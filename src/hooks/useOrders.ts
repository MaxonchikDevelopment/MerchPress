import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { subscribeOrders } from '../lib/realtime';
import type { Order } from '../types/db';

interface Options {
  // Fired for a brand-new order (INSERT).
  onNew?: (order: Order) => void;
  // Fired when an order transitions into 'ready'.
  onReady?: (order: Order) => void;
  // Called after initial load and every refetch, with the full list — use to
  // seed dedupe sets so existing orders don't trigger alerts.
  onLoaded?: (orders: Order[]) => void;
}

// Loads all orders for an event via query, then keeps them in sync via Realtime.
// Initial state always comes from the query; reconnect triggers a refetch.
export function useOrders(eventId: string | null, opts: Options = {}) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);

  // Keep latest callbacks without re-subscribing.
  const cb = useRef(opts);
  useEffect(() => {
    cb.current = opts;
  });

  const reload = useCallback(async () => {
    if (!eventId) {
      setOrders([]);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from('orders')
      .select('*')
      .eq('event_id', eventId)
      .order('created_at', { ascending: true });
    const list = (data as Order[]) ?? [];
    setOrders(list);
    setLoading(false);
    cb.current.onLoaded?.(list);
  }, [eventId]);

  useEffect(() => {
    if (!eventId) return;
    setLoading(true);
    void reload();

    const channel = subscribeOrders(eventId, {
      onInsert: (order) => {
        setOrders((prev) =>
          prev.some((o) => o.id === order.id) ? prev : [...prev, order],
        );
        cb.current.onNew?.(order);
      },
      onUpdate: (next, prev) => {
        setOrders((cur) => cur.map((o) => (o.id === next.id ? next : o)));
        if (next.status === 'ready' && prev?.status !== 'ready') {
          cb.current.onReady?.(next);
        }
      },
      onDelete: (id) => setOrders((cur) => cur.filter((o) => o.id !== id)),
      onResubscribe: () => void reload(),
    });

    setConnected(true);
    return () => {
      setConnected(false);
      void supabase.removeChannel(channel);
    };
  }, [eventId, reload]);

  return { orders, loading, connected, reload };
}
