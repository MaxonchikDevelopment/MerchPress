import { useCallback, useMemo, useRef, useState } from 'react';
import { readyBadgeCount } from '../lib/readyBadge';
import { orderSummary } from '../lib/orderSummary';
import { eventOptions } from '../lib/eventOptions';
import { createOrder } from '../lib/createOrder';
import { setOrderStatus } from '../lib/orderStatus';
import { alertReady, SeenSet } from '../lib/notify';
import { sendHint } from '../lib/sendHint';
import { useSession } from '../context/SessionContext';
import { useDesigns } from '../hooks/useDesigns';
import { useOrders, type LoadKind } from '../hooks/useOrders';
import { useCancelOrder } from '../hooks/useCancelOrder';
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

type CashierTab = 'new' | 'queue';

export function CashierPage() {
  const { user, activeEvent } = useSession();
  const eventId = activeEvent?.id ?? null;
  const { designs, activeDesigns } = useDesigns(eventId);

  // Dedupe ready alerts across refresh/reconnect (per cashier+event).
  const userId = user?.id;
  const seenReady = useMemo(() => new SeenSet(`mpq.seenReady.${userId}.${eventId}`), [userId, eventId]);
  const [overlay, setOverlay] = useState<{ title: string; subtitle?: string } | null>(null);
  const [completing, setCompleting] = useState<string[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [tab, setTab] = useState<CashierTab>('new');
  const contentRef = useRef<HTMLDivElement>(null);
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

  const { orders, connected, reload } = useOrders(eventId, { onReady, onLoaded });

  const showError = useCallback((message: string) => {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 5000);
  }, []);
  const { askCancel, dialog: cancelDialog } = useCancelOrder(userId, showError, () => void reload());

  // This cashier's own orders still waiting for or being worked by press.
  const myOpenOrders = useMemo(
    () =>
      orders
        .filter((o) => (o.status === 'new' || o.status === 'in_progress') && o.created_by === userId)
        .sort((a, b) => a.created_at.localeCompare(b.created_at)), // FIFO
    [orders, userId],
  );

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

  const readyBadge = readyBadgeCount(orders, userId);

  // Both panes stay mounted (the draft lives in NewOrderForm); a new tab starts at the top.
  const selectTab = (t: CashierTab) => {
    setTab(t);
    contentRef.current?.scrollTo({ top: 0 });
  };

  const complete = async (order: Order) => {
    const id = order.id;
    if (completing.includes(id)) return; // double-tap guard
    setCompleting((c) => [...c, id]);
    const ok = await setOrderStatus(id, 'completed', user?.id);
    setCompleting((c) => c.filter((x) => x !== id));
    if (!ok) showError(`Couldn't update order #${order.event_order_no}. Check the connection and tap again.`);
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
      <div ref={contentRef} className="content page-enter" style={{ maxWidth: 1100, margin: '0 auto', width: '100%' }}>
        <div className="cashier-tabs" role="tablist" aria-label="Cashier sections">
          <button
            role="tab"
            aria-selected={tab === 'new'}
            className={tab === 'new' ? 'tab tab-active' : 'tab'}
            onClick={() => selectTab('new')}
          >
            New order
          </button>
          <button
            role="tab"
            aria-selected={tab === 'queue'}
            className={tab === 'queue' ? 'tab tab-active' : 'tab'}
            onClick={() => selectTab('queue')}
          >
            Queue
            {readyBadge > 0 && <span className="tab-badge" aria-label={`${readyBadge} ready`}>{readyBadge}</span>}
          </button>
        </div>
        <div className="two-col">
          <div className={tab === 'new' ? undefined : 'pane-inactive'}>
            <NewOrderForm designs={activeDesigns} />
          </div>

          <section className={tab === 'queue' ? undefined : 'pane-inactive'}>
            {toast && <div style={{ marginBottom: 'var(--sp-3)' }}><Toast message={toast} tone="error" /></div>}
            <SectionLabel>In progress · {myOpenOrders.length}</SectionLabel>
            <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 1fr)', marginBottom: 'var(--sp-5)' }}>
              {myOpenOrders.map((o) => (
                <OrderCard key={o.id} order={o} designs={designs}>
                  <button className="btn btn-text" onClick={() => askCancel(o)}>Cancel order</button>
                </OrderCard>
              ))}
              {myOpenOrders.length === 0 && <EmptyState>No open orders from you.</EmptyState>}
            </div>
            <SectionLabel>Ready for pickup · {readyOrders.length}</SectionLabel>
            <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 1fr)' }}>
              {readyOrders.map((o) => (
                <OrderCard key={o.id} order={o} designs={designs} highlight={o.created_by === user?.id}>
                  <button
                    className="btn btn-lg btn-ok"
                    disabled={completing.includes(o.id)}
                    onClick={() => complete(o)}
                  >
                    {completing.includes(o.id) ? <><Spinner /> Confirming…</> : '✓ Picked up'}
                  </button>
                  <button className="btn btn-text" onClick={() => askCancel(o)}>Cancel order</button>
                </OrderCard>
              ))}
              {readyOrders.length === 0 && <EmptyState>Nothing ready yet.</EmptyState>}
            </div>
          </section>
        </div>
      </div>

      <SoundGate />
      {cancelDialog}
      {overlay && (
        <AlertOverlay title={overlay.title} subtitle={overlay.subtitle} onDismiss={() => setOverlay(null)} />
      )}
    </div>
  );
}

