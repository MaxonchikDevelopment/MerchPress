export type PrintMode = 'Bundle' | 'Custom' | 'None';

// Bundle: same design front and back. None: no design at all. Anything else is Custom.
export function printMode(frontId: string | null, backId: string | null): PrintMode {
  if (frontId === null && backId === null) return 'None';
  if (frontId !== null && frontId === backId) return 'Bundle';
  return 'Custom';
}
