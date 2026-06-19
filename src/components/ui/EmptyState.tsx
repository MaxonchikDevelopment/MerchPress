import type { ReactNode } from 'react';

// Dashed, faint empty/placeholder state (Maxona idiom, dark-tuned).
export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="empty-state">{children}</div>;
}
