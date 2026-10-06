import { useCallback, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { readyBadgeCount } from '../lib/readyBadge';
import { orderSummary } from '../lib/orderSummary';
import { eventOptions } from '../lib/eventOptions';
import { createOrder } from '../lib/createOrder';
import { setOrderStatus, staffName } from '../lib/orderStatus';
import { cashierQueue } from '../lib/cashierQueue';
import { cashierCancelNotice } from '../lib/cashierCancelNotice';
import { NOTICE_MS } from '../lib/cancelNotice';
import { alertReady, SeenSet } from '../lib/notify';
import { sendHint } from '../lib/sendHint';
import { printColors, type PrintMode } from '../lib/printColors';
import { useSession } from '../context/SessionContext';
import { useDesigns } from '../hooks/useDesigns';
import { useOrders, type LoadKind } from '../hooks/useOrders';
import { NARROW_QUERY, useMediaQuery } from '../hooks/useMediaQuery';
import { useCancelOrder } from '../hooks/useCancelOrder';
import { useBusy } from '../hooks/useBusy';
import { ColorPicker } from '../components/ColorPicker';
import { SizePicker } from '../components/SizePicker';
import { DesignPicker, ChosenPrint } from '../components/DesignPicker';
import { OrderCard } from '../components/OrderCard';
import { SoundGate } from '../components/SoundGate';
import { AlertOverlay } from '../components/AlertOverlay';
import { TopBar, TopBlock, OfflineBanner } from '../components/TopBar';
import { SectionLabel } from '../components/ui/SectionLabel';
import { EmptyState } from '../components/ui/EmptyState';
import { Toast } from '../components/ui/Toast';
import { Spinner } from '../components/ui/Spinner';
import type { Order, ShirtSize } from '../types/db';
import { BuildTag } from '../components/BuildTag';

type CashierTab = 'new' | 'queue';

const NOTHING_CHOSEN = { bundle: false, front: false, back: false };

export function CashierPage() {
  const { user, activeEvent } = useSession();
  const eventId = activeEvent?.id ?? null;
  const { designs, activeDesigns, loading: designsLoading, error: designsError, reload: reloadDesigns } = useDesigns(eventId);

  // Dedupe ready alerts across refresh/reconnect (per cashier+event).
  const userId = user?.id;
  const seenReady = useMemo(() => new SeenSet(`mpq.seenReady.${userId}.${eventId}`), [userId, eventId]);
  const [overlay, setOverlay] = useState<{ title: string; subtitle?: string } | null>(null);
  const [completing, setCompleting] = useState<string[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [tab, setTab] = useState<CashierTab>('new');
  const contentRef = useRef<HTMLDivElement>(null);
  const [footerSlot, setFooterSlot] = useState<HTMLElement | null>(null); // phone bottom bar target
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

  // Cancel notices live apart from the error toast so neither overwrites the other.
  const [notices, setNotices] = useState<{ key: string; text: string }[]>([]);
  const dismissNotice = useCallback((key: string) => setNotices((l) => l.filter((n) => n.key !== key)), []);
  const onCancelled = useCallback(
    async (next: Order, prev: Order | null) => {
      const n = cashierCancelNotice(prev, next, userId);
      if (!n) return;
      const name = n.by ? await staffName(n.by) : null;
      const text = `Order #${n.orderNo} was cancelled by ${name ?? 'the press'}. Check with the press.`;
      setNotices((l) => [...l.filter((x) => x.key !== next.id), { key: next.id, text }]);
      setTimeout(() => dismissNotice(next.id), NOTICE_MS);
    },
    [userId, dismissNotice],
  );

  const { orders, connected, loaded, reload } = useOrders(eventId, { onReady, onLoaded, onCancelled });

  const showError = useCallback((message: string) => {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 5000);
  }, []);
  const { askCancel, dialog: cancelDialog } = useCancelOrder(userId, showError, () => void reload());

  // Queue shows only this cashier's own orders (interface rule; the server does not check).
  const { inProgress: myOpenOrders, ready: readyOrders } = useMemo(() => cashierQueue(orders, userId), [orders, userId]);

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
        <TopBlock><TopBar title="Cashier" /></TopBlock>
        <div className="content"><EmptyState>No active event. Ask an admin to activate one.</EmptyState></div>
      </div>
    );
  }

  return (
    <div className="app">
      <TopBlock>
        <TopBar title="Cashier" soundRetry />
        <OfflineBanner connected={connected} loaded={loaded} />
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
        {(toast || notices.length > 0) && (
          <div className="top-notices">
            {toast && <Toast message={toast} tone="error" />}
            {notices.map((n) => (
              <div key={n.key} className="toast toast-error toast-notice" role="status" style={{ justifyContent: 'space-between' }}>
                <span>{n.text}</span>
                <button className="btn btn-text" onClick={() => dismissNotice(n.key)}>Dismiss</button>
                <span className="notice-bar" aria-hidden="true" style={{ animationDuration: `${NOTICE_MS}ms` }} />
              </div>
            ))}
          </div>
        )}
      </TopBlock>
      <div ref={contentRef} className="content page-enter" style={{ maxWidth: 1100, margin: '0 auto', width: '100%' }}>
        <div className="two-col">
          <div className={tab === 'new' ? undefined : 'pane-inactive'}>
            <NewOrderForm
              designs={activeDesigns}
              designsLoading={designsLoading}
              designsError={designsError}
              onRetryDesigns={() => void reloadDesigns()}
              footerSlot={footerSlot}
              active={tab === 'new'}
            />
          </div>

          <section className={tab === 'queue' ? undefined : 'pane-inactive'}>
            <SectionLabel>Ready for pickup · {readyOrders.length}</SectionLabel>
            <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 1fr)', marginBottom: 'var(--sp-5)' }}>
              {readyOrders.map((o) => (
                <OrderCard key={o.id} order={o} designs={designs}>
                  <button
                    className="btn btn-lg btn-ok"
                    disabled={completing.includes(o.id)}
                    onClick={() => complete(o)}
                  >
                    {completing.includes(o.id) ? <><Spinner /> Confirming…</> : `✓ Picked up #${o.event_order_no}`}
                  </button>
                  <button className="btn btn-danger-outline btn-compact" onClick={() => askCancel(o)}>Cancel order</button>
                </OrderCard>
              ))}
              {readyOrders.length === 0 && (
                <EmptyState>{loaded ? 'None of your orders is ready yet.' : 'Loading orders…'}</EmptyState>
              )}
            </div>
            <SectionLabel>In progress · {myOpenOrders.length}</SectionLabel>
            <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 1fr)' }}>
              {myOpenOrders.map((o) => (
                <OrderCard key={o.id} order={o} designs={designs} showClaimedBy>
                  <button className="btn btn-danger-outline" onClick={() => askCancel(o)}>Cancel order</button>
                </OrderCard>
              ))}
              {myOpenOrders.length === 0 && (
                <EmptyState>{loaded ? 'No open orders from you.' : 'Loading orders…'}</EmptyState>
              )}
            </div>
          </section>
        </div>
        <BuildTag />
      </div>
      <div ref={setFooterSlot} className="cashier-footer" />

      <SoundGate />
      {cancelDialog}
      {overlay && (
        <AlertOverlay title={overlay.title} subtitle={overlay.subtitle} onDismiss={() => {
          setOverlay(null);
          selectTab('queue'); // hand-over is in the Queue; no-op on wide screens (both panes show)
        }} />
      )}
    </div>
  );
}

