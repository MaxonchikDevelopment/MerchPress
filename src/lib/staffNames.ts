import { useEffect, useState } from 'react';
import { staffName } from './orderStatus';

// Staff names by id for display, read from the PIN-free staff_v view. Successful
// lookups are kept for the session; failures are not, so the next mount retries.
const names = new Map<string, string>();
const inflight = new Map<string, Promise<string | null>>();

function lookup(id: string): Promise<string | null> {
  let p = inflight.get(id);
  if (!p) {
    p = staffName(id)
      .then((name) => {
        if (name) names.set(id, name);
        return name;
      })
      .finally(() => inflight.delete(id));
    inflight.set(id, p);
  }
  return p;
}

// Null until resolved, and stays null for an inactive person or a failed read.
export function useStaffName(id: string | null): string | null {
  const [resolved, setResolved] = useState<{ id: string; name: string } | null>(null);
  useEffect(() => {
    if (!id || names.has(id)) return;
    let live = true;
    void lookup(id).then((name) => {
      if (live && name) setResolved({ id, name });
    });
    return () => {
      live = false;
    };
  }, [id]);
  if (!id) return null;
  return names.get(id) ?? (resolved?.id === id ? resolved.name : null);
}
