// Events outside this zone (for example Riga) would need a per-event zone.
export const EVENT_TZ = 'Europe/Warsaw';

const fmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: EVENT_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

function parts(iso: string): Record<string, string> | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const out: Record<string, string> = {};
  for (const p of fmt.formatToParts(d)) out[p.type] = p.value;
  return out;
}

// "YYYY-MM-DD HH:mm" in EVENT_TZ; empty string for null, empty or unparseable input.
export function formatEventTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const p = parts(iso);
  return p ? `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}` : '';
}

// "YYYY-MM-DD" calendar day in EVENT_TZ.
export function eventDay(iso: string | null | undefined): string {
  return formatEventTime(iso).slice(0, 10);
}
