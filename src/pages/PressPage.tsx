import { useCallback, useMemo, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { alertNewOrder, SeenSet } from '../lib/notify';
import { useSession } from '../context/SessionContext';
import { useDesigns } from '../hooks/useDesigns';
import { useOrders } from '../hooks/useOrders';
import { OrderCard } from '../components/OrderCard';
import { TopBar, OfflineBanner } from '../components/TopBar';
import type { Order, OrderStatus } from '../types/db';

export function PressPage() {
  const { user, activeEvent } = useSession();
  const eventId = activeEvent?.id ?? null;
  const { designs } = useDesigns(eventId);

  const seenNew = useRef(new SeenSet(`mpq.seenNew.${eventId}`));

  const onNew = useCallback((order: Order) => {
    if (seenNew.current.markIfNew(order.id)) alertNewOrder();
  }, []);

  const onLoaded = useCallback((list: Order[]) => {
    seenNew.current.seed(list.map((o) => o.id)); // don't alert for orders already loaded
  }, []);

  const { orders, connected } = useOrders(eventId, { onNew, onLoaded });

  const queue = useMemo(
    () =>
      orders
        .filter((o) => o.status === 'new' || o.status === 'in_progress')
        .sort((a, b) => a.created_at.localeCompare(b.created_at)), // FIFO
    [orders],
  );

  const setStatus = async (id: string, status: OrderStatus) => {
    await supabase.rpc('set_order_status', {
      p_order_id: id,
      p_status: status,
      p_user_id: user?.id,
    });
  };

  if (!activeEvent) {
    return (
      <div className="app">
        <TopBar title="Press" />
        <div className="content"><div className="card">No active event. Ask an admin to activate one.</div></div>
      </div>
    );
  }

  return (
    <div className="app">
      <TopBar title="Press queue" />
      <OfflineBanner connected={connected} />
      <div className="content">
        <div className="muted" style={{ marginBottom: 12 }}>{queue.length} in queue</div>
        <div
          className="grid"
          style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}
        >
          {queue.map((o) => (
            <OrderCard key={o.id} order={o} designs={designs} showWait>
              {o.status === 'new' ? (
                <button className="btn btn-lg btn-primary" onClick={() => setStatus(o.id, 'in_progress')}>
                  Claim — start printing
                </button>
              ) : (
                <button className="btn btn-lg btn-ok" onClick={() => setStatus(o.id, 'ready')}>
                  ✓ Ready
                </button>
              )}
            </OrderCard>
          ))}
          {queue.length === 0 && <div className="muted">Queue is empty 🎉</div>}
        </div>
      </div>
    </div>
  );
}
