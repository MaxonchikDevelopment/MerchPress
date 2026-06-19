// Full-screen attention overlay shown when an order becomes ready for this
// cashier. Big, tappable to dismiss. Dark scrim with a pulsing lime accent ring.
export function AlertOverlay({
  title,
  subtitle,
  onDismiss,
}: {
  title: string;
  subtitle?: string;
  onDismiss: () => void;
}) {
  return (
    <div
      onClick={onDismiss}
      role="alertdialog"
      aria-label={title}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: 'var(--surface-overlay)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: 24,
      }}
    >
      <div
        className="pulse"
        style={{
          background: 'var(--accent)',
          color: 'var(--accent-ink)',
          borderRadius: 'var(--r-card)',
          padding: '48px 40px',
          maxWidth: 640,
          width: '100%',
        }}
      >
        <div style={{ fontSize: 56, fontWeight: 900, lineHeight: 1.05, fontVariantNumeric: 'tabular-nums' }}>{title}</div>
        {subtitle && <div style={{ fontSize: 30, fontWeight: 700, marginTop: 12 }}>{subtitle}</div>}
      </div>
      <div style={{ marginTop: 28, fontSize: 20, color: 'var(--text-secondary)' }}>Tap to dismiss</div>
    </div>
  );
}
