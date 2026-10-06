// Event date helpers. Dates are YYYY-MM-DD strings, parsed by splitting the parts
// so there is no local-time shift (never new Date(string)).

export const END_DATE_ERROR = 'End date must be on or after the start date.';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface Parts {
  y: number;
  m: number;
  d: number;
}

const parse = (s: string): Parts | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!match) return null;
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  return m >= 1 && m <= 12 && d >= 1 && d <= 31 ? { y, m, d } : null;
};

// True when both dates are set and the end is before the start (YYYY-MM-DD sorts as text).
export const isEndBeforeStart = (start: string | null, end: string | null): boolean =>
  !!start && !!end && end < start;

// "10 Oct 2026", "10–11 Oct 2026", "30 Oct – 2 Nov 2026", "31 Dec 2026 – 1 Jan 2027", or "" without a start.
export function formatEventDates(start: string | null, end: string | null): string {
  const a = start ? parse(start) : null;
  if (!a) return '';
  const b = end ? parse(end) : null;
  const one = (p: Parts) => `${p.d} ${MONTHS[p.m - 1]} ${p.y}`;
  if (!b || (b.y === a.y && b.m === a.m && b.d === a.d)) return one(a);
  if (b.y !== a.y) return `${one(a)} – ${one(b)}`;
  if (b.m !== a.m) return `${a.d} ${MONTHS[a.m - 1]} – ${one(b)}`;
  return `${a.d}–${b.d} ${MONTHS[a.m - 1]} ${a.y}`;
}
