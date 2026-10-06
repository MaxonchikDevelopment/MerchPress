// Tiny registry of "do not reload now" reasons. Screens acquire a reason while the user
// is in the middle of something and release it when done; the updater reads it.
// Counted per reason, so two open dialogs do not clear each other.
export type BusyReason = 'draft' | 'sending' | 'alert' | 'confirm' | 'pin' | 'status';

const counts = new Map<BusyReason, number>();
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((l) => l());

export function acquireBusy(reason: BusyReason): () => void {
  counts.set(reason, (counts.get(reason) ?? 0) + 1);
  emit();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    const left = (counts.get(reason) ?? 1) - 1;
    if (left > 0) counts.set(reason, left);
    else counts.delete(reason);
    emit();
  };
}

export function busyReasons(): BusyReason[] {
  return [...counts.keys()];
}

export function subscribeBusy(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
