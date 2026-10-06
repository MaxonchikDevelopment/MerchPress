import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { claimOrder, setOrderStatus, staffName } from '../lib/orderStatus';
import { alertNewOrder, SeenSet } from '../lib/notify';
import { cancelNotice, NOTICE_MS } from '../lib/cancelNotice';
import { OVERDUE_MINS, waitMinutes } from '../lib/wait';
import { useSession } from '../context/SessionContext';
import { useDesigns } from '../hooks/useDesigns';
import { useOrders, type LoadKind } from '../hooks/useOrders';
import { useCancelOrder } from '../hooks/useCancelOrder';
import { OrderCard } from '../components/OrderCard';
import { TopBar, TopBlock, OfflineBanner } from '../components/TopBar';
import { SoundGate } from '../components/SoundGate';
import { Toast } from '../components/ui/Toast';
import { EmptyState } from '../components/ui/EmptyState';
import { Spinner } from '../components/ui/Spinner';
import type { Order, OrderStatus } from '../types/db';
import { BuildTag } from '../components/BuildTag';

export function PressPage() {
  const { user, activeEvent } = useSession();
  const eventId = activeEvent?.id ?? null;
  const { designs } = useDesigns(eventId);

  const seenNew = useMemo(() => new SeenSet(`mpq.seenNew.${eventId}`), [eventId]);
  const [busyIds, setBusyIds] = useState<string[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // Cancel notices live apart from the error toast so neither overwrites the other.
  const [notices, setNotices] = useState<{ key: string; text: string }[]>([]);
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

  const dismissNotice = useCallback((key: string) => setNotices((l) => l.filter((n) => n.key !== key)), []);
  const userId = user?.id;
  const onCancelled = useCallback(
    async (next: Order, prev: Order | null) => {
      const n = cancelNotice(prev, next, userId);
      if (!n) return;
      const name = n.by ? await staffName(n.by) : null;
      const text = `Order #${n.orderNo} cancelled by ${name ?? 'someone'}`;
      setNotices((l) => [...l.filter((x) => x.key !== next.id), { key: next.id, text }]);
      setTimeout(() => dismissNotice(next.id), NOTICE_MS);
    },
    [userId, dismissNotice],
  );

  const { orders, connected, reload } = useOrders(eventId, { onNew, onLoaded, onCancelled });

  const showError = useCallback((message: string) => {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 5000);
  }, []);
  const { askCancel, dialog: cancelDialog } = useCancelOrder(user?.id, showError, () => void reload());

  const queue = useMemo(
    () =>
      orders
        .filter((o) => o.status === 'new' || o.status === 'in_progress')
        .sort((a, b) => a.created_at.localeCompare(b.created_at)), // FIFO
    [orders],
  );

  const setStatus = async (order: Order, status: OrderStatus) => {
    const id = order.id;
    if (busyIds.includes(id)) return; // double-tap guard
    setBusyIds((b) => [...b, id]);
    if (status === 'in_progress') {
      const res = await claimOrder(id, user?.id);
      if (res.kind === 'taken') {
        const name = (await staffName(res.by)) ?? 'another press station';
        setBusyIds((b) => b.filter((x) => x !== id));
        showError(`Already taken by ${name}`);
        void reload();
        return;
      }
      if (res.kind === 'closed') {
        setBusyIds((b) => b.filter((x) => x !== id));
        showError('Order is already closed');
        void reload();
        return;
      }
      setBusyIds((b) => b.filter((x) => x !== id));
      if (res.kind === 'failed') {
        showError(`Couldn't update order #${order.event_order_no}. Check the connection and tap again.`);
      }
      return;
    }
    const ok = await setOrderStatus(id, status, user?.id);
    setBusyIds((b) => b.filter((x) => x !== id));
    if (!ok) showError(`Couldn't update order #${order.event_order_no}. Check the connection and tap again.`);
  };

  if (!activeEvent) {
    return (
      <div className="app">
        <TopBlock><TopBar title="Press" /></TopBlock>
        <div className="content"><EmptyState>No active event. Ask an admin to activate one.</EmptyState></div>
      </div>
    );
  }

  return (
    <div className="app">
      <TopBlock>
        <TopBar title="Press queue" soundRetry />
        <OfflineBanner connected={connected} />
      </TopBlock>
      <div className="content">
        {toast && <div style={{ marginBottom: 'var(--sp-3)' }}><Toast message={toast} tone="error" /></div>}
        {notices.map((n) => (
          <div
            key={n.key}
            className="toast toast-error"
            role="status"
            style={{ marginBottom: 'var(--sp-3)', justifyContent: 'space-between' }}
          >
            <span>{n.text}</span>
            <button className="btn btn-text" onClick={() => dismissNotice(n.key)}>Dismiss</button>
          </div>
        ))}
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
              <OrderCard key={o.id} order={o} designs={designs} showWait edgeColor={edgeColor} alert={overdue} showClaimedBy>
                {o.status === 'new' ? (
                  <button className="btn btn-lg btn-primary" disabled={busy} onClick={() => setStatus(o, 'in_progress')}>
                    {busy ? <><Spinner /> …</> : 'Claim — start printing'}
                  </button>
                ) : (
                  <button className="btn btn-lg btn-ok" disabled={busy} onClick={() => setStatus(o, 'ready')}>
                    {busy ? <><Spinner /> …</> : '✓ Ready'}
                  </button>
                )}
                <button className="btn btn-text" disabled={busy} onClick={() => askCancel(o)}>Cancel order</button>
              </OrderCard>
            );
          })}
          {queue.length === 0 && <EmptyState>Queue is empty 🎉</EmptyState>}
        </div>
        <BuildTag />
      </div>
      <SoundGate />
      {cancelDialog}
    </div>
  );
}
