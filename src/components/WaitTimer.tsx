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
  const color = mins >= 15 ? '#dc2626' : mins >= 7 ? '#d97706' : 'var(--muted)';

  return (
    <span style={{ color, fontWeight: 700 }}>
      waiting {mins} min
    </span>
  );
}
