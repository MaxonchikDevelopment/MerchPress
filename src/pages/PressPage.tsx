import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { alertNewOrder, SeenSet } from '../lib/notify';
import { OVERDUE_MINS, waitMinutes } from '../lib/wait';
import { useSession } from '../context/SessionContext';
import { useDesigns } from '../hooks/useDesigns';
import { useOrders, type LoadKind } from '../hooks/useOrders';
import { OrderCard } from '../components/OrderCard';
import { TopBar, OfflineBanner } from '../components/TopBar';
import { EmptyState } from '../components/ui/EmptyState';
import { Spinner } from '../components/ui/Spinner';
import type { Order, OrderStatus } from '../types/db';

export function PressPage() {
  const { user, activeEvent } = useSession();
  const eventId = activeEvent?.id ?? null;
  const { designs } = useDesigns(eventId);

  const seenNew = useMemo(() => new SeenSet(`mpq.seenNew.${eventId}`), [eventId]);
  const [busyIds, setBusyIds] = useState<string[]>([]);
  // Tick so overdue edge/pulse escalates over time (visual only; never re-sorts).
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  const onNew = useCallback(
    (order: Order) => {
      if (seenNew.markIfNew(order.id)) alertNewOrder();
    },
    [seenNew],
  );

  const onLoaded = useCallback(
    (list: Order[], kind: LoadKind) => {
      // Refetch after a gap: one sound for the batch if any 'new' order was missed.
      const missed = kind === 'refetch' && list.some((o) => o.status === 'new' && !seenNew.has(o.id));
      seenNew.seed(list.map((o) => o.id)); // initial load seeds silently
      if (missed) alertNewOrder();
    },
    [seenNew],
  );

  const { orders, connected } = useOrders(eventId, { onNew, onLoaded });

  const queue = useMemo(
    () =>
      orders
        .filter((o) => o.status === 'new' || o.status === 'in_progress')
        .sort((a, b) => a.created_at.localeCompare(b.created_at)), // FIFO
    [orders],
  );

  const setStatus = async (id: string, status: OrderStatus) => {
    if (busyIds.includes(id)) return; // double-tap guard
    setBusyIds((b) => [...b, id]);
    await supabase.rpc('set_order_status', {
      p_order_id: id,
      p_status: status,
      p_user_id: user?.id,
    });
    setBusyIds((b) => b.filter((x) => x !== id));
  };

  if (!activeEvent) {
    return (
      <div className="app">
        <TopBar title="Press" />
        <div className="content"><EmptyState>No active event. Ask an admin to activate one.</EmptyState></div>
      </div>
    );
  }

  return (
    <div className="app">
      <TopBar title="Press queue" />
      <OfflineBanner connected={connected} />
      <div className="content">
        <div className="muted" style={{ marginBottom: 'var(--sp-3)', fontWeight: 600 }} aria-live="polite">
          {queue.length} in queue
        </div>
        <div
          className="grid"
          style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}
        >
          {queue.map((o) => {
            const overdue = waitMinutes(o.new_at) >= OVERDUE_MINS;
            const edgeColor = overdue
              ? 'var(--danger)'
              : o.status === 'new'
                ? 'var(--status-new-bg)'
                : 'var(--status-progress-bg)';
            const busy = busyIds.includes(o.id);
            return (
              <OrderCard key={o.id} order={o} designs={designs} showWait edgeColor={edgeColor} alert={overdue}>
                {o.status === 'new' ? (
                  <button className="btn btn-lg btn-primary" disabled={busy} onClick={() => setStatus(o.id, 'in_progress')}>
                    {busy ? <><Spinner /> …</> : 'Claim — start printing'}
                  </button>
                ) : (
                  <button className="btn btn-lg btn-ok" disabled={busy} onClick={() => setStatus(o.id, 'ready')}>
                    {busy ? <><Spinner /> …</> : '✓ Ready'}
                  </button>
                )}
              </OrderCard>
            );
          })}
          {queue.length === 0 && <EmptyState>Queue is empty 🎉</EmptyState>}
        </div>
      </div>
    </div>
  );
}
