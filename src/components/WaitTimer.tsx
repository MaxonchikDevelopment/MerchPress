import { useEffect, useState } from 'react';

// Shows "waiting X min" since a timestamp, updating every 10s. Turns amber/red
// as the wait grows so the press station sees what's getting stale.
export function WaitTimer({ since }: { since: string }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(t);
  }, []);

  const mins = Math.max(0, Math.floor((now - new Date(since).getTime()) / 60_000));
  const overdue = mins >= 15;
  const color = overdue ? 'var(--danger)' : mins >= 7 ? 'var(--warn)' : 'var(--text-muted)';

  return (
    <span style={{ color, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
      {overdue && <span aria-hidden="true">⏱ </span>}
      waiting {mins} min
    </span>
  );
}
