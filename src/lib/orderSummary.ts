// One-line summary of what is chosen so far in the New order form, e.g.
// "Black · M · Front: Name · Back: Name". Only chosen parts appear.
export function orderSummary(parts: {
  colorLabel: string | null;
  size: string | null;
  frontName: string | null;
  backName: string | null;
}): string {
  return [
    parts.colorLabel,
    parts.size,
    parts.frontName ? `Front: ${parts.frontName}` : null,
    parts.backName ? `Back: ${parts.backName}` : null,
  ]
    .filter((p): p is string => !!p)
    .join(' · ');
}
