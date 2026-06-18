import { useState } from 'react';

// 4-digit numeric pad. MVP-only auth — not strong security.
export function PinPad({
  onSubmit,
  error,
  busy,
}: {
  onSubmit: (pin: string) => void;
  error?: string | null;
  busy?: boolean;
}) {
  const [pin, setPin] = useState('');

  const push = (d: string) => {
    if (pin.length >= 4 || busy) return;
    const next = pin + d;
    setPin(next);
    if (next.length === 4) {
      onSubmit(next);
      setPin('');
    }
  };

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

  return (
    <div style={{ maxWidth: 300, margin: '0 auto', textAlign: 'center' }}>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', margin: '12px 0 20px' }}>
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              width: 22,
              height: 22,
              borderRadius: '50%',
              background: i < pin.length ? 'var(--accent)' : 'var(--panel-2)',
              border: '1px solid var(--border)',
            }}
          />
        ))}
      </div>

      {error && <div style={{ color: 'var(--danger)', marginBottom: 12, fontWeight: 700 }}>{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {keys.map((k) => (
          <button key={k} className="btn btn-lg" onClick={() => push(k)} disabled={busy}>
            {k}
          </button>
        ))}
        <button className="btn btn-lg" onClick={() => setPin('')} disabled={busy}>
          C
        </button>
        <button className="btn btn-lg" onClick={() => push('0')} disabled={busy}>
          0
        </button>
        <button className="btn btn-lg" onClick={() => setPin((p) => p.slice(0, -1))} disabled={busy}>
          ⌫
        </button>
      </div>
    </div>
  );
}
