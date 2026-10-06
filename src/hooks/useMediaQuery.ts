import { useSyncExternalStore } from 'react';

// Same breakpoint as the CSS: phones and portrait tablets are under 900 px.
export const NARROW_QUERY = '(max-width: 899.98px)';

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    },
    () => window.matchMedia(query).matches,
  );
}
