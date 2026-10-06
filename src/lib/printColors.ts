// Which shirt colours the cashier sees for the chosen print(s).
//
// bundle: one design on both sides. Colours it is not compatible with are HIDDEN.
// custom: front and back chosen separately. Advisory: incompatible colours are
//         DIMMED but stay visible and selectable.
//
// An empty `compatible_colors` means "any colour" (a wildcard, not an empty set), so it
// never narrows the result. The restrictive lists are intersected.

export type PrintMode = 'bundle' | 'custom';

export interface PrintColorsInput {
  mode: PrintMode;
  chosen: { compatible_colors: string[] }[]; // the chosen design(s), 0 to 2
  colorKeys: string[]; // the event's colours, in display order
  picked: string | null; // the colour currently picked
}

export interface PrintColorsResult {
  visible: string[]; // keys to render, in event order
  dimmed: string[]; // visible keys to render dimmed
  resetColor: boolean; // true when `picked` is no longer allowed and must be cleared
}

export function printColors({ mode, chosen, colorKeys, picked }: PrintColorsInput): PrintColorsResult {
  const lists = chosen.map((d) => d.compatible_colors).filter((l) => l.length > 0);
  const allowed = colorKeys.filter((k) => lists.every((l) => l.includes(k)));
  // No restriction, or the restrictions leave nothing the event offers: show all, advise nothing.
  const unrestricted = lists.length === 0 || allowed.length === 0;

  if (mode === 'bundle') {
    const visible = unrestricted ? colorKeys : allowed;
    return { visible, dimmed: [], resetColor: picked !== null && !visible.includes(picked) };
  }
  return {
    visible: colorKeys,
    dimmed: unrestricted ? [] : colorKeys.filter((k) => !allowed.includes(k)),
    resetColor: false,
  };
}
