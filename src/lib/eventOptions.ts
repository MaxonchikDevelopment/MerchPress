import { SHIRT_COLORS, SHIRT_SIZES } from '../config';
import type { EventRow, ShirtSize } from '../types/db';

// Per-event shirt options. events.shirt_colors / shirt_sizes override the
// defaults in config.ts; null or empty means "use the defaults".

export interface ShirtColorOption {
  key: string;
  label: string;
  hex: string;
}

export interface EffectiveColor extends ShirtColorOption {
  text: '#fff' | '#000'; // ink colour computed from the hex
}

export interface EventOptions {
  colors: EffectiveColor[];
  sizes: ShirtSize[];
  // Label for a stored colour key; unknown keys show as stored so old orders never break.
  colorLabel: (key: string) => string;
}

const HEX = /^#[0-9a-f]{6}$/i;

// Black or white, whichever has the better contrast on the swatch (WCAG relative luminance).
export function inkFor(hex: string): '#fff' | '#000' {
  const n = parseInt(hex.slice(1), 16);
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const lum = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  return lum > 0.179 ? '#000' : '#fff';
}

const withInk = (c: ShirtColorOption): EffectiveColor => ({ ...c, text: inkFor(c.hex) });

// Validates the jsonb value; returns null when it is not a usable colour list.
export function parseShirtColors(raw: unknown): ShirtColorOption[] | null {
  if (!Array.isArray(raw)) return null;
  const out: ShirtColorOption[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') return null;
    const { key, label, hex } = item as Record<string, unknown>;
    if (typeof key !== 'string' || !key || typeof label !== 'string' || typeof hex !== 'string' || !HEX.test(hex)) {
      return null;
    }
    out.push({ key, label, hex: hex.toLowerCase() });
  }
  return out.length > 0 ? out : null;
}

export function parseShirtSizes(raw: unknown): ShirtSize[] | null {
  if (!Array.isArray(raw)) return null;
  // Keep the canonical XS..XXL order, drop anything else.
  const out = SHIRT_SIZES.filter((s) => raw.includes(s));
  return out.length > 0 ? out : null;
}

export const DEFAULT_COLORS: ShirtColorOption[] = SHIRT_COLORS;

export function eventOptions(event: Pick<EventRow, 'shirt_colors' | 'shirt_sizes'> | null | undefined): EventOptions {
  const colors = (parseShirtColors(event?.shirt_colors) ?? DEFAULT_COLORS).map(withInk);
  const sizes = parseShirtSizes(event?.shirt_sizes) ?? SHIRT_SIZES;
  return {
    colors,
    sizes,
    colorLabel: (key) => colors.find((c) => c.key === key)?.label ?? key,
  };
}

// Unique slug key for a new colour, distinct from `taken`.
export function newColorKey(label: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  const base =
    label
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'color';
  let key = base;
  for (let i = 2; used.has(key); i++) key = `${base}-${i}`;
  return key;
}
