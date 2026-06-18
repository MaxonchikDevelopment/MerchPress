import type { ReactNode } from 'react';
import { designPhotoUrl } from '../lib/supabase';
import { colorLabel } from '../config';
import type { Design, Order } from '../types/db';
import { StatusBadge } from './StatusBadge';
import { WaitTimer } from './WaitTimer';

function DesignThumb({ design, side }: { design: Design | undefined; side: 'front' | 'back' }) {
  if (!design) return null;
  const url = designPhotoUrl(side === 'front' ? design.photo_front : design.photo_back);
  return (
    <div style={{ textAlign: 'center' }}>
      {url ? (
        <img
          src={url}
          alt={design.name}
          style={{ width: 84, height: 84, objectFit: 'cover', borderRadius: 10 }}
        />
      ) : (
        <div
          style={{
            width: 84,
            height: 84,
            borderRadius: 10,
            background: 'var(--panel-2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 11,
            color: 'var(--muted)',
          }}
        >
          {side}
        </div>
      )}
      <div style={{ fontSize: 12, marginTop: 4 }}>
        {side}: {design.name}
      </div>
    </div>
  );
}

export function OrderCard({
  order,
  designs,
  highlight,
  showWait,
  children,
}: {
  order: Order;
  designs: Design[];
  highlight?: boolean;
  showWait?: boolean;
  children?: ReactNode;
}) {
  const front = designs.find((d) => d.id === order.design_front_id);
  const back = designs.find((d) => d.id === order.design_back_id);

  return (
    <div
      className="card"
      style={{
        outline: highlight ? '3px solid var(--accent)' : 'none',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <div className="row">
        <div style={{ fontSize: 30, fontWeight: 900 }}>#{order.event_order_no}</div>
        <StatusBadge status={order.status} />
        <div className="spacer" />
        {showWait && order.status !== 'completed' && <WaitTimer since={order.new_at} />}
      </div>

      <div className="row" style={{ gap: 20 }}>
        <DesignThumb design={front} side="front" />
        <DesignThumb design={back} side="back" />
        {!front && !back && <span className="muted">No print selected</span>}
      </div>

      <div className="row">
        <span className="pill">{colorLabel(order.shirt_color)}</span>
        <span className="pill">Size {order.shirt_size}</span>
        {order.client_name && <span className="pill">👤 {order.client_name}</span>}
      </div>

      <div className="muted" style={{ fontSize: 13 }}>
        Cashier: {order.cashier_name ?? '—'}
        {order.claimed_by ? ' · claimed' : ''}
      </div>

      {children}
    </div>
  );
}
