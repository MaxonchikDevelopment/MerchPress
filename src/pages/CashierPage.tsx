import { useCallback, useMemo, useRef, useState } from 'react';
import { createOrder } from '../lib/createOrder';
import { setOrderStatus } from '../lib/orderStatus';
import { alertReady, SeenSet } from '../lib/notify';
import { useSession } from '../context/SessionContext';
import { useDesigns } from '../hooks/useDesigns';
import { useOrders, type LoadKind } from '../hooks/useOrders';
import { ColorPicker } from '../components/ColorPicker';
import { SizePicker } from '../components/SizePicker';
import { DesignPicker } from '../components/DesignPicker';
import { OrderCard } from '../components/OrderCard';
import { SoundGate } from '../components/SoundGate';
import { AlertOverlay } from '../components/AlertOverlay';
import { TopBar, OfflineBanner } from '../components/TopBar';
import { SectionLabel } from '../components/ui/SectionLabel';
import { EmptyState } from '../components/ui/EmptyState';
import { Toast } from '../components/ui/Toast';
import { Spinner } from '../components/ui/Spinner';
import type { Order, ShirtSize } from '../types/db';

export function CashierPage() {
  const { user, activeEvent } = useSession();
  const eventId = activeEvent?.id ?? null;
  const { designs } = useDesigns(eventId);

  // Dedupe ready alerts across refresh/reconnect (per cashier+event).
  const userId = user?.id;
  const seenReady = useMemo(() => new SeenSet(`mpq.seenReady.${userId}.${eventId}`), [userId, eventId]);
  const [overlay, setOverlay] = useState<{ title: string; subtitle?: string } | null>(null);
  const [completing, setCompleting] = useState<string[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const onReady = useCallback(
    (order: Order) => {
      if (order.created_by !== userId) return; // only my own orders sound
      if (!seenReady.markIfNew(order.id)) return; // already alerted
      alertReady();
      setOverlay({
        title: `Order #${order.event_order_no} ready`,
        subtitle: order.client_name ?? undefined,
      });
    },
    [userId, seenReady],
  );

  const onLoaded = useCallback(
    (list: Order[], kind: LoadKind) => {
      const mine = list.filter((o) => o.status === 'ready' && o.created_by === userId);
      if (kind === 'initial') {
        // Seed dedupe with orders already ready for me so a refresh won't re-alert.
        seenReady.seed(mine.map((o) => o.id));
        return;
      }
      // Refetch after a gap: one alert for the batch of my orders that went ready unseen.
      const missed = mine.filter((o) => seenReady.markIfNew(o.id));
      if (missed.length === 0) return;
      alertReady();
      setOverlay(
        missed.length === 1
          ? {
              title: `Order #${missed[0].event_order_no} ready`,
              subtitle: missed[0].client_name ?? undefined,
            }
          : { title: `Orders ${missed.map((o) => `#${o.event_order_no}`).join(', ')} ready` },
      );
    },
    [userId, seenReady],
  );

  const { orders, connected } = useOrders(eventId, { onReady, onLoaded });

  const readyOrders = useMemo(
    () =>
      orders
        .filter((o) => o.status === 'ready')
        .sort((a, b) => {
          // My orders first, then FIFO by ready time.
          const mineA = a.created_by === user?.id ? 0 : 1;
          const mineB = b.created_by === user?.id ? 0 : 1;
          if (mineA !== mineB) return mineA - mineB;
          return (a.ready_at ?? '').localeCompare(b.ready_at ?? '');
        }),
    [orders, user?.id],
  );

  const complete = async (order: Order) => {
    const id = order.id;
    if (completing.includes(id)) return; // double-tap guard
    setCompleting((c) => [...c, id]);
    const ok = await setOrderStatus(id, 'completed', user?.id);
    setCompleting((c) => c.filter((x) => x !== id));
    if (!ok) {
      setToast(`Couldn't update order #${order.event_order_no}. Check the connection and tap again.`);
      clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setToast(null), 5000);
    }
  };

  if (!activeEvent) {
    return (
      <div className="app">
        <TopBar title="Cashier" />
        <div className="content"><EmptyState>No active event. Ask an admin to activate one.</EmptyState></div>
      </div>
    );
  }

  return (
    <div className="app">
      <TopBar title="Cashier" soundRetry />
      <OfflineBanner connected={connected} />
      <div className="content page-enter" style={{ maxWidth: 1100, margin: '0 auto', width: '100%' }}>
        <div className="two-col">
          <NewOrderForm designs={designs} />

          <section>
            {toast && <div style={{ marginBottom: 'var(--sp-3)' }}><Toast message={toast} tone="error" /></div>}
            <SectionLabel>Ready for pickup · {readyOrders.length}</SectionLabel>
            <div className="grid" style={{ gridTemplateColumns: '1fr' }}>
              {readyOrders.map((o) => (
                <OrderCard key={o.id} order={o} designs={designs} highlight={o.created_by === user?.id}>
                  <button
                    className="btn btn-lg btn-ok"
                    disabled={completing.includes(o.id)}
                    onClick={() => complete(o)}
                  >
                    {completing.includes(o.id) ? <><Spinner /> Confirming…</> : '✓ Picked up'}
                  </button>
                </OrderCard>
              ))}
              {readyOrders.length === 0 && <EmptyState>Nothing ready yet.</EmptyState>}
            </div>
          </section>
        </div>
      </div>

      <SoundGate />
      {overlay && (
        <AlertOverlay title={overlay.title} subtitle={overlay.subtitle} onDismiss={() => setOverlay(null)} />
      )}
    </div>
  );
}

function NewOrderForm({ designs }: { designs: ReturnType<typeof useDesigns>['designs'] }) {
  const { user, activeEvent } = useSession();
  const [color, setColor] = useState<string | null>(null);
  const [size, setSize] = useState<ShirtSize | null>(null);
  const [frontId, setFrontId] = useState<string | null>(null);
  const [backId, setBackId] = useState<string | null>(null);
  const [clientName, setClientName] = useState('');
  const [busy, setBusy] = useState(false);
  const requestId = useRef<{ id: string; eventId: string } | null>(null); // idempotency key of the current draft
  const [toast, setToast] = useState<{ msg: string; tone: 'success' | 'error' } | null>(null);

  const allowedColors = useMemo(() => {
    const chosen = designs.filter((d) => d.id === frontId || d.id === backId);
    if (chosen.length === 0) return undefined;
    // intersection of compatible colors across chosen designs
    return chosen
      .map((d) => d.compatible_colors)
      .reduce((acc, cur) => acc.filter((c) => cur.includes(c)));
  }, [designs, frontId, backId]);

  const canSubmit = color && size && !busy;

  const submit = async () => {
    if (!canSubmit || !activeEvent) return;
    setBusy(true);
    // One id per draft, reused on every retry; renewed only after success (or an event switch).
    if (requestId.current?.eventId !== activeEvent.id) {
      requestId.current = { id: crypto.randomUUID(), eventId: activeEvent.id };
    }
    const order = await createOrder({
      eventId: activeEvent.id,
      color,
      size,
      frontId,
      backId,
      clientName,
      userId: user?.id,
      userName: user?.name,
      requestId: requestId.current.id,
    });
    setBusy(false);
    if (!order) {
      setToast({ msg: 'Not confirmed. Tap Send again.', tone: 'error' });
      return;
    }
    requestId.current = null;
    setToast({ msg: `Sent to press — Order #${order.event_order_no}`, tone: 'success' });
    setColor(null);
    setSize(null);
    setFrontId(null);
    setBackId(null);
    setClientName('');
    setTimeout(() => setToast(null), 2500);
  };

  return (
    <section className="card grid" style={{ gap: 'var(--sp-5)', alignSelf: 'start' }}>
      <h2 style={{ margin: 0 }}>New order</h2>

      <div>
        <SectionLabel>Shirt color</SectionLabel>
        <ColorPicker value={color} onChange={setColor} allowed={allowedColors} />
      </div>
      <div>
        <SectionLabel>Size</SectionLabel>
        <SizePicker value={size} onChange={setSize} />
      </div>
      <div>
        <SectionLabel>Front print</SectionLabel>
        <DesignPicker designs={designs} side="front" value={frontId} onChange={setFrontId} />
      </div>
      <div>
        <SectionLabel>Back print</SectionLabel>
        <DesignPicker designs={designs} side="back" value={backId} onChange={setBackId} />
      </div>
      <div>
        <SectionLabel>Client name (optional)</SectionLabel>
        <input
          value={clientName}
          onChange={(e) => setClientName(e.target.value)}
          placeholder="e.g. Anna"
          aria-label="Client name (optional)"
          inputMode="text"
          enterKeyHint="done"
          autoComplete="off"
          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
          style={{ width: '100%' }}
        />
      </div>

      <button className="btn btn-lg btn-primary" disabled={!canSubmit} onClick={submit}>
        {busy ? <><Spinner /> Sending…</> : 'Send to press →'}
      </button>
      {toast && <Toast message={toast.msg} tone={toast.tone} />}
    </section>
  );
}
