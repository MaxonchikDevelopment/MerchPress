// Rules for the Admin Compatibility matrix. `designs.compatible_colors` is a list of colour
// keys and an EMPTY list means "any colour". `palette` is the event's colour keys in palette
// order. Every function is pure and returns a new array.

// Keys shown as ticked, in palette order. An empty stored list reads as all ticked; keys the
// palette does not have are ignored.
export function tickedKeys(stored: string[], palette: string[]): string[] {
  if (stored.length === 0) return [...palette];
  return palette.filter((k) => stored.includes(k));
}

// A stored list with entries but none from the palette: the matrix shows nothing ticked, and the
// cashier screen treats it as "show all".
export function hasNoMatch(stored: string[], palette: string[]): boolean {
  return stored.length > 0 && !stored.some((k) => palette.includes(k));
}

// Ticked keys to the stored form: every colour ticked is an empty list (so a colour added to the
// event later is allowed automatically), otherwise the ticked keys in palette order. Keys outside
// the palette are dropped.
export function toStored(ticked: string[], palette: string[]): string[] {
  const keep = palette.filter((k) => ticked.includes(k));
  return keep.length === palette.length ? [] : keep;
}

// Tap on one cell. Unticking the last ticked colour is blocked: zero ticked would be stored as an
// empty list, which means "any".
export function toggleKey(
  stored: string[],
  palette: string[],
  key: string,
): { next: string[]; blocked: boolean } {
  if (!palette.includes(key)) return { next: stored, blocked: false };
  const ticked = tickedKeys(stored, palette);
  if (!ticked.includes(key)) return { next: toStored([...ticked, key], palette), blocked: false };
  if (ticked.length === 1) return { next: stored, blocked: true };
  return { next: toStored(ticked.filter((k) => k !== key), palette), blocked: false };
}

// "All designs" on a column: tick one colour.
export function tickKey(stored: string[], palette: string[], key: string): string[] {
  if (!palette.includes(key)) return stored;
  return toStored([...tickedKeys(stored, palette), key], palette);
}

// "All" on a row.
export function tickAll(): string[] {
  return [];
}

export const sameList = (a: string[], b: string[]): boolean =>
  a.length === b.length && a.every((k, i) => k === b[i]);
