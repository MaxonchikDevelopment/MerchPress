// Shared wait-time helpers so order cards and the wait timer escalate in
// lockstep. Visual-only — these never affect queue ordering.

export const OVERDUE_MINS = 15;

export function waitMinutes(since: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(since).getTime()) / 60_000));
}
