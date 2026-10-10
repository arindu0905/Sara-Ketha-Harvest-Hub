/**
 * Saves a photo for every registered product (crop variety) in the database.
 *
 * Run once after RUN_8_product_images.sql:   npm run seed:images           (skips products that already have a photo)
 *                                            npm run seed:images -- --force (replaces existing photos)
 *
 * The pictures live in backend/seed-assets/product-images (credits in CREDITS.md) and are stored in the table
 * product_images; each product keeps a link to its picture in crop_varieties.image_url.
 */
import fs from 'fs';
import path from 'path';
import { supabaseAdmin } from '../config/supabase';

interface ManifestItem { product: string; file: string; mime: string }

const DIR = path.resolve(__dirname, '../../seed-assets/product-images');

async function main(): Promise<void> {
  const force = process.argv.includes('--force');
  const manifest: ManifestItem[] = JSON.parse(fs.readFileSync(path.join(DIR, 'manifest.json'), 'utf8'));

  const probe = await supabaseAdmin.from('product_images').select('id').limit(1);
  if (probe.error) {
    console.error('❌ The product_images table does not exist yet. Run RUN_8_product_images.sql in the Supabase SQL editor first.');
    process.exitCode = 1;
    return;
  }

  const { data: varieties, error } = await supabaseAdmin.from('crop_varieties').select('id, name, image_url');
  if (error) {
    console.error('❌ Could not read products:', error.message);
    process.exitCode = 1;
    return;
  }

  let saved = 0, skipped = 0, missing = 0;
  for (const item of manifest) {
    const variety = (varieties || []).find((v: any) => v.name.trim() === item.product.trim());
    if (!variety) { console.log(`– no product named "${item.product}" – skipped`); missing++; continue; }
    if (variety.image_url && !force) { console.log(`= ${item.product}: already has a photo`); skipped++; continue; }

    const bytes = fs.readFileSync(path.join(DIR, item.file));
    await supabaseAdmin.from('product_images').delete().eq('entity_type', 'variety').eq('entity_id', variety.id);
    const { data: row, error: insErr } = await supabaseAdmin.from('product_images').insert({
      entity_type: 'variety', entity_id: variety.id, file_name: `${item.file}`, mime_type: item.mime,
      size_bytes: bytes.length, image_data: bytes.toString('base64'),
    }).select('id').single();
    if (insErr || !row) { console.error(`❌ ${item.product}: ${insErr?.message}`); continue; }

    const { error: updErr } = await supabaseAdmin.from('crop_varieties').update({ image_url: `/api/product-images/${row.id}` }).eq('id', variety.id);
    if (updErr) { console.error(`❌ ${item.product}: ${updErr.message}`); continue; }
    console.log(`✓ ${item.product}: photo saved (${Math.round(bytes.length / 1024)} KB)`);
    saved++;
  }
  console.log(`\nDone – ${saved} saved, ${skipped} already had one, ${missing} without a matching product.`);
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
