// Minimal client-side CSV builder + download (no deps).

function escape(value: unknown, separator: string): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  return s.includes(separator) || /["\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv<T extends Record<string, unknown>>(
  rows: T[],
  columns: { key: keyof T; header: string }[],
  separator = ',',
): string {
  const head = columns.map((c) => escape(c.header, separator)).join(separator);
  const body = rows
    .map((row) => columns.map((c) => escape(row[c.key], separator)).join(separator))
    .join('\n');
  return `${head}\n${body}`;
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
