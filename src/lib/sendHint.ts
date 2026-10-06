// Muted line under a disabled "Send to press" button: what is still missing.
// Returns null when nothing is missing.
export function sendHint(color: string | null, size: string | null): string | null {
  if (!color && !size) return 'Pick a color and a size';
  if (!color) return 'Pick a color';
  if (!size) return 'Pick a size';
  return null;
}
