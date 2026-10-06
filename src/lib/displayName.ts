// True when a person's name only repeats a label already on screen (role label or page
// title), compared case-insensitively and ignoring surrounding space. Used so a person
// named "Admin" does not read "Admin · Admin" or "Admin" twice in the header.
export function repeatsLabel(name: string | null | undefined, ...labels: (string | null | undefined)[]): boolean {
  const n = name?.trim().toLowerCase();
  if (!n) return false;
  return labels.some((l) => l?.trim().toLowerCase() === n);
}
