import { roleBasePath } from './roleBase';

/** Where a notification should take the person who clicked it (null = nothing to open). */
export function notificationLink(n: { type?: string; related_entity_type?: string | null; related_entity_id?: string | null }, role?: string | null): string | null {
  const base = roleBasePath(role);
  if (base === '/') return null;
  const type = n.type || '';
  const entity = n.related_entity_type || '';
  const is = (...v: string[]) => v.includes(type) || v.includes(entity);

  if (is('collection_receipt')) return role === 'farmer' ? `${base}/collections` : role === 'collection_centre_officer' ? `${base}/collections` : null;
  if (is('complaint') || type === 'complaint_update') {
    return ['farmer', 'administrator', 'finance_officer', 'inventory_manager', 'quality_inspector', 'transport_coordinator'].includes(role || '') ? `${base}/complaints` : null;
  }
  if (is('delivery_appointment', 'appointment_confirmation')) return ['farmer', 'collection_centre_officer'].includes(role || '') ? `${base}/appointments` : null;
  if (is('farmer_payment', 'payment_approval')) return role === 'farmer' ? `${base}/payments` : role === 'finance_officer' ? `${base}/farmer-invoices` : null;
  if (is('auction_lot', 'bid_result', 'auction_outbid', 'auction_won', 'auction_extended')) {
    if (role === 'buyer') return type === 'auction_won' ? `${base}/auction/won` : `${base}/auction/my-bids`;
    if (role === 'farmer') return `${base}/auction/my-produce`;
    return null;
  }
  if (is('order_approval', 'delivered', 'delivery_completed', 'delivery_dispatched', 'order')) {
    return ['buyer', 'administrator', 'inventory_manager', 'manager'].includes(role || '') ? `${base}/orders` : role === 'transport_coordinator' ? `${base}/dashboard` : null;
  }
  if (is('account_approval')) return role === 'administrator' ? `${base}/users` : null;
  return null;
}
