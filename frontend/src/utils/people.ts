const ROLE_LABELS: Record<string, string> = {
  farmer: 'Farmer',
  collection_centre_officer: 'Collection Centre Officer',
  quality_inspector: 'Quality Inspector',
  inventory_manager: 'Inventory Manager',
  buyer: 'Buyer',
  finance_officer: 'Finance Officer',
  transport_coordinator: 'Transport Coordinator',
  manager: 'Manager',
  administrator: 'Administrator',
};

export const roleLabel = (role?: string | null): string =>
  role ? ROLE_LABELS[role] ?? role.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : '';

/** A person's display name: trimmed, capitalised, and never a raw e-mail address. */
export const personName = (p?: { full_name?: string | null } | null): string => {
  let n = (p?.full_name ?? '').trim().replace(/\s+/g, ' ');
  if (!n) return '';
  if (n.includes('@')) n = n.split('@')[0].replace(/[._-]+/g, ' ').replace(/\d+$/g, '').trim();
  return n.replace(/(^|\s)(\p{L})/gu, (_m, sp, ch) => sp + ch.toUpperCase());
};

/** "4 Oct 2026, 10:42 AM" – readable, in the Sri Lankan locale. */
export const readableDateTime = (v?: string | null): string =>
  v ? new Date(v).toLocaleString('en-LK', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';
