import { eventDay } from './eventTime.ts';

export function tally<T extends string | number>(items: T[]): [T, number][] {
  const map = new Map<T, number>();
  for (const i of items) map.set(i, (map.get(i) ?? 0) + 1);
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
}

type DesignRef = { design_front_id: string | null; design_back_id: string | null };

// Each order counts once per DISTINCT design: a bundle counts once, a custom order
// with two different designs counts each once. Ids missing from `names` are skipped.
export function distinctDesignTally(
  orders: DesignRef[],
  names: Map<string, string>,
): [string, number][] {
  const out: string[] = [];
  for (const o of orders) {
    const ids = new Set([o.design_front_id, o.design_back_id]);
    for (const id of ids) {
      const name = id ? names.get(id) : undefined;
      if (name) out.push(name);
    }
  }
  return tally(out);
}

// Orders per EVENT_TZ calendar day, ascending by day.
export function byDay(orders: { created_at: string }[]): [string, number][] {
  return tally(orders.map((o) => eventDay(o.created_at)).filter(Boolean)).sort((a, b) =>
    a[0] < b[0] ? -1 : 1,
  );
}
