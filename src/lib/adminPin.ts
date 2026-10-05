// The admin PIN typed at login, kept in memory only. It is never written to
// localStorage or sessionStorage, so a reload or a new tab drops it and the
// Staff tab asks for it again.
let cached: string | null = null;

export const getAdminPin = (): string | null => cached;
export const setAdminPin = (pin: string): void => {
  cached = pin;
};
export const clearAdminPin = (): void => {
  cached = null;
};
