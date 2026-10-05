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
  return (
    <div
      onClick={busy ? undefined : onCancel}
      role="alertdialog"
      aria-label={title}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: 'var(--surface-overlay)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        className="card grid"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 420, width: '100%', gap: 'var(--sp-4)', textAlign: 'center' }}
      >
        <div style={{ fontSize: 26, fontWeight: 900 }}>{title}</div>
        <button className="btn btn-lg btn-danger" disabled={busy} onClick={onConfirm}>
          {busy ? <><Spinner /> …</> : confirmLabel}
        </button>
        <button className="btn btn-lg" disabled={busy} onClick={onCancel}>
          {cancelLabel}
        </button>
      </div>
    </div>
  );
}
