/**
 * Loads the Sri Lankan product catalogue and today's market prices (seed-assets/sri-lanka-catalog.json).
 *
 *   npm run seed:catalog              – adds missing products, replaces the active price list
 *   npm run seed:catalog -- --dry-run – shows what would change, writes nothing
 *
 * Existing products are kept (only an empty description is filled in). Old active prices are not deleted:
 * they are marked "superseded" with an end date, exactly like a price change made in Price Management.
 */
import fs from 'fs';
import path from 'path';
import { supabaseAdmin } from '../config/supabase';

interface Product { category: string; name: string; description: string; purchase: number; selling: number; source: string }
interface Catalog {
  effective_from: string;
  grade_factors: Record<string, number>;
  category_fallback: Record<string, { purchase: number; selling: number }>;
  products: Product[];
}

const round5 = (n: number) => Math.round(n / 5) * 5;

async function main(): Promise<void> {
  const dry = process.argv.includes('--dry-run');
  const cat: Catalog = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../seed-assets/sri-lanka-catalog.json'), 'utf8'));

  const { data: categories, error: cErr } = await supabaseAdmin.from('crop_categories').select('id, name, crop_varieties(id, name, description)');
  if (cErr) throw new Error(cErr.message);
  const catByName = new Map((categories || []).map((c: any) => [c.name.toLowerCase(), c]));

  // 1. products
  let added = 0, described = 0;
  const varietyId = new Map<string, string>();
  for (const p of cat.products) {
    const c: any = catByName.get(p.category.toLowerCase());
    if (!c) throw new Error(`Category "${p.category}" does not exist`);
    const existing = (c.crop_varieties || []).find((v: any) => v.name.trim().toLowerCase() === p.name.trim().toLowerCase());
    if (existing) {
      varietyId.set(p.name, existing.id);
      if (!existing.description) {
        described++;
        if (!dry) await supabaseAdmin.from('crop_varieties').update({ description: p.description }).eq('id', existing.id);
      }
      continue;
    }
    added++;
    if (dry) { console.log(`+ would add ${p.category}: ${p.name}`); continue; }
    const { data, error } = await supabaseAdmin.from('crop_varieties')
      .insert({ category_id: c.id, name: p.name, description: p.description, is_active: true }).select('id').single();
    if (error) throw new Error(`${p.name}: ${error.message}`);
    varietyId.set(p.name, data.id);
    console.log(`+ added ${p.category}: ${p.name}`);
  }

  // 2. prices: supersede the current list, then insert the new one (Grade A/B/C per product + a category fallback)
  const categoryIds = [...new Set(cat.products.map((p) => (catByName.get(p.category.toLowerCase()) as any).id))];
  const rows: Record<string, unknown>[] = [];
  const grades = Object.entries(cat.grade_factors);
  for (const p of cat.products) {
    const c: any = catByName.get(p.category.toLowerCase());
    for (const [grade, f] of grades) {
      rows.push({ category_id: c.id, variety_id: varietyId.get(p.name) ?? null, centre_id: null, grade,
        purchase_price: round5(p.purchase * f), selling_price: round5(p.selling * f), unit: 'kg',
        effective_from: cat.effective_from, status: 'active' });
    }
  }
  for (const [name, fb] of Object.entries(cat.category_fallback)) {
    const c: any = catByName.get(name.toLowerCase());
    if (!c) continue;
    for (const [grade, f] of grades) {
      rows.push({ category_id: c.id, variety_id: null, centre_id: null, grade, purchase_price: round5(fb.purchase * f),
        selling_price: round5(fb.selling * f), unit: 'kg', effective_from: cat.effective_from, status: 'active' });
    }
  }

  const { count: activeBefore } = await supabaseAdmin.from('crop_prices').select('id', { count: 'exact', head: true })
    .eq('status', 'active').in('category_id', categoryIds);

  if (dry) {
    console.log(`\nDry run: ${added} products to add, ${described} descriptions to fill, ${activeBefore} active prices to supersede, ${rows.length} new prices.`);
    return;
  }

  const yesterday = new Date(Date.parse(cat.effective_from) - 86400000).toISOString().slice(0, 10);
  const { error: supErr } = await supabaseAdmin.from('crop_prices')
    .update({ status: 'superseded', effective_until: yesterday, updated_at: new Date().toISOString() })
    .eq('status', 'active').in('category_id', categoryIds);
  if (supErr) throw new Error(`Could not supersede the old prices: ${supErr.message}`);

  const { error: insErr } = await supabaseAdmin.from('crop_prices').insert(rows);
  if (insErr) throw new Error(`Could not insert the new prices: ${insErr.message}`);

  console.log(`\nDone – ${added} products added, ${described} descriptions filled, ${activeBefore} old prices superseded, ${rows.length} new prices (effective ${cat.effective_from}).`);
}

main().catch((e) => { console.error('❌', e.message || e); process.exitCode = 1; });
