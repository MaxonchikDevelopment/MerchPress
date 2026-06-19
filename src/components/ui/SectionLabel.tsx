import type { CSSProperties, ReactNode } from 'react';

// Quiet uppercase section label (Maxona section-heading idiom).
export function SectionLabel({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div className="label" style={style}>
      {children}
    </div>
  );
}
