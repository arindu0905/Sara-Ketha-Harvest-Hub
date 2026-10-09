// Shared helpers + CSS + the "system foundations" chapter that appears in every epic guide.

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const code = s => `<code>${esc(s)}</code>`;

/** table(['A','B'], [['1','2']]) – cells are raw HTML so callers can use <code>, <b> etc. */
const table = (head, rows, cls = '') =>
  `<table class="${cls}"><thead><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`;

const qa = list => list.map(([q, a], i) => `<div class="qa"><p class="q">Q${i + 1}. ${q}</p><p class="a">${a}</p></div>`).join('');
const note = (kind, html) => `<div class="note ${kind}">${html}</div>`;
const ul = items => `<ul>${items.map(i => `<li>${i}</li>`).join('')}</ul>`;
const ol = items => `<ol>${items.map(i => `<li>${i}</li>`).join('')}</ol>`;

const CSS = `
@page { size: A4; margin: 18mm 15mm 18mm 15mm; }
* { box-sizing: border-box; }
body { font-family: 'Segoe UI', Arial, sans-serif; color: #1f2937; font-size: 10.5pt; line-height: 1.5; margin: 0; }
h1 { font-size: 26pt; margin: 0 0 4px; color: #14532d; }
h2 { font-size: 15pt; color: #14532d; border-bottom: 2px solid #F5B335; padding-bottom: 4px; margin: 26px 0 10px; page-break-after: avoid; }
h3 { font-size: 12pt; color: #166534; margin: 18px 0 6px; page-break-after: avoid; }
h4 { font-size: 10.5pt; margin: 12px 0 4px; color: #374151; }
p { margin: 6px 0; }
code { font-family: Consolas, monospace; font-size: 9pt; background: #f1f5f9; padding: 1px 4px; border-radius: 3px; color: #0f172a; }
table { border-collapse: collapse; width: 100%; margin: 8px 0 12px; font-size: 9.2pt; page-break-inside: auto; }
th { background: #14532d; color: #fff; text-align: left; padding: 5px 7px; font-weight: 600; }
td { border: 1px solid #d1d5db; padding: 4px 7px; vertical-align: top; }
tr { page-break-inside: avoid; }
tbody tr:nth-child(even) td { background: #f8faf8; }
ul, ol { margin: 6px 0 6px 20px; padding: 0; }
li { margin: 2px 0; }
.cover { height: 235mm; display: flex; flex-direction: column; justify-content: center; page-break-after: always; border-left: 10px solid #F5B335; padding-left: 22px; }
.cover .tag { color: #8D2048; font-weight: 700; letter-spacing: 2px; font-size: 10pt; text-transform: uppercase; }
.cover .sub { font-size: 13pt; color: #374151; margin-top: 8px; }
.cover .meta { margin-top: 28px; color: #6b7280; font-size: 10pt; }
.toc { columns: 2; column-gap: 24px; margin-top: 18px; font-size: 10pt; }
.toc div { margin: 3px 0; }
.note { border-left: 4px solid; padding: 7px 11px; margin: 10px 0; border-radius: 0 6px 6px 0; font-size: 9.6pt; page-break-inside: avoid; }
.note.tip { background: #ecfdf5; border-color: #10b981; }
.note.warn { background: #fffbeb; border-color: #f59e0b; }
.note.key { background: #eff6ff; border-color: #3b82f6; }
.qa { page-break-inside: avoid; margin: 8px 0; }
.q { font-weight: 700; color: #14532d; margin-bottom: 1px; }
.a { margin-top: 1px; padding-left: 12px; border-left: 3px solid #d1fae5; }
.flow { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 12px; font-family: Consolas, monospace; font-size: 8.8pt; white-space: pre-wrap; page-break-inside: avoid; }
.pill { display: inline-block; background: #fef3c7; color: #92400e; border-radius: 9px; padding: 0 7px; font-size: 8.5pt; font-weight: 600; }
.pb { page-break-before: always; }
footer { margin-top: 30px; font-size: 8.5pt; color: #9ca3af; text-align: center; }
`;

