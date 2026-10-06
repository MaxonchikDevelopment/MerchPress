import { useEffect } from 'react';
import { acquireBusy, type BusyReason } from '../lib/appBusy';

// Marks the app busy (no automatic reload) for as long as `active` is true.
export function useBusy(reason: BusyReason, active = true) {
  useEffect(() => (active ? acquireBusy(reason) : undefined), [reason, active]);
}
