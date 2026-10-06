import { createPortal } from 'react-dom';

// Full-screen photo viewer. Tap anywhere closes. zIndex stays below the
// Ready alert overlay (100) so an alert always wins.
export function ImageLightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  return createPortal(
    <div
      role="dialog"
      aria-label={alt}
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 90,
        background: 'var(--surface-overlay)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <img src={src} alt={alt} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
      <button
        className="btn"
        aria-label="Close"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        style={{ position: 'absolute', top: 'max(16px, env(safe-area-inset-top))', right: 16 }}
      >
        Close
      </button>
    </div>,
    document.body,
  );
}
