import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { toCsv, downloadCsv } from '../lib/csv';
import { colorLabel } from '../config';
import { useEvents } from '../hooks/useEvents';
import { useDesigns } from '../hooks/useDesigns';
import { useSession } from '../context/SessionContext';
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
    <div className="grid">
      <div className="row">
        <h2 style={{ margin: 0 }}>Stats</h2>
        <select value={eventId ?? ''} onChange={(e) => setEventId(e.target.value)}>
          <option value="" disabled>Select event…</option>
          {events.map((e) => (
            <option key={e.id} value={e.id}>{e.name}{e.is_active ? ' (active)' : ''}</option>
          ))}
        </select>
        <div className="spacer" />
        <button className="btn btn-primary" onClick={exportCsv} disabled={orders.length === 0}>
          Export CSV
        </button>
      </div>

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
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="card">
      <div className="muted" style={{ fontSize: 13 }}>{label}</div>
      <div style={{ fontSize: 30, fontWeight: 900 }}>{value}</div>
    </div>
  );
}

function Breakdown({ title, rows }: { title: string; rows: [string | number, number][] }) {
  return (
    <div className="card">
      <div style={{ fontWeight: 800, marginBottom: 8 }}>{title}</div>
      {rows.length === 0 && <div className="muted">No data</div>}
      {rows.map(([k, n]) => (
        <div key={String(k)} className="row" style={{ justifyContent: 'space-between' }}>
          <span>{k}</span>
          <span style={{ fontWeight: 700 }}>{n}</span>
        </div>
      ))}
    </div>
  );
}
