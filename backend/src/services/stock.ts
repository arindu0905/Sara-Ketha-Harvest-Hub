/**
 * Sellable stock per product, for showing next to prices.
 *
 * A batch counts when it still has kilograms available, is in a sellable status and has not passed its
 * expiry date (Sri Lanka date). Stock without a product (variety) is matched to the category's own price
 * rows, the same way the buyer marketplace shows it as "general" stock.
 */
export const SELLABLE_BATCH_STATUSES = ['available', 'reserved', 'partially_sold'] as const;

export interface BatchStock {
  category_id: string;
  variety_id: string | null;
  grade: string;
  available_qty_kg: number | string | null;
  expected_expiry_date?: string | null;
}

export interface PriceRow {
  category_id: string;
  variety_id: string | null;
  grade: string;
}

const productKey = (categoryId: string, varietyId: string | null) => `${categoryId}|${varietyId ?? ''}`;
const round3 = (n: number) => Math.round(n * 1000) / 1000;

/** Adds available_kg (that grade) and product_available_kg (all grades of the product) to each price row. */
export function attachStock<T extends PriceRow>(prices: T[], batches: BatchStock[], today: string):
  (T & { available_kg: number; product_available_kg: number })[] {
  const byGrade = new Map<string, number>();
  const byProduct = new Map<string, number>();
  for (const b of batches) {
    const kg = Number(b.available_qty_kg) || 0;
    if (kg <= 0) continue;
    if (b.expected_expiry_date && String(b.expected_expiry_date).slice(0, 10) < today) continue;
    const product = productKey(b.category_id, b.variety_id);
    const grade = `${product}|${b.grade}`;
    byGrade.set(grade, (byGrade.get(grade) || 0) + kg);
    byProduct.set(product, (byProduct.get(product) || 0) + kg);
  }
  return prices.map((p) => {
    const product = productKey(p.category_id, p.variety_id);
    return {
      ...p,
      available_kg: round3(byGrade.get(`${product}|${p.grade}`) || 0),
      product_available_kg: round3(byProduct.get(product) || 0),
    };
  });
}
