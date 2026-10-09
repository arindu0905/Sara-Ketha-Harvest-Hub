/** URL prefix of each role's portal (the role name and the route prefix differ for several roles). */
const ROLE_BASE: Record<string, string> = {
  farmer: '/farmer',
  collection_centre_officer: '/officer',
  quality_inspector: '/inspector',
  inventory_manager: '/inventory',
  buyer: '/buyer',
  finance_officer: '/finance',
  transport_coordinator: '/transport',
  manager: '/manager',
  administrator: '/admin',
};

export const roleBasePath = (role?: string | null): string => (role && ROLE_BASE[role]) || '/';

/** Portal prefix of whoever is signed in right now (for components rendered under several role portals). */
export const currentRoleBase = (): string => {
  try { return roleBasePath(JSON.parse(localStorage.getItem('hh_user') || '{}').role); } catch { return '/'; }
};