const FOUNDATIONS = `
<h2>8. Appendix – system foundations (same in every guide)</h2>
<h3>8.1 Architecture in one picture</h3>
<div class="flow">Browser (React 18 + Vite + Tailwind + TanStack Query + react-hook-form + Zod)
      |  HTTPS, JSON, header  Authorization: Bearer &lt;JWT&gt;
      v
Express REST API  (Node.js + TypeScript)
   helmet · CORS · rate limit · authenticate · requireRole · validate(Zod) · controller · errorHandler
      |  supabase-js  (service-role key, server side only)
      v
Supabase:  PostgreSQL (tables, constraints, RPC functions, triggers)  ·  Auth  ·  Storage (private buckets)</div>
<p><b>Layered design:</b> presentation (React pages) → API/business layer (Express controllers and services) → data layer (Supabase/PostgreSQL). Business rules that must never be bypassed (stock, weights, payments) are enforced in the <b>database</b> through PostgreSQL functions, so even a buggy client cannot break them.</p>

<h3>8.2 Authentication vs authorisation</h3>
${table(['Concept', 'What it answers', 'How HarvestHub does it'], [
  ['Authentication', '"Who are you?"', 'Email + password are checked by <b>Supabase Auth</b>. On success the API returns a <b>JWT access token</b> and a refresh token. The frontend stores them and the Axios interceptor adds <code>Authorization: Bearer &lt;token&gt;</code> to every request; on a 401 it tries the refresh token once, otherwise logs the user out.'],
  ['Authorisation (RBAC)', '"What may you do?"', '<code>authenticate</code> middleware verifies the token with Supabase, loads the user\'s <code>profiles</code> row (role, account_status) and rejects suspended / inactive / pending accounts. <code>requireRole(...)</code> then allows only listed roles (administrator is a superuser). Wrong role → <b>403</b>.'],
  ['Ownership checks', '"Is this YOUR record?"', 'Role alone is not enough: a farmer must not read another farmer\'s data. Controllers call helpers such as <code>assertFarmerAccess</code> / <code>assertBuyerAccess</code> (services/access.ts) → <b>403</b> if the record belongs to someone else.'],
  ['Row Level Security (RLS)', 'DB-level safety net', 'Policies are enabled on tables in Supabase. The API itself uses the service-role key, so the <b>API-layer checks above are the primary control</b>; RLS protects direct database access.']
])}
<p>The nine roles are: <b>farmer, collection_centre_officer, quality_inspector, inventory_manager, buyer, finance_officer, transport_coordinator, manager, administrator</b>. Only <b>farmer</b> and <b>buyer</b> can self-register; staff accounts are created by an administrator.</p>

<h3>8.3 Three layers of validation</h3>
${table(['Layer', 'Tool', 'Purpose', 'Failure looks like'], [
  ['1. Frontend', 'Zod schema + react-hook-form', 'Instant feedback, fewer bad requests. Never trusted on its own.', 'Red message under the field'],
  ['2. API', 'Zod schema via <code>validate()</code> middleware + controller rules', 'The real gate: format, required fields, ownership, state rules.', 'HTTP 400 with <code>{success:false, message, errors:[{field,message}]}</code>'],
  ['3. Database', 'NOT NULL, UNIQUE, CHECK, enums, foreign keys, PL/pgSQL functions', 'Guarantees integrity even if layers 1–2 are bypassed.', 'Exception mapped to 404 / 400 / 409']
])}
${note('key', '<b>Say this in the evaluation:</b> "We validate on the client for usability, on the server for security, and in the database for integrity. The client is never trusted."')}

<h3>8.4 HTTP status codes used</h3>
${table(['Code', 'Meaning', 'Example in this system'], [
  ['200 / 201', 'OK / Created', 'Profile loaded; account or farmer created'],
  ['400', 'Bad request – invalid input', 'Bad NIC format, weak password, quantity ≤ 0'],
  ['401', 'Not authenticated', 'Missing / expired token, wrong password'],
  ['403', 'Authenticated but not allowed', 'Wrong role, or a farmer opening another farmer\'s record, pending farmer logging in'],
  ['404', 'Not found', 'Unknown farmer / order id'],
  ['409', 'Conflict with current state', 'Duplicate NIC, duplicate booking, invalid status transition, insufficient stock'],
  ['429', 'Too many requests', 'Rate limiter (e.g. crop advisor: 30 requests / 15 min)'],
  ['500', 'Server error', 'Unexpected failure (logged by winston)']
])}

<h3>8.5 Cross-cutting security measures</h3>
${ul([
  '<b>helmet</b> security headers; <b>CORS</b> restricted to the configured frontend origin in production.',
  '<b>Rate limiting</b> with express-rate-limit (general API and a stricter limit on <code>/api/auth</code>).',
  '<b>Safe search</b>: user search text is stripped of characters that could alter a PostgREST filter (<code>, ( ) % * \\</code>) and limited to 60 characters.',
  '<b>Mass-assignment protection</b>: update endpoints copy only a whitelist of columns (a farmer cannot set their own verification status).',
  '<b>Generic login error</b> ("Invalid email or password") so attackers cannot discover which emails exist.',
  '<b>Secrets</b> only in <code>.env</code> (service-role key never reaches the browser); private storage buckets with short-lived signed URLs for documents.',
  '<b>Notifications and audit</b>: important actions create in-app notification rows (and emails when SMTP is configured); auction awards and rejections are written to the audit log.'
])}
`;

module.exports = { esc, code, table, qa, note, ul, ol, CSS, FOUNDATIONS };
