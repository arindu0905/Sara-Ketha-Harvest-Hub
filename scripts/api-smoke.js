#!/usr/bin/env node
/**
 * Read-only API smoke test, run per role against a running backend.
 * It only issues GET requests, plus a few POST/PATCH calls that MUST be refused with 403 by the role guard
 * (empty body, so nothing can be written even if a guard were missing).
 *
 * Credentials are read from the environment – never hard-code them:
 *   SMOKE_FARMER_EMAIL / SMOKE_FARMER_PASSWORD
 *   SMOKE_OFFICER_*, SMOKE_INSPECTOR_*, SMOKE_INVENTORY_*, SMOKE_BUYER_*,
 *   SMOKE_FINANCE_*, SMOKE_TRANSPORT_*, SMOKE_MANAGER_*, SMOKE_ADMIN_*
 * Roles without credentials are skipped.
 *
 *   SMOKE_API=http://localhost:4000/api node scripts/api-smoke.js
 */
const API = process.env.SMOKE_API || 'http://localhost:4000/api';
const ID = '00000000-0000-0000-0000-000000000000';

// [label (user story), method, path, expected status(es)]
const SUITES = {
  FARMER: [
    ['E1-US5 own profile', 'GET', '/farmers/me', [200]],
    ['E1-US7 crop history', 'GET', '/crops', [200]],
    ['E1 documents', 'GET', '/farmers/{farmerId}/documents', [200]],
    ['E2-US1 appointments', 'GET', '/appointments', [200]],
    ['E2-US8 collections', 'GET', '/collections', [200]],
    ['E4-US3 payments', 'GET', '/farmer-payments', [200]],
    ['notifications', 'GET', '/notifications', [200]],
    ['E1-US9 advisor prompt', 'GET', '/bot/prompt?language=en', [200]],
    ['guard: farmer cannot see management reports', 'GET', '/reports/management', [403]],
    ['guard: farmer cannot verify farmers', 'PATCH', `/farmers/${ID}/status`, [403]],
    ['guard: farmer cannot calculate payments', 'POST', '/farmer-payments/calculate', [403]],
  ],
  OFFICER: [
    ['E1-US8 farmer search', 'GET', '/farmers?search=a', [200]],
    ['E2-US1 appointments', 'GET', '/appointments', [200]],
    ['E2-US2 collections', 'GET', '/collections', [200]],
    ['E3 stock view', 'GET', '/inventory', [200]],
    ['guard: officer cannot approve payments', 'PATCH', `/farmer-payments/${ID}/approve`, [403]],
    ['guard: officer cannot see management reports', 'GET', '/reports/management', [403]],
  ],
  INSPECTOR: [
    ['E2-US4 pending inspections', 'GET', '/inspections', [200]],
    ['guard: inspector cannot register farmers', 'POST', '/farmers', [403]],
  ],
  INVENTORY: [
    ['E3-US1/US3 batches & stock', 'GET', '/inventory', [200]],
    ['E3-US2 warehouses', 'GET', '/warehouses', [200]],
    ['E3-US4 expiry overview', 'GET', '/inventory/expiry', [200]],
    ['E3-US4 wastage records', 'GET', '/inventory/wastage', [200]],
    ['E3-US6/7 orders', 'GET', '/orders', [200]],
    ['E3-US12 auctions list', 'GET', '/auctions/my-centre', [200]],
    ['guard: inventory cannot calculate farmer payments', 'POST', '/farmer-payments/calculate', [403]],
  ],
  BUYER: [
    ['E3-US5 buyer profile (own record)', 'GET', '/buyers', [200]],
    ['E3-US5 marketplace prices', 'GET', '/prices/current', [200]],
    ['E3-US6 own orders', 'GET', '/orders', [200]],
    ['E3-US11 my bids', 'GET', '/auctions/my-bids', [200]],
    ['E3-US14 notifications', 'GET', '/notifications', [200]],
    ['E4 own invoices', 'GET', '/invoices', [200]],
    ['guard: buyer cannot see farmer payments', 'GET', '/farmer-payments', [403]],
    ['guard: buyer cannot calculate payments', 'POST', '/farmer-payments/calculate', [403]],
    ['guard: buyer cannot approve orders', 'PATCH', `/orders/${ID}/status`, [403]],
    ['guard: buyer cannot open award board', 'GET', `/auctions/${ID}/award-board`, [403]],
  ],
  FINANCE: [
    ['E4-US1/2 farmer payments', 'GET', '/farmer-payments', [200]],
    ['E4-US4 buyer invoices', 'GET', '/invoices', [200]],
    ['E4-US5 outstanding', 'GET', '/invoices/outstanding', [200, 404]],
    ['E4 payments report', 'GET', '/reports/payments', [200]],
    ['guard: finance cannot register farmers', 'POST', '/farmers', [403]],
  ],
  TRANSPORT: [
    ['E3-US8 deliveries', 'GET', '/deliveries', [200]],
    ['E3-US8 vehicles', 'GET', '/deliveries/vehicles', [200, 404]],
  ],
  MANAGER: [
    ['E4-US6/7/8/9 management report', 'GET', '/reports/management', [200]],
    ['E4-US9 CSV export', 'GET', '/reports/export/operations', [200, 400]],
    ['read-only: manager cannot approve payments', 'PATCH', `/farmer-payments/${ID}/approve`, [403]],
  ],
  ADMIN: [
    ['users', 'GET', '/admin/users', [200]],
    ['audit logs', 'GET', '/admin/audit-logs', [200]],
  ],
};

async function call(method, path, token) {
  const res = await fetch(API + path, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: method === 'GET' ? undefined : '{}',
  });
  let body = null;
  try { body = await res.json(); } catch { /* csv / empty */ }
  return { status: res.status, body };
}

async function login(email, password) {
  const r = await call('POST', '/auth/login', null).catch(() => null); // warm-up / reachability
  if (!r) throw new Error(`Cannot reach ${API} – is the backend running?`);
  const res = await fetch(API + '/auth/login', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password }),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`login failed (${res.status}): ${j.message || ''}`);
  return j.data.access_token;
}

(async () => {
  let pass = 0, fail = 0, skipped = [];
  for (const [role, tests] of Object.entries(SUITES)) {
    const email = process.env[`SMOKE_${role}_EMAIL`], password = process.env[`SMOKE_${role}_PASSWORD`];
    if (!email || !password) { skipped.push(role); continue; }
    console.log(`\n== ${role} ==`);
    let token;
    try { token = await login(email, password); } catch (e) { console.log(`  FAIL login: ${e.message}`); fail++; continue; }
    const ctx = {};
    if (role === 'FARMER') {
      const me = await call('GET', '/farmers/me', token);
      ctx.farmerId = me.body?.data?.id;
    }
    for (const [label, method, rawPath, expected] of tests) {
      const path = rawPath.replace('{farmerId}', ctx.farmerId || ID);
      const { status, body } = await call(method, path, token);
      const ok = expected.includes(status);
      ok ? pass++ : fail++;
      console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}  [${method} ${path} -> ${status}${ok ? '' : ', expected ' + expected.join('/')}]${!ok && body?.message ? '  ' + body.message : ''}`);
    }
  }
  console.log(`\n${pass} passed, ${fail} failed${skipped.length ? `, skipped (no credentials): ${skipped.join(', ')}` : ''}`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e.message); process.exit(1); });
