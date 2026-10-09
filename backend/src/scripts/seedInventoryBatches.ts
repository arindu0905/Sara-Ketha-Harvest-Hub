import { supabaseAdmin } from '../config/supabase';

async function seedInventoryBatches() {
  console.log('Fetching collections...');
  const { data: collections, error: colErr } = await supabaseAdmin
    .from('produce_collections')
    .select(`
      id, collection_no, net_weight_kg, status, created_at,
      category_id, variety_id, farmer_id, centre_id,
      quality_inspections(id, grade, accepted_qty_kg, rejected_qty_kg, approved_at)
    `);

  if (colErr) {
    console.error('Error fetching collections:', colErr);
    process.exit(1);
  }

  console.log(`Found ${collections?.length || 0} collections.`);

  const { data: defaultWarehouse } = await supabaseAdmin
    .from('warehouses')
    .select('id')
    .limit(1)
    .maybeSingle();

  for (const col of (collections || [])) {
    const insp = Array.isArray(col.quality_inspections) ? col.quality_inspections[0] : col.quality_inspections;
    const acceptedWeight = Number(insp?.accepted_qty_kg || col.net_weight_kg || 50);
    const rawGrade = (insp?.grade || 'grade_a').toLowerCase().replace(/\s+/g, '_');
    const validGrade = ['grade_a', 'grade_b', 'grade_c', 'premium'].includes(rawGrade) ? rawGrade : 'grade_a';
    const numDigits = col.collection_no ? col.collection_no.replace(/[^0-9]/g, '') : `${Date.now()}`;
    const batchNo = `BAT-${numDigits}`;

    const batchData = {
      batch_no: batchNo,
      qr_code_value: `HH-${batchNo}`,
      collection_id: col.id,
      farmer_id: col.farmer_id,
      category_id: col.category_id,
      variety_id: col.variety_id || null,
      grade: validGrade,
      initial_qty_kg: acceptedWeight > 0 ? acceptedWeight : 50,
      available_qty_kg: acceptedWeight > 0 ? acceptedWeight : 50,
      reserved_qty_kg: 0,
      sold_qty_kg: 0,
      wasted_qty_kg: Number(insp?.rejected_qty_kg || 0),
      purchase_price_lkr: 120,
      selling_price_lkr: 150,
      received_date: col.created_at ? new Date(col.created_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      expected_expiry_date: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
      warehouse_id: defaultWarehouse?.id || null,
      status: col.status === 'rejected' ? 'disposed' : 'available',
    };

    const { error: insErr } = await supabaseAdmin
      .from('inventory_batches')
      .upsert(batchData, { onConflict: 'batch_no' });

    if (insErr) {
      console.error(`Error inserting batch for collection ${col.collection_no}:`, insErr.message);
    } else {
      console.log(`Successfully saved batch ${batchNo} for collection ${col.collection_no}`);
    }
  }

  console.log('Seeding completed!');
}

seedInventoryBatches().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
