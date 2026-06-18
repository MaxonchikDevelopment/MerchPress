import { useCallback, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { alertReady, SeenSet } from '../lib/notify';
import { useSession } from '../context/SessionContext';
import { useDesigns } from '../hooks/useDesigns';
import { useOrders } from '../hooks/useOrders';
import { ColorPicker } from '../components/ColorPicker';
import { SizePicker } from '../components/SizePicker';
import { DesignPicker } from '../components/DesignPicker';
import { OrderCard } from '../components/OrderCard';
import { AlertOverlay } from '../components/AlertOverlay';
import { TopBar, OfflineBanner } from '../components/TopBar';
import type { Order, ShirtSize } from '../types/db';

export function CashierPage() {
  const { user, activeEvent } = useSession();
  const eventId = activeEvent?.id ?? null;
  const { designs } = useDesigns(eventId);

  // Dedupe ready alerts across refresh/reconnect (per cashier+event).
  const seenReady = useRef(new SeenSet(`mpq.seenReady.${user?.id}.${eventId}`));
  const [overlay, setOverlay] = useState<{ title: string; subtitle?: string } | null>(null);

  const onReady = useCallback(
    (order: Order) => {
      if (order.created_by !== user?.id) return; // only my own orders sound
      if (!seenReady.current.markIfNew(order.id)) return; // already alerted
      alertReady();
      setOverlay({
        title: `Order #${order.event_order_no} ready`,
        subtitle: order.client_name ?? undefined,
      });
    },
    [user?.id],
  );

  const onLoaded = useCallback(
    (list: Order[]) => {
      // Seed dedupe with orders already ready for me so a refresh won't re-alert.
      seenReady.current.seed(
        list.filter((o) => o.status === 'ready' && o.created_by === user?.id).map((o) => o.id),
      );
    },
    [user?.id],
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

  const complete = async (id: string) => {
    await supabase.rpc('set_order_status', {
      p_order_id: id,
      p_status: 'completed',
      p_user_id: user?.id,
    });
  };

  if (!activeEvent) {
    return (
      <div className="app">
        <TopBar title="Cashier" />
        <div className="content"><div className="card">No active event. Ask an admin to activate one.</div></div>
      </div>
    );
  }

  return (
    <div className="app">
      <TopBar title="Cashier" />
      <OfflineBanner connected={connected} />
      <div className="content" style={{ maxWidth: 820, margin: '0 auto', width: '100%' }}>
        <NewOrderForm designs={designs} />

        <h2 style={{ marginTop: 28 }}>Ready for pickup ({readyOrders.length})</h2>
        <div className="grid" style={{ gridTemplateColumns: '1fr' }}>
          {readyOrders.map((o) => (
            <OrderCard key={o.id} order={o} designs={designs} highlight={o.created_by === user?.id}>
              <button className="btn btn-lg btn-ok" onClick={() => complete(o.id)}>
                ✓ Picked up
              </button>
            </OrderCard>
          ))}
          {readyOrders.length === 0 && <div className="muted">Nothing ready yet.</div>}
        </div>
      </div>

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
  const [toast, setToast] = useState<string | null>(null);

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
    const { data, error } = await supabase.rpc('create_order', {
      p_event_id: activeEvent.id,
      p_shirt_color: color,
      p_shirt_size: size,
      p_design_front_id: frontId,
      p_design_back_id: backId,
      p_client_name: clientName,
      p_created_by: user?.id,
      p_cashier_key: user?.id,
      p_cashier_name: user?.name,
    });
    setBusy(false);
    if (error) {
      setToast(`Error: ${error.message}`);
      return;
    }
    const order = data as Order;
    setToast(`Sent to press — Order #${order.event_order_no}`);
    setColor(null);
    setSize(null);
    setFrontId(null);
    setBackId(null);
    setClientName('');
    setTimeout(() => setToast(null), 2500);
  };

  return (
    <div className="card grid">
      <h2 style={{ margin: 0 }}>New order</h2>

      <div>
        <div className="label">Shirt color</div>
        <ColorPicker value={color} onChange={setColor} allowed={allowedColors} />
      </div>
      <div>
        <div className="label">Size</div>
        <SizePicker value={size} onChange={setSize} />
      </div>
      <div>
        <div className="label">Front print</div>
        <DesignPicker designs={designs} side="front" value={frontId} onChange={setFrontId} />
      </div>
      <div>
        <div className="label">Back print</div>
        <DesignPicker designs={designs} side="back" value={backId} onChange={setBackId} />
      </div>
      <div>
        <div className="label">Client name (optional)</div>
        <input
          value={clientName}
          onChange={(e) => setClientName(e.target.value)}
          placeholder="e.g. Anna"
          style={{ width: '100%' }}
        />
      </div>

      <button className="btn btn-lg btn-primary" disabled={!canSubmit} onClick={submit}>
        {busy ? 'Sending…' : 'Send to press →'}
      </button>
      {toast && <div style={{ fontWeight: 700, textAlign: 'center' }}>{toast}</div>}
    </div>
  );
}