// Above the print tiles: a read in flight or failed. "No print" stays available below it.
function DesignsStatus({ loading, error, onRetry }: { loading: boolean; error: boolean; onRetry: () => void }) {
  if (loading) return <EmptyState>Loading designs…</EmptyState>;
  if (!error) return null;
  return (
    <div className="grid" style={{ gap: 'var(--sp-3)' }} role="alert">
      <EmptyState>Couldn't load designs. Check the connection.</EmptyState>
      <button className="btn btn-lg" onClick={onRetry}>Retry</button>
    </div>
  );
}

// On phones the send bar is rendered into `footerSlot` (a flex footer below the scroller) and only
// while the New order tab is active; from 900 px it stays at the end of the card. State stays here.
function NewOrderForm({
  designs,
  designsLoading,
  designsError,
  onRetryDesigns,
  footerSlot,
  active,
}: {
  designs: ReturnType<typeof useDesigns>['designs'];
  designsLoading: boolean;
  designsError: boolean;
  onRetryDesigns: () => void;
  footerSlot: HTMLElement | null;
  active: boolean;
}) {
  const { user, activeEvent } = useSession();
  const narrow = useMediaQuery(NARROW_QUERY);
  const [pickedColor, setColor] = useState<string | null>(null);
  const [pickedSize, setSize] = useState<ShirtSize | null>(null);
  const [mode, setMode] = useState<PrintMode>('bundle');
  const [pickedFront, setFrontId] = useState<string | null>(null);
  const [pickedBack, setBackId] = useState<string | null>(null);
  const [clientName, setClientName] = useState('');
  // View only: which print pickers the cashier has answered (so "No print" can collapse too).
  const [chosen, setChosen] = useState(NOTHING_CHOSEN);
  const [colorNote, setColorNote] = useState<string | null>(null); // bundle cleared the colour; stays until the next colour pick or print change
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

  const chosenDesigns = useMemo(() => designs.filter((d) => d.id === frontId || d.id === backId), [designs, frontId, backId]);
  const { visible, dimmed } = printColors({
    mode,
    chosen: chosenDesigns,
    colorKeys: colors.map((c) => c.key),
    picked: color,
  });
  const visibleColors = colors.filter((c) => visible.includes(c.key));
  const bundle = mode === 'bundle' ? designs.find((d) => d.id === frontId) ?? null : null;
  // A picker collapses once answered; a pick that was hidden since keeps the grid open.
  const collapsed = (key: keyof typeof NOTHING_CHOSEN, picked: string | null, id: string | null) =>
    chosen[key] && (picked === null || id !== null);
  const reopen = (key: keyof typeof NOTHING_CHOSEN) => setChosen((c) => ({ ...c, [key]: false }));

  // Bundle: one design on both sides. Colours it does not fit are hidden, so a picked one is cleared.
  const pickBundle = (id: string | null) => {
    setFrontId(id);
    setBackId(id);
    setChosen((c) => ({ ...c, bundle: true }));
    const next = printColors({
      mode,
      chosen: designs.filter((d) => d.id === id),
      colorKeys: colors.map((c) => c.key),
      picked: color,
    });
    if (next.resetColor) setColor(null);
    const name = designs.find((d) => d.id === id)?.name;
    setColorNote(next.resetColor && name ? `Colour cleared: not available for ${name}` : null);
  };
  const pickSide = (side: 'front' | 'back', id: string | null) => {
    (side === 'front' ? setFrontId : setBackId)(id);
    setChosen((c) => ({ ...c, [side]: true }));
  };
  const pickColor = (key: string) => {
    setColor(key);
    setColorNote(null);
  };
  // Switching mode clears the print only; colour, size and name stay (nothing is chosen, so the colour stays valid).
  const switchMode = (m: PrintMode) => {
    if (m === mode) return;
    setMode(m);
    setColorNote(null);
    setFrontId(null);
    setBackId(null);
    setChosen(NOTHING_CHOSEN);
  };

  // Same clearing after a successful send and on Reset. The mode (Bundle or Custom) stays.
  const clearDraft = () => {
    requestId.current = null;
    setStaleNotice(null);
    setColor(null);
    setColorNote(null);
    setSize(null);
    setFrontId(null);
    setBackId(null);
    setChosen(NOTHING_CHOSEN);
    setClientName('');
  };
  const dirty = Boolean(
    pickedColor || pickedSize || pickedFront || pickedBack || clientName || colorNote || chosen.bundle || chosen.front || chosen.back,
  );

  useBusy('draft', dirty); // same condition that enables Reset: no automatic reload
  useBusy('sending', busy);

  const canSubmit = color && size && !busy;
  const hint = sendHint(color, size);
  const summary = orderSummary({
    colorLabel: color ? colorLabel(color) : null,
    size,
    frontName: designs.find((d) => d.id === frontId)?.name ?? null,
    backName: designs.find((d) => d.id === backId)?.name ?? null,
    bundleName: bundle?.name ?? null,
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
    clearDraft();
    setToast({ msg: `Sent to press — Order #${order.event_order_no}`, tone: 'success' });
    setTimeout(() => setToast(null), 2500);
  };

  // On phones the card's end can be off screen, so the result toast rides in the bar.
  const toastEl = toast && <Toast message={toast.msg} tone={toast.tone} />;
  const sendBar = (
    <div className="send-bar">
      {narrow && toastEl}
      {summary && <div className="send-summary">{summary}</div>}
      <div className="send-row">
        <button className="btn btn-reset" disabled={!dirty || busy} onClick={clearDraft}>
          Reset
        </button>
        <button className="btn btn-lg btn-primary" disabled={!canSubmit} onClick={submit}>
          {busy ? <><Spinner /> Sending…</> : 'Send to press →'}
        </button>
      </div>
      {hint && !busy && (
        <div className="muted" style={{ textAlign: 'center', fontSize: 14 }}>{hint}</div>
      )}
    </div>
  );

  return (
    <section className="card grid" style={{ gap: 'var(--sp-5)', alignSelf: 'start' }}>
      <h2 style={{ margin: 0 }}>New order</h2>

      <div>
        <SectionLabel>Print</SectionLabel>
        <div className="print-mode" role="group" aria-label="Print mode">
          {(['bundle', 'custom'] as const).map((m) => (
            <button
              key={m}
              aria-pressed={mode === m}
              className={mode === m ? 'tab tab-active' : 'tab'}
              onClick={() => switchMode(m)}
            >
              {m === 'bundle' ? 'Bundle' : 'Custom print'}
            </button>
          ))}
        </div>
      </div>
      <DesignsStatus loading={designsLoading} error={designsError} onRetry={onRetryDesigns} />
      {mode === 'bundle' ? (
        collapsed('bundle', pickedFront, frontId) ? (
          <ChosenPrint design={bundle} sides={['front', 'back']} onChange={() => reopen('bundle')} />
        ) : (
          <DesignPicker designs={designs} side="bundle" value={frontId} onChange={pickBundle} />
        )
      ) : (
        <>
          <div>
            <SectionLabel>Front print</SectionLabel>
            {collapsed('front', pickedFront, frontId) ? (
              <ChosenPrint design={designs.find((d) => d.id === frontId) ?? null} sides={['front']} onChange={() => reopen('front')} />
            ) : (
              <DesignPicker designs={designs} side="front" value={frontId} onChange={(id) => pickSide('front', id)} />
            )}
          </div>
          <div>
            <SectionLabel>Back print</SectionLabel>
            {collapsed('back', pickedBack, backId) ? (
              <ChosenPrint design={designs.find((d) => d.id === backId) ?? null} sides={['back']} onChange={() => reopen('back')} />
            ) : (
              <DesignPicker designs={designs} side="back" value={backId} onChange={(id) => pickSide('back', id)} />
            )}
          </div>
        </>
      )}
      <div>
        <SectionLabel>Shirt color</SectionLabel>
        <ColorPicker colors={visibleColors} value={color} onChange={pickColor} dimmed={dimmed} />
        {colorNote && (
          <div role="status" style={{ marginTop: 'var(--sp-2)', fontSize: 14, fontWeight: 600, color: 'var(--warn)' }}>
            {colorNote}
          </div>
        )}
        {dimmed.length > 0 && (
          <div className="muted" style={{ marginTop: 'var(--sp-2)', fontSize: 14 }}>
            Hatched colors are not recommended for this print (still allowed)
          </div>
        )}
      </div>
      <div>
        <SectionLabel>Size</SectionLabel>
        <SizePicker sizes={sizes} value={size} onChange={setSize} />
      </div>
      <div>
        <SectionLabel>Client name (optional)</SectionLabel>
        <input
          value={clientName}
          onChange={(e) => setClientName(e.target.value)}
          placeholder="e.g. Anna"
          aria-label="Client name (optional)"
          type="text"
          name="order-label"
          inputMode="text"
          enterKeyHint="done"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="words"
          spellCheck={false}
          data-form-type="other"
          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
          style={{ width: '100%', scrollMarginBottom: 160 }}
        />
      </div>

      {!narrow && toastEl}
      {staleNotice && (
        <div className="toast toast-error" role="alert" style={{ display: 'flex', gap: 'var(--sp-3)', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>{staleNotice}</span>
          <button className="btn btn-text" onClick={() => setStaleNotice(null)}>Dismiss</button>
        </div>
      )}

      {narrow ? (footerSlot && active ? createPortal(sendBar, footerSlot) : null) : sendBar}
    </section>
  );
}
