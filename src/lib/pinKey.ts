export type PinKeyAction = { kind: 'digit'; digit: string } | { kind: 'backspace' } | { kind: 'enter' };

export interface PinKeyInput {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  repeat?: boolean;
  targetTag?: string; // tagName of the event target
  targetEditable?: boolean; // contenteditable target
}

// Laptop keyboard for the PIN pad: digits 0-9 (also the numpad), Backspace, Enter.
// Ignores shortcuts, auto-repeat, and events that come from a text field.
export function pinKeyAction(e: PinKeyInput): PinKeyAction | null {
  if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return null;
  const tag = e.targetTag?.toUpperCase();
  if (e.targetEditable || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return null;
  if (/^[0-9]$/.test(e.key)) return { kind: 'digit', digit: e.key };
  if (e.key === 'Backspace') return { kind: 'backspace' };
  if (e.key === 'Enter') return { kind: 'enter' };
  return null;
}
