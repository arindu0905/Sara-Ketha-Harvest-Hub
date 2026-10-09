export interface PrintRow { label: string; value: string }
export interface PrintDoc {
  title: string;            // e.g. "Collection Receipt"
  number: string;           // e.g. "RCP-2026-000012"
  subtitle?: string;
  sections: { heading?: string; rows: PrintRow[] }[];
  table?: { headers: string[]; rows: string[][] };
  footer?: string;
}

const esc = (v: unknown) =>
  String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

/** Opens a clean printable page (receipts, invoices) and triggers the browser print dialog / Save as PDF. */
export function printDocument(doc: PrintDoc): void {
  const w = window.open('', '_blank', 'width=780,height=900');
  if (!w) { alert('Please allow pop-ups to print or save this document as PDF.'); return; }
  const sections = doc.sections.map(s => `
    ${s.heading ? `<h3>${esc(s.heading)}</h3>` : ''}
    <table class="kv">${s.rows.map(r => `<tr><td>${esc(r.label)}</td><td>${esc(r.value)}</td></tr>`).join('')}</table>`).join('');
  const table = doc.table ? `<table class="grid"><thead><tr>${doc.table.headers.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead>
    <tbody>${doc.table.rows.map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>` : '';
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(doc.title)} ${esc(doc.number)}</title>
  <style>
    body{font-family:Segoe UI,Arial,sans-serif;color:#1f2937;margin:32px;max-width:680px}
    header{border-bottom:3px solid #059669;padding-bottom:10px;margin-bottom:18px}
    h1{margin:0;color:#065f46;font-size:20px} h2{margin:2px 0 0;font-size:15px;font-weight:600}
    h3{margin:18px 0 6px;font-size:13px;text-transform:uppercase;letter-spacing:.05em;color:#6b7280}
    .sub{color:#6b7280;font-size:12px}
    table{width:100%;border-collapse:collapse;font-size:13px}
    .kv td{padding:5px 0;border-bottom:1px solid #f3f4f6} .kv td:first-child{color:#6b7280;width:42%}
    .grid th,.grid td{border:1px solid #e5e7eb;padding:6px 8px;text-align:left} .grid th{background:#f9fafb}
    footer{margin-top:28px;font-size:11px;color:#9ca3af;border-top:1px solid #e5e7eb;padding-top:8px}
    @media print{body{margin:12mm}}
  </style></head><body>
  <header><h1>Sara Ketha Harvest Hub</h1><h2>${esc(doc.title)} · ${esc(doc.number)}</h2>${doc.subtitle ? `<div class="sub">${esc(doc.subtitle)}</div>` : ''}</header>
  ${sections}${table}
  <footer>${esc(doc.footer ?? 'This is a computer-generated document issued by Sara Ketha Harvest Hub.')}</footer>
  <script>window.onload=function(){setTimeout(function(){window.print()},200)}</script></body></html>`);
  w.document.close();
}

export interface ReportSection { heading: string; headers: string[]; rows: (string | number)[][] }

/** Printable multi-table report (management reports, PDF export via the browser's Save as PDF). */
export function printReport(title: string, subtitle: string, sections: ReportSection[]): void {
  const w = window.open('', '_blank', 'width=960,height=760');
  if (!w) { alert('Please allow pop-ups to export the report as PDF.'); return; }
  const body = sections.map(s => `<div class="section"><h3>${esc(s.heading)}</h3>
    <table><thead><tr>${s.headers.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead>
    <tbody>${s.rows.length ? s.rows.map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${s.headers.length}">No data for this period</td></tr>`}</tbody></table></div>`).join('');
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>
    @page{size:A4;margin:14mm} body{font-family:Segoe UI,Arial,sans-serif;font-size:11px;color:#1e293b}
    .head{background:#059669;color:#fff;padding:12px 16px;border-radius:6px;margin-bottom:6px}
    .head h1{margin:0;font-size:18px}.head p{margin:2px 0 0;font-size:11px;opacity:.9}
    .meta{text-align:right;font-size:9px;color:#64748b;margin-bottom:12px}
    .section{margin-bottom:18px;page-break-inside:avoid} h3{font-size:12px;color:#047857;border-left:4px solid #059669;padding-left:8px;margin:0 0 6px}
    table{width:100%;border-collapse:collapse} th{background:#059669;color:#fff;padding:5px 7px;text-align:left;font-size:10px}
    td{padding:4px 7px;border-bottom:1px solid #e2e8f0;font-size:10px} tr:nth-child(even) td{background:#f0fdf4}
    @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
  </style></head><body><div class="head"><h1>Sara Ketha Harvest Hub</h1><p>${esc(title)} · ${esc(subtitle)}</p></div>
  <div class="meta">Generated ${esc(new Date().toLocaleString('en-LK'))}</div>${body}
  <script>window.onload=function(){setTimeout(function(){window.print()},200)}</script></body></html>`);
  w.document.close();
}
