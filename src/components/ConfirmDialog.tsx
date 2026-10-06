import { createPortal } from 'react-dom';
import { Spinner } from './ui/Spinner';

// Modal confirmation sized for touch. Tapping the scrim keeps things as they are.
export function ConfirmDialog({
  title,
  confirmLabel,
  cancelLabel,
  busy,
  onConfirm,
  onCancel,
}: {
  title: string;
  confirmLabel: string;
  cancelLabel: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  // Portalled to <body>: no ancestor transform, animation or overflow can resize or move it.
  return createPortal(
    <div className="overlay" onClick={busy ? undefined : onCancel} role="alertdialog" aria-label={title}>
      <div className="card grid overlay-card" onClick={(e) => e.stopPropagation()}>
        <div style={{ fontSize: 22, fontWeight: 900, overflowWrap: 'anywhere' }}>{title}</div>
        <button className="btn btn-lg btn-danger" disabled={busy} onClick={onConfirm}>
          {busy ? <><Spinner /> …</> : confirmLabel}
        </button>
        <button className="btn btn-lg" disabled={busy} onClick={onCancel}>
          {cancelLabel}
        </button>
      </div>
    </div>,
    document.body,
  );
}
