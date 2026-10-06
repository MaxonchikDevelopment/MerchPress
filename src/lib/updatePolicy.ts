// Pure decisions for applying a new app version. No timers, no DOM.

export type UpdateAction = 'wait' | 'banner' | 'apply';

// Nothing to do without a ready update; a busy app gets the banner; an idle one reloads.
export function updateAction({
  updateReady,
  busyReasons,
}: {
  updateReady: boolean;
  busyReasons: readonly string[];
}): UpdateAction {
  if (!updateReady) return 'wait';
  return busyReasons.length > 0 ? 'banner' : 'apply';
}

export const MIN_UPTIME_MS = 10_000;

export type GuardInput = {
  online: boolean;
  sinceLoadMs: number;
  buildId: string;
  reloadedFromBuild: string | null; // build id this tab last reloaded away from
  appliedThisLoad: boolean;
};

// Why an automatic reload must not happen right now, or null when it may.
export function reloadGuard(g: GuardInput): 'offline' | 'too-early' | 'already-applied' | 'no-progress' | null {
  if (g.appliedThisLoad) return 'already-applied';
  if (g.reloadedFromBuild !== null && g.reloadedFromBuild === g.buildId) return 'no-progress';
  if (!g.online) return 'offline';
  if (g.sinceLoadMs < MIN_UPTIME_MS) return 'too-early';
  return null;
}
