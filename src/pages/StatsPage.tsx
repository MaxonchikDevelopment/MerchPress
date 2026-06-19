import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { toCsv, downloadCsv } from '../lib/csv';
import { colorLabel } from '../config';
import { useEvents } from '../hooks/useEvents';
import { useDesigns } from '../hooks/useDesigns';
import { useSession } from '../context/SessionContext';
import { SectionLabel } from '../components/ui/SectionLabel';
import { EmptyState } from '../components/ui/EmptyState';
import type { Order, OrderStats } from '../types/db';

function fmtDuration(secs: number | null): string {
  if (secs == null) return '—';
  const m = Math.round(secs / 60);
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m} min`;
}

function tally<T extends string | number>(items: T[]): [T, number][] {
  const map = new Map<T, number>();
  for (const i of items) map.set(i, (map.get(i) ?? 0) + 1);
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
}

export function StatsPage() {
  const { activeEvent } = useSession();
  const { events } = useEvents();
  // Selector defaults to the active event; explicit pick overrides it.
  const [pickedId, setPickedId] = useState<string | null>(null);
  const eventId = pickedId ?? activeEvent?.id ?? null;
  const setEventId = setPickedId;

  const { designs } = useDesigns(eventId);
  const [orders, setOrders] = useState<Order[]>([]);
  const [stats, setStats] = useState<OrderStats | null>(null);

  useEffect(() => {
    if (!eventId) return;
    void supabase
      .from('orders')
      .select('*')
      .eq('event_id', eventId)
      .order('event_order_no', { ascending: true })
      .then(({ data }) => setOrders((data as Order[]) ?? []));
    void supabase
      .from('order_stats_v')
      .select('*')
      .eq('event_id', eventId)
      .maybeSingle()
      .then(({ data }) => setStats((data as OrderStats) ?? null));
  }, [eventId]);

  const designName = (id: string | null) => designs.find((d) => d.id === id)?.name ?? '';

  const byDesign = useMemo(() => {
    const names = orders.flatMap((o) =>
      [o.design_front_id, o.design_back_id].filter(Boolean).map((id) => designName(id as string)),
    );
    return tally(names.filter(Boolean));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders, designs]);

  const bySize = useMemo(() => tally(orders.map((o) => o.shirt_size)), [orders]);
  const byColor = useMemo(() => tally(orders.map((o) => colorLabel(o.shirt_color))), [orders]);

  const exportCsv = () => {
    const rows = orders.map((o) => ({
      order_no: o.event_order_no,
      created_at: o.created_at,
      status: o.status,
      color: colorLabel(o.shirt_color),
      size: o.shirt_size,
      front: designName(o.design_front_id),
      back: designName(o.design_back_id),
      client: o.client_name ?? '',
      cashier: o.cashier_name ?? '',
      ready_at: o.ready_at ?? '',
      completed_at: o.completed_at ?? '',
    }));
    const csv = toCsv(rows, [
      { key: 'order_no', header: 'Order #' },
      { key: 'created_at', header: 'Created' },
      { key: 'status', header: 'Status' },
      { key: 'color', header: 'Color' },
      { key: 'size', header: 'Size' },
      { key: 'front', header: 'Front' },
      { key: 'back', header: 'Back' },
      { key: 'client', header: 'Client' },
      { key: 'cashier', header: 'Cashier' },
      { key: 'ready_at', header: 'Ready at' },
      { key: 'completed_at', header: 'Completed at' },
    ]);
    const ev = events.find((e) => e.id === eventId)?.name ?? 'event';
    downloadCsv(`merchpress-${ev}-${new Date().toISOString().slice(0, 10)}.csv`, csv);
  };

  return (
    <div className="grid" style={{ gap: 'var(--sp-5)' }}>
      <div className="row">
        <h2 style={{ margin: 0 }}>Stats</h2>
        <select value={eventId ?? ''} onChange={(e) => setEventId(e.target.value)} aria-label="Event">
          <option value="" disabled>Select event…</option>
          {events.map((e) => (
            <option key={e.id} value={e.id}>{e.name}{e.is_active ? ' (active)' : ''}</option>
          ))}
        </select>
        <div className="spacer" />
        <button className="btn btn-secondary" onClick={exportCsv} disabled={orders.length === 0}>
          ⭳ Export CSV
        </button>
      </div>

      {!eventId ? (
        <EmptyState>Select an event to view its stats.</EmptyState>
      ) : (
        <>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}>
            <Kpi label="Total orders" value={stats?.total_orders ?? orders.length} />
            <Kpi label="Completed" value={stats?.count_completed ?? 0} />
            <Kpi label="In queue" value={(stats?.count_new ?? 0) + (stats?.count_in_progress ?? 0)} />
            <Kpi label="Avg → ready" value={fmtDuration(stats?.avg_secs_to_ready ?? null)} />
            <Kpi label="Avg → done" value={fmtDuration(stats?.avg_secs_to_complete ?? null)} />
          </div>

          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
            <Breakdown title="By design" rows={byDesign} />
            <Breakdown title="By size" rows={bySize} />
            <Breakdown title="By color" rows={byColor} />
          </div>
        </>
      )}
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="card">
      <SectionLabel>{label}</SectionLabel>
      <div style={{ fontSize: 32, fontWeight: 900, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>{value}</div>
    </div>
  );
}

function Breakdown({ title, rows }: { title: string; rows: [string | number, number][] }) {
  return (
    <div className="card">
      <SectionLabel style={{ marginBottom: 'var(--sp-3)' }}>{title}</SectionLabel>
      {rows.length === 0 && <div className="muted" style={{ fontSize: 14 }}>No data</div>}
      {rows.map(([k, n], i) => (
        <div
          key={String(k)}
          className="row"
          style={{
            justifyContent: 'space-between',
            padding: '8px 0',
            borderTop: i === 0 ? 'none' : '1px solid var(--border-subtle)',
          }}
        >
          <span style={{ color: 'var(--text-secondary)' }}>{k}</span>
          <span style={{ fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{n}</span>
        </div>
      ))}
    </div>
  );
}
