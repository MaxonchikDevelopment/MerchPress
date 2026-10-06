import { createPortal } from 'react-dom';

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
  // Portalled to <body>, fixed to the viewport; the whole backdrop is the dismiss target.
  return createPortal(
    <div className="overlay" onClick={onDismiss} role="alertdialog" aria-label={title} style={{ flexDirection: 'column', textAlign: 'center' }}>
      <div className="pulse alert-card">
        <div className="alert-title">{title}</div>
        {subtitle && <div className="alert-sub">{subtitle}</div>}
      </div>
      <div style={{ marginTop: 28, fontSize: 20, color: 'var(--text-secondary)' }}>Tap to dismiss</div>
    </div>,
    document.body,
  );
}
