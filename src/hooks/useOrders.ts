import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { subscribeOrders } from '../lib/realtime';
import type { Order } from '../types/db';

export type LoadKind = 'initial' | 'refetch';

interface Options {
  // Fired for a brand-new order (INSERT).
  onNew?: (order: Order) => void;
  // Fired when an order transitions into 'ready'.
  onReady?: (order: Order) => void;
  // Called after every successful query with the full list. `initial` is the
  // first successful load for this event (seed dedupe sets silently);
  // `refetch` covers any later one (alert for what was missed during a gap).
  onLoaded?: (orders: Order[], kind: LoadKind) => void;
}

const POLL_MS = 20_000;

// Loads all orders for an event via query, then keeps them in sync via Realtime.
// Initial state always comes from the query. Refetches run on resubscribe, when
// the tab becomes visible, when the browser comes back online, and every 20 s
// while the tab is visible.
export function useOrders(eventId: string | null, opts: Options = {}) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [subscribed, setSubscribed] = useState(false);
  const [online, setOnline] = useState(() => navigator.onLine);
  const [fetchOk, setFetchOk] = useState(true);

  // Keep latest callbacks without re-subscribing.
  const cb = useRef(opts);
  useEffect(() => {
    cb.current = opts;
  });

  const eventRef = useRef(eventId);
  const hasLoaded = useRef(false);
  const reqSeq = useRef(0); // issued request ids
  const appliedSeq = useRef(0); // highest request id already applied

  const reload = useCallback(async () => {
    if (!eventId) {
      setOrders([]);
      setLoading(false);
      return;
    }
    const seq = ++reqSeq.current;
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('event_id', eventId)
      .order('created_at', { ascending: true });
    // Drop responses for another event or older than one already applied.
    if (eventRef.current !== eventId || seq < appliedSeq.current) return;
    if (error || !data) {
      // Keep the current list; the banner shows until a refetch succeeds.
      setFetchOk(false);
      return;
    }
    appliedSeq.current = seq;
    const list = data as Order[];
    const kind: LoadKind = hasLoaded.current ? 'refetch' : 'initial';
    hasLoaded.current = true;
    setOrders(list);
    setLoading(false);
    setFetchOk(true);
    cb.current.onLoaded?.(list, kind);
  }, [eventId]);

  useEffect(() => {
    eventRef.current = eventId;
    if (!eventId) return;
    hasLoaded.current = false;
    appliedSeq.current = reqSeq.current; // anything in flight for the old event is stale
    setLoading(true);
    setOrders([]);
    setFetchOk(true);
    void reload();

    let disposed = false;
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
      onStatus: (status) => {
        if (disposed) return;
        setSubscribed(status === 'SUBSCRIBED');
      },
    });

    const refetchIfVisible = () => {
      if (document.visibilityState === 'visible') void reload();
    };
    const onOnline = () => {
      setOnline(true);
      void reload();
    };
    const onOffline = () => setOnline(false);
    const timer = setInterval(refetchIfVisible, POLL_MS);
    document.addEventListener('visibilitychange', refetchIfVisible);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    return () => {
      disposed = true;
      setSubscribed(false);
      clearInterval(timer);
      document.removeEventListener('visibilitychange', refetchIfVisible);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      void supabase.removeChannel(channel);
    };
  }, [eventId, reload]);

  // Real connection state: socket subscribed, browser online, last query ok.
  const connected = subscribed && online && fetchOk;

  return { orders, loading, connected, reload };
}
