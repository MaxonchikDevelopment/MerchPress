// Inline confirmation/error toast. `tone` picks lime (success) vs red (error).
export function Toast({ message, tone = 'success' }: { message: string; tone?: 'success' | 'error' }) {
  return (
    <div className={tone === 'error' ? 'toast toast-error' : 'toast'} role="status" aria-live="polite">
      {tone === 'success' && <span aria-hidden="true">✓</span>}
      {message}
    </div>
  );
}
