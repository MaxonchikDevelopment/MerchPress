import type { Staff } from '../types/db';

// Remembers the last successfully authenticated user so the login screen can
// offer a "Continue as <name>" shortcut. This is a UI convenience only — it
// never bypasses the PIN: "Continue as" still jumps to the PIN step in prod.
// Kept separate from the auth session (`mpq.session`) so SessionContext and
// its auth behavior stay untouched.

const KEY = 'mpq.lastUser';

export function getLastUser(): Staff | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const u = JSON.parse(raw) as Staff;
    return u && u.id && u.role ? u : null;
  } catch {
    return null;
  }
}

export function setLastUser(user: Staff): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(user));
  } catch {
    /* storage disabled — shortcut just won't appear */
  }
}

export function clearLastUser(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
