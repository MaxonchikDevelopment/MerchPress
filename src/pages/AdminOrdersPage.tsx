import { useCallback, useMemo, useRef, useState } from 'react';
import { adminOrderList, ORDERS_FILTERS, type OrdersFilter } from '../lib/adminOrders';
import { setOrderStatus } from '../lib/orderStatus';
import { useSession } from '../context/SessionContext';
import { useDesigns } from '../hooks/useDesigns';
import { useOrders } from '../hooks/useOrders';
import { useCancelOrder } from '../hooks/useCancelOrder';
import { OrderCard } from '../components/OrderCard';
import { EmptyState } from '../components/ui/EmptyState';
import { Toast } from '../components/ui/Toast';
import { Spinner } from '../components/ui/Spinner';
import type { Order } from '../types/db';

const FILTER_LABELS: Record<OrdersFilter, string> = {
  all: 'All',
  new: 'New',
  in_progress: 'In progress',
  ready: 'Ready',
};

// Every active order of the active event, live, for an admin to step in (cancel, or hand
// over a ready order). No sounds, alerts or notices here: useOrders gets no callbacks.
// The rules about who may act are interface only; set_order_status does not check the caller.
export function AdminOrdersPage() {
  const { user, activeEvent } = useSession();
  const eventId = activeEvent?.id ?? null;
  const { designs } = useDesigns(eventId);
  const { orders, reload } = useOrders(eventId);

  const [filter, setFilter] = useState<OrdersFilter>('all');
  const [completing, setCompleting] = useState<string[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const showError = useCallback((message: string) => {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 5000);
  }, []);
  // cancelled_by becomes the admin, so the cashier and press notices fire as for any cancel.
  const { askCancel, dialog } = useCancelOrder(user?.id, showError, () => void reload());

  const { list, counts } = useMemo(() => adminOrderList(orders, filter), [orders, filter]);

  const pickedUp = async (order: Order) => {
    if (completing.includes(order.id)) return; // double-tap guard
    setCompleting((c) => [...c, order.id]);
    const ok = await setOrderStatus(order.id, 'completed', user?.id);
    setCompleting((c) => c.filter((x) => x !== order.id));
    if (!ok) showError(`Couldn't update order #${order.event_order_no}. Check the connection and tap again.`);
    else void reload(); // the card leaves even if realtime is down
  };

  if (!activeEvent) return <EmptyState>No active event. Activate one in Events.</EmptyState>;

  return (
    <div style={{ display: 'grid', gap: 'var(--sp-4)' }}>
      <div className="orders-filter" role="group" aria-label="Filter orders">
        {ORDERS_FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            className={filter === f ? 'orders-chip orders-chip-active' : 'orders-chip'}
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
          >
            {FILTER_LABELS[f]} · {counts[f]}
          </button>
        ))}
      </div>
      {toast && <div className="toast-sticky"><Toast message={toast} tone="error" /></div>}
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
        {list.map((o) => (
          <OrderCard key={o.id} order={o} designs={designs} showWait showClaimedBy>
            {o.status === 'ready' && (
              <button className="btn btn-lg btn-ok" disabled={completing.includes(o.id)} onClick={() => void pickedUp(o)}>
                {completing.includes(o.id) ? <><Spinner /> Confirming…</> : '✓ Picked up'}
              </button>
            )}
            <button className="btn btn-danger-outline" disabled={completing.includes(o.id)} onClick={() => askCancel(o)}>
              Cancel order
            </button>
          </OrderCard>
        ))}
        {list.length === 0 && <EmptyState>{filter === 'all' ? 'No active orders.' : 'No orders in this state.'}</EmptyState>}
      </div>
      {dialog}
    </div>
  );
}
