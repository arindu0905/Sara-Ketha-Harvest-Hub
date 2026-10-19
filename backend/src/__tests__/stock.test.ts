import { attachStock } from '../services/stock';

const TODAY = '2026-10-19';
const price = (variety_id: string | null, grade: string) => ({ id: `${variety_id}-${grade}`, category_id: 'fruits', variety_id, grade });

describe('Stock next to prices (landing page and public price list)', () => {
  const batches = [
    { category_id: 'fruits', variety_id: 'dragon', grade: 'grade_a', available_qty_kg: 189, expected_expiry_date: '2026-10-14' }, // expired
    { category_id: 'fruits', variety_id: 'dragon', grade: 'grade_b', available_qty_kg: '985', expected_expiry_date: '2026-10-20' },
    { category_id: 'fruits', variety_id: 'dragon', grade: 'grade_c', available_qty_kg: 432, expected_expiry_date: null },
    { category_id: 'fruits', variety_id: 'papaya', grade: 'grade_a', available_qty_kg: 190, expected_expiry_date: TODAY }, // last sellable day
    { category_id: 'fruits', variety_id: 'papaya', grade: 'grade_a', available_qty_kg: 0, expected_expiry_date: null },
    { category_id: 'fruits', variety_id: null, grade: 'grade_a', available_qty_kg: 12.5, expected_expiry_date: null },
    { category_id: 'veg', variety_id: 'dragon', grade: 'grade_b', available_qty_kg: 50, expected_expiry_date: null }, // other category
  ];

  it('counts stock per product and grade, skipping expired batches', () => {
    const [a, b, c] = attachStock([price('dragon', 'grade_a'), price('dragon', 'grade_b'), price('dragon', 'grade_c')], batches, TODAY);
    expect(a.available_kg).toBe(0);
    expect(b.available_kg).toBe(985);
    expect(c.available_kg).toBe(432);
    expect(a.product_available_kg).toBe(1417);
  });

  it('keeps a batch on its expiry date and ignores empty batches', () => {
    const [p] = attachStock([price('papaya', 'grade_a')], batches, TODAY);
    expect(p.available_kg).toBe(190);
  });

  it('matches stock without a product to the category price and keeps categories apart', () => {
    const [general] = attachStock([price(null, 'grade_a')], batches, TODAY);
    expect(general.available_kg).toBe(12.5);
    const [none] = attachStock([price('mango', 'grade_a')], batches, TODAY);
    expect(none).toMatchObject({ available_kg: 0, product_available_kg: 0, id: 'mango-grade_a' });
  });
});
