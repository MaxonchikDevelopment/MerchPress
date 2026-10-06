import { useEffect, useState } from 'react';
import { staffNameLookup } from './orderStatus';

// Staff names by id for display, read from the PIN-free staff_v view. Successful
// lookups are kept for the session; failures are never cached.
const names = new Map<string, string>();
const inflight = new Map<string, Promise<{ name: string | null; ok: boolean }>>();

// A failed read is retried after these delays (ms). A person staff_v does not list
// (deactivated) is a clean "not found" and is not retried.
const RETRY_DELAYS = [1500, 4000];

function lookup(id: string): Promise<{ name: string | null; ok: boolean }> {
  let p = inflight.get(id);
  if (!p) {
    p = staffNameLookup(id)
      .then((res) => {
        if (res.name) names.set(id, res.name);
        return res;
      })
      .finally(() => inflight.delete(id));
    inflight.set(id, p);
  }
  return p;
}

// Null until resolved, and stays null for an inactive person or after the retries failed.
export function useStaffName(id: string | null): string | null {
  const [resolved, setResolved] = useState<{ id: string; name: string } | null>(null);
  useEffect(() => {
    if (!id || names.has(id)) return;
    let live = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const attempt = (n: number) => {
      void lookup(id).then((res) => {
        if (!live) return;
        if (res.name) {
          setResolved({ id, name: res.name });
        } else if (!res.ok && n < RETRY_DELAYS.length) {
          timer = setTimeout(() => attempt(n + 1), RETRY_DELAYS[n]);
        }
      });
    };
    attempt(0);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [id]);
  if (!id) return null;
  return names.get(id) ?? (resolved?.id === id ? resolved.name : null);
}
