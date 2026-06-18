import type { OrderStatus } from '../types/db';

// Status color tokens — clear, glanceable, consistent across screens.
export const STATUS_COLORS: Record<OrderStatus, { bg: string; fg: string; label: string }> = {
  new:         { bg: '#16a34a', fg: '#ffffff', label: 'New' },
  in_progress: { bg: '#d97706', fg: '#ffffff', label: 'In progress' },
  ready:       { bg: '#2563eb', fg: '#ffffff', label: 'Ready' },
  completed:   { bg: '#6b7280', fg: '#ffffff', label: 'Completed' },
};
