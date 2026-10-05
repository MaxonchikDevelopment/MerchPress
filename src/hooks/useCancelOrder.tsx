import { useState, type ReactNode } from 'react';
import { cancelOrder } from '../lib/orderStatus';
import { ConfirmDialog } from '../components/ConfirmDialog';
import type { Order } from '../types/db';

// Cancel flow shared by Cashier and Press: ask "Cancel order #N?", call
// set_order_status('cancelled'), then refresh the list and report problems.
// `notify` shows an error toast; `refresh` reloads the order list.
export function useCancelOrder(
  userId: string | undefined,
  notify: (message: string) => void,
  refresh: () => void,
): { askCancel: (order: Order) => void; dialog: ReactNode } {
  const [target, setTarget] = useState<Order | null>(null);
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    if (!target || busy) return; // double-tap guard
    const order = target;
    setBusy(true);
    const result = await cancelOrder(order.id, userId);
    setBusy(false);
    setTarget(null);
    if (result === 'failed') {
      notify(`Couldn't cancel order #${order.event_order_no}. Check the connection and tap again.`);
      return;
    }
    if (result === 'already_closed') notify(`Order #${order.event_order_no} was already closed.`);
    refresh(); // the card leaves the list even if realtime is down
  };

  const dialog = target ? (
    <ConfirmDialog
      title={`Cancel order #${target.event_order_no}?`}
      confirmLabel="Cancel order"
      cancelLabel="Keep order"
      busy={busy}
      onConfirm={confirm}
      onCancel={() => setTarget(null)}
    />
  ) : null;

  return { askCancel: setTarget, dialog };
}
