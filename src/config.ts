import type { ShirtSize } from './types/db';

// Shirt colors offered at the booth. `hex` drives the swatch; `text` keeps
// labels readable on the swatch. Adjust per real stock.
export interface ShirtColor {
  key: string;
  label: string;
  hex: string;
  text: '#fff' | '#000';
}

export const SHIRT_COLORS: ShirtColor[] = [
  { key: 'white', label: 'White', hex: '#ffffff', text: '#000' },
  { key: 'black', label: 'Black', hex: '#111111', text: '#fff' },
  { key: 'navy', label: 'Navy', hex: '#1e2a4a', text: '#fff' },
  { key: 'gray', label: 'Gray', hex: '#9aa0a6', text: '#000' },
  { key: 'red', label: 'Red', hex: '#c0392b', text: '#fff' },
];

export const SHIRT_SIZES: ShirtSize[] = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

export const colorLabel = (key: string) =>
  SHIRT_COLORS.find((c) => c.key === key)?.label ?? key;
