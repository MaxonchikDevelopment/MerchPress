// One-line summary of what is chosen so far in the New order form, e.g.
// "Black · M · Front: Name · Back: Name". Only chosen parts appear. A bundle shows its
// name once ("Black · M · Bundle: Name") instead of the same name on both sides.
export function orderSummary(parts: {
  colorLabel: string | null;
  size: string | null;
  frontName: string | null;
  backName: string | null;
  bundleName?: string | null;
}): string {
  return [
    parts.colorLabel,
    parts.size,
    parts.bundleName ? `Bundle: ${parts.bundleName}` : null,
    !parts.bundleName && parts.frontName ? `Front: ${parts.frontName}` : null,
    !parts.bundleName && parts.backName ? `Back: ${parts.backName}` : null,
  ]
    .filter((p): p is string => !!p)
    .join(' · ');
}
