import type { OrderStatus } from '../types/db';

// Status color tokens — Hyrox-tuned, bright fills with black ink for contrast.
// Values mirror the --status-* CSS tokens in index.css.
export const STATUS_COLORS: Record<OrderStatus, { bg: string; fg: string; label: string }> = {
  new:         { bg: '#c5ff00', fg: '#0b0c0e', label: 'New' },
  in_progress: { bg: '#f59e0b', fg: '#0b0c0e', label: 'In progress' },
  ready:       { bg: '#38bdf8', fg: '#0b0c0e', label: 'Ready' },
  completed:   { bg: '#3a3f4a', fg: '#c7ccd4', label: 'Completed' },
};
