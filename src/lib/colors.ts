import type { OrderStatus } from '../types/db';

// Status colours come from the --status-* CSS tokens in index.css (single source of truth).
export const STATUS_COLORS: Record<OrderStatus, { bg: string; fg: string; label: string }> = {
  new:         { bg: 'var(--status-new-bg)', fg: 'var(--status-new-ink)', label: 'New' },
  in_progress: { bg: 'var(--status-progress-bg)', fg: 'var(--status-progress-ink)', label: 'In progress' },
  ready:       { bg: 'var(--status-ready-bg)', fg: 'var(--status-ready-ink)', label: 'Ready' },
  completed:   { bg: 'var(--status-done-bg)', fg: 'var(--status-done-ink)', label: 'Completed' },
  cancelled:   { bg: 'var(--status-cancelled-bg)', fg: 'var(--status-cancelled-ink)', label: 'Cancelled' },
};
