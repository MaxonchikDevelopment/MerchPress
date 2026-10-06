import { useState, type ReactNode } from 'react';
import { designPhotoUrl } from '../lib/supabase';
import { initials } from '../lib/initials';
import { useSession } from '../context/SessionContext';
import { eventOptions } from '../lib/eventOptions';
import { useStaffName } from '../lib/staffNames';
import type { Design, Order } from '../types/db';
import { StatusBadge } from './StatusBadge';
import { WaitTimer } from './WaitTimer';
import { ImageLightbox } from './ImageLightbox';

// Design thumbnail with graceful fallback: shows the print photo, or the
// design's initials on a muted tile when the photo is missing or fails to load.
function DesignThumb({ design, side }: { design: Design | undefined; side: 'front' | 'back' }) {
  const [failed, setFailed] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  if (!design) return null;
  const url = designPhotoUrl(side === 'front' ? design.photo_front : design.photo_back);
  const showImg = url && !failed;
  return (
    <div style={{ textAlign: 'center' }}>
      {showImg ? (
        <>
          <button
            type="button"
            aria-label={`Enlarge ${side} print — ${design.name}`}
            onClick={(e) => {
              e.stopPropagation();
              setZoomed(true);
            }}
            style={{ padding: 0, border: 0, background: 'none', display: 'block', cursor: 'zoom-in' }}
          >
            <img
              src={url}
              alt={`${side} — ${design.name}`}
              loading="lazy"
              onError={() => setFailed(true)}
              className="order-thumb"
              style={{ display: 'block', objectFit: 'cover', borderRadius: 'var(--r-inner)', border: '1px solid var(--border-subtle)' }}
            />
          </button>
          {zoomed && <ImageLightbox src={url} alt={`${side} — ${design.name}`} onClose={() => setZoomed(false)} />}
        </>
      ) : (
        <div
          aria-label={`${design.name} (no ${side} photo)`}
          className="order-thumb"
          style={{
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
      <div className="order-secondary" style={{ marginTop: 4 }}>
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
  showClaimedBy,
  children,
}: {
  order: Order;
  designs: Design[];
  highlight?: boolean;
  showWait?: boolean;
  edgeColor?: string; // left-edge status accent (press queue)
  alert?: boolean; // pulse to escalate (overdue)
  showClaimedBy?: boolean; // Press: name the person who claimed an in-progress order
  children?: ReactNode;
}) {
  // Press and Cashier only list orders of the active event.
  const { activeEvent } = useSession();
  const { colorLabel } = eventOptions(activeEvent);
  const front = designs.find((d) => d.id === order.design_front_id);
  const back = designs.find((d) => d.id === order.design_back_id);
  const claimedByName = useStaffName(showClaimedBy && order.status === 'in_progress' ? order.claimed_by : null);

  return (
    <div
      className={`card order-card${alert ? ' pulse-danger' : ''}`}
      style={{
        boxShadow: highlight ? '0 0 0 2px var(--accent), var(--shadow-card)' : undefined,
        borderLeft: edgeColor ? `4px solid ${edgeColor}` : undefined,
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--sp-3)',
      }}
    >
      <div className="row">
        <div className="order-no">#{order.event_order_no}</div>
        <StatusBadge status={order.status} />
        {highlight && (
          <span className="badge" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
            Yours
          </span>
        )}
        <div className="spacer" />
        {showWait && order.status !== 'completed' && order.status !== 'cancelled' && <WaitTimer since={order.new_at} />}
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

      <div className="order-secondary">
        Cashier: {order.cashier_name ?? '—'}
        {order.claimed_by && !showClaimedBy ? ' · claimed' : ''}
      </div>
      {showClaimedBy && order.status === 'in_progress' && order.claimed_by && (
        <div className="order-secondary">
          {claimedByName ? <>Claimed by <strong>{claimedByName}</strong></> : 'Claimed'}
        </div>
      )}

      {children}
    </div>
  );
}