function NewOrderForm({ designs }: { designs: ReturnType<typeof useDesigns>['designs'] }) {
  const { user, activeEvent } = useSession();
  const [pickedColor, setColor] = useState<string | null>(null);
  const [pickedSize, setSize] = useState<ShirtSize | null>(null);
  const [pickedFront, setFrontId] = useState<string | null>(null);
  const [pickedBack, setBackId] = useState<string | null>(null);
  const [clientName, setClientName] = useState('');
  const [busy, setBusy] = useState(false);
  const requestId = useRef<{ id: string; eventId: string } | null>(null); // idempotency key of the current draft
  const [toast, setToast] = useState<{ msg: string; tone: 'success' | 'error' } | null>(null);
  const [staleNotice, setStaleNotice] = useState<string | null>(null); // stays until dismissed

  const { colors, sizes, colorLabel } = useMemo(() => eventOptions(activeEvent), [activeEvent]);
  // A pick the event no longer offers (colours edited mid-draft) counts as unselected.
  const color = colors.some((c) => c.key === pickedColor) ? pickedColor : null;
  const size = sizes.find((s) => s === pickedSize) ?? null;

  // `designs` holds active designs only; a pick that was hidden since counts as unselected.
  const frontId = designs.some((d) => d.id === pickedFront) ? pickedFront : null;
  const backId = designs.some((d) => d.id === pickedBack) ? pickedBack : null;

  const allowedColors = useMemo(() => {
    const chosen = designs.filter((d) => d.id === frontId || d.id === backId);
    if (chosen.length === 0) return undefined;
    // intersection of compatible colors across chosen designs
    return chosen
      .map((d) => d.compatible_colors)
      .reduce((acc, cur) => acc.filter((c) => cur.includes(c)));
  }, [designs, frontId, backId]);

  const canSubmit = color && size && !busy;
  const hint = sendHint(color, size);
  const summary = orderSummary({
    colorLabel: color ? colorLabel(color) : null,
    size,
    frontName: designs.find((d) => d.id === frontId)?.name ?? null,
    backName: designs.find((d) => d.id === backId)?.name ?? null,
  });

  const submit = async () => {
    if (!canSubmit || !activeEvent) return;
    setBusy(true);
    // One id per draft, reused on every retry; renewed only after success (or an event switch).
    if (requestId.current?.eventId !== activeEvent.id) {
      requestId.current = { id: crypto.randomUUID(), eventId: activeEvent.id };
    }
    const result = await createOrder({
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
    if (!result.ok) {
      // Rejected: the server refused, nothing was created. Keep the form either way.
      setToast({
        msg: result.kind === 'rejected' ? `Order rejected: ${result.message}` : 'Not confirmed. Tap Send again.',
        tone: 'error',
      });
      return;
    }
    const order = result.order;
    // The server returns the FIRST order for a repeated request id. If the draft was
    // edited after an unconfirmed send, that order has the old details.
    const sameDetails =
      order.shirt_color === color &&
      order.shirt_size === size &&
      order.design_front_id === frontId &&
      order.design_back_id === backId &&
      order.client_name === (clientName === '' ? null : clientName);
    if (!sameDetails) {
      requestId.current = { id: crypto.randomUUID(), eventId: activeEvent.id };
      setToast(null);
      setStaleNotice(
        `Order #${order.event_order_no} was already sent with the earlier details. Cancel it under In progress, then send again.`,
      );
      return;
    }
    requestId.current = null;
    setStaleNotice(null);
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
        <ColorPicker colors={colors} value={color} onChange={setColor} allowed={allowedColors} />
      </div>
      <div>
        <SectionLabel>Size</SectionLabel>
        <SizePicker sizes={sizes} value={size} onChange={setSize} />
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
          style={{ width: '100%', scrollMarginBottom: 160 }}
        />
      </div>

      {toast && <Toast message={toast.msg} tone={toast.tone} />}
      {staleNotice && (
        <div className="toast toast-error" role="alert" style={{ display: 'flex', gap: 'var(--sp-3)', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>{staleNotice}</span>
          <button className="btn btn-text" onClick={() => setStaleNotice(null)}>Dismiss</button>
        </div>
      )}

      <div className="send-bar">
        {summary && <div className="send-summary">{summary}</div>}
        <button className="btn btn-lg btn-primary" disabled={!canSubmit} onClick={submit} style={{ width: '100%' }}>
          {busy ? <><Spinner /> Sending…</> : 'Send to press →'}
        </button>
        {hint && !busy && (
          <div className="muted" style={{ textAlign: 'center', fontSize: 14 }}>{hint}</div>
        )}
      </div>
    </section>
  );
}
