import { useState, type ReactNode } from 'react';
import { designPhotoUrl } from '../lib/supabase';
import { colorLabel } from '../config';
import type { Design, Order } from '../types/db';
import { StatusBadge } from './StatusBadge';
import { WaitTimer } from './WaitTimer';

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

// Design thumbnail with graceful fallback: shows the print photo, or the
// design's initials on a muted tile when the photo is missing or fails to load.
function DesignThumb({ design, side }: { design: Design | undefined; side: 'front' | 'back' }) {
  const [failed, setFailed] = useState(false);
  if (!design) return null;
  const url = designPhotoUrl(side === 'front' ? design.photo_front : design.photo_back);
  const showImg = url && !failed;
  return (
    <div style={{ textAlign: 'center' }}>
      {showImg ? (
        <img
          src={url}
          alt={`${side} — ${design.name}`}
          loading="lazy"
          onError={() => setFailed(true)}
          style={{ width: 84, height: 84, objectFit: 'cover', borderRadius: 'var(--r-inner)', border: '1px solid var(--border-subtle)' }}
        />
      ) : (
        <div
          aria-label={`${design.name} (no ${side} photo)`}
          style={{
            width: 84,
            height: 84,
            borderRadius: 'var(--r-inner)',
            background: 'var(--surface-raised)',
            border: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 22,
            fontWeight: 800,
            color: 'var(--text-secondary)',
          }}
        >
          {initials(design.name)}
        </div>
      )}
      <div style={{ fontSize: 12, marginTop: 4, color: 'var(--text-secondary)' }}>
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
  edgeColor,
  alert,
  children,
}: {
  order: Order;
  designs: Design[];
  highlight?: boolean;
  showWait?: boolean;
  edgeColor?: string; // left-edge status accent (press queue)
  alert?: boolean; // pulse to escalate (overdue)
  children?: ReactNode;
}) {
  const front = designs.find((d) => d.id === order.design_front_id);
  const back = designs.find((d) => d.id === order.design_back_id);

  return (
    <div
      className={`card${alert ? ' pulse-danger' : ''}`}
      style={{
        boxShadow: highlight ? '0 0 0 2px var(--accent), var(--shadow-card)' : undefined,
        borderLeft: edgeColor ? `4px solid ${edgeColor}` : undefined,
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--sp-3)',
      }}
    >
      <div className="row">
        <div style={{ fontSize: 32, fontWeight: 900, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>
          #{order.event_order_no}
        </div>
        <StatusBadge status={order.status} />
        {highlight && (
          <span className="badge" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
            Yours
          </span>
        )}
        <div className="spacer" />
        {showWait && order.status !== 'completed' && <WaitTimer since={order.new_at} />}
      </div>

      <div className="row" style={{ gap: 'var(--sp-5)' }}>
        <DesignThumb design={front} side="front" />
        <DesignThumb design={back} side="back" />
        {!front && !back && <span className="muted">No print selected</span>}
      </div>

      <div className="row">
        <span className="pill">{colorLabel(order.shirt_color)}</span>
        <span className="pill">Size {order.shirt_size}</span>
        {order.client_name && <span className="pill"><span aria-hidden="true">👤</span> {order.client_name}</span>}
      </div>

      <div className="muted" style={{ fontSize: 13 }}>
        Cashier: {order.cashier_name ?? '—'}
        {order.claimed_by ? ' · claimed' : ''}
      </div>

      {children}
    </div>
  );
}
