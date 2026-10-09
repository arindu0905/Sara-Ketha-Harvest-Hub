import React from 'react';
import { Download } from 'lucide-react';

/** One CSV cell; values that a spreadsheet could read as a formula are neutralised (CSV injection). */
const cell = (v: unknown): string => {
  let s = v === null || v === undefined ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s) && Number.isNaN(Number(s))) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function downloadCsv(filename: string, headers: string[], rows: unknown[][]): void {
  const csv = '﻿' + [headers, ...rows].map((r) => r.map(cell).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

interface Props {
  filename: string;
  headers: string[];
  rows: unknown[][];
  className?: string;
}

/** Exports exactly what is currently listed on the page (respecting its filters). */
export const ExportCsvButton: React.FC<Props> = ({ filename, headers, rows, className = 'btn-secondary btn-sm' }) => (
  <button
    type="button"
    className={className}
    disabled={rows.length === 0}
    title={rows.length === 0 ? 'Nothing to export' : `Download ${rows.length} row(s) as CSV`}
    onClick={() => downloadCsv(`${filename}_${new Date().toISOString().slice(0, 10)}.csv`, headers, rows)}
  >
    <Download size={14} /> Export CSV
  </button>
);
