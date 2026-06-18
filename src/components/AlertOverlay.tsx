// Full-screen attention overlay shown when an order becomes ready for this
// cashier. Big, tappable to dismiss.
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
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: 'rgba(37, 99, 235, 0.96)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: 24,
      }}
      className="pulse"
    >
      <div style={{ fontSize: 64, fontWeight: 900, marginBottom: 12 }}>{title}</div>
      {subtitle && <div style={{ fontSize: 32, fontWeight: 700 }}>{subtitle}</div>}
      <div style={{ marginTop: 32, fontSize: 20, opacity: 0.9 }}>Tap to dismiss</div>
    </div>
  );
}
