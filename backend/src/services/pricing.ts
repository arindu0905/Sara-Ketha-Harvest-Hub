/**
 * Which selling price applies to an order line.
 * Only the chosen grade is considered. Among the active prices for that category and grade:
 *   1. a price for the chosen product beats the category-wide price (no product chosen -> category-wide only)
 *   2. a price for the chosen centre beats a price for all centres
 */
export interface PriceRow {
  category_id: string; variety_id?: string | null; centre_id?: string | null; grade: string;
  selling_price: number | string; effective_from?: string; effective_until?: string | null; status?: string;
}

export function resolveSellingPrice(
  prices: PriceRow[],
  q: { category_id: string; variety_id?: string | null; grade?: string | null; centre_id?: string | null },
  today: string = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Colombo' })
): number | null {
  if (!q.category_id || !q.grade) return null;
  const live = prices.filter((p) =>
    p.category_id === q.category_id && p.grade === q.grade && (p.status ?? 'active') === 'active' &&
    (!p.effective_from || String(p.effective_from).slice(0, 10) <= today) &&
    (!p.effective_until || String(p.effective_until).slice(0, 10) >= today) &&
    (p.variety_id ? p.variety_id === q.variety_id : true) &&
    (!p.centre_id || p.centre_id === q.centre_id)
  );
  const rank = (p: PriceRow) => (p.variety_id ? 0 : 1) * 2 + (p.centre_id ? 0 : 1);
  live.sort((a, b) => rank(a) - rank(b));
  const price = Number(live[0]?.selling_price);
  return Number.isFinite(price) && price > 0 ? price : null;
}
