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
      <div
        className={error ? 'shake' : undefined}
        style={{ display: 'flex', gap: 14, justifyContent: 'center', margin: '12px 0 20px' }}
        aria-label={`${pin.length} of 4 digits entered`}
      >
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              width: 20,
              height: 20,
              borderRadius: '50%',
              background: i < pin.length ? 'var(--accent)' : 'var(--surface-raised)',
              border: `1px solid ${i < pin.length ? 'var(--accent)' : 'var(--border-strong)'}`,
              transition: 'background var(--dur-fast) var(--ease), border-color var(--dur-fast) var(--ease)',
            }}
          />
        ))}
      </div>

      {error && (
        <div role="alert" style={{ color: 'var(--danger)', marginBottom: 12, fontWeight: 700 }}>
          {error}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {keys.map((k) => (
          <button key={k} className="btn btn-lg" onClick={() => push(k)} disabled={busy} aria-label={`Digit ${k}`}>
            {k}
          </button>
        ))}
        <button className="btn btn-lg" onClick={() => setPin('')} disabled={busy} aria-label="Clear">
          C
        </button>
        <button className="btn btn-lg btn-primary" onClick={() => push('0')} disabled={busy} aria-label="Digit 0">
          0
        </button>
        <button
          className="btn btn-lg"
          onClick={() => setPin((p) => p.slice(0, -1))}
          disabled={busy}
          aria-label="Backspace"
        >
          ⌫
        </button>
      </div>
    </div>
  );
}
