import type { ShirtSize } from './types/db';

// Default shirt options, used when an event has no shirt_colors / shirt_sizes
// of its own (see lib/eventOptions.ts). `hex` drives the swatch; the ink colour
// is computed from it.
export const SHIRT_COLORS = [
  { key: 'white', label: 'White', hex: '#ffffff' },
  { key: 'black', label: 'Black', hex: '#111111' },
  { key: 'navy', label: 'Navy', hex: '#1e2a4a' },
  { key: 'gray', label: 'Gray', hex: '#9aa0a6' },
  { key: 'red', label: 'Red', hex: '#c0392b' },
];

export const SHIRT_SIZES: ShirtSize[] = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
