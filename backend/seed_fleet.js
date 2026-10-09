/**
 * Adds 10 vehicles and 10 drivers (sample fleet) to the database. Safe to re-run: records that already exist
 * (same plate number / same NIC) are skipped.   Usage:  node seed_fleet.js
 * Uses the same service-role key as the API (backend/.env).
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const s = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

// vehicle_type must be one of: truck | refrigerated | van | pickup
const VEHICLES = [
  ['WP LA-4521', 'truck', 8000],        ['WP LB-7712', 'truck', 10000],
  ['CP KC-3308', 'truck', 6000],        ['NC KD-9054', 'refrigerated', 5000],
  ['WP LF-1186', 'refrigerated', 4500], ['CP KH-6642', 'van', 3000],
  ['SP GK-2279', 'van', 2500],          ['NW PM-8815', 'van', 2000],
  ['WP LR-5560', 'pickup', 1500],       ['UVA BQ-3347', 'pickup', 1500],
];

// [full name, NIC (old 9 digits + V, or new 12 digits), mobile, licence no]
const DRIVERS = [
  ['Nuwan Jayasinghe',    '821456789V',   '0712345601', 'B2145601'],
  ['Kasun Wickramasinghe', '199134506712', '0712345602', 'B2145602'],
  ['Chaminda Rathnayake', '796712345V',   '0712345603', 'B2145603'],
  ['Prasad Weerasekara',  '198567801234', '0712345604', 'B2145604'],
  ['Dilshan Fernando',    '902345678V',   '0712345605', 'B2145605'],
  ['Ruwan Bandara',       '199245601289', '0712345606', 'B2145606'],
  ['Lasantha Gunawardena', '837812345V',  '0712345607', 'B2145607'],
  ['Mahesh Karunaratne',  '198878904567', '0712345608', 'B2145608'],
  ['Thilina Senanayake',  '881234567V',   '0712345609', 'B2145609'],
  ['Sampath Dissanayake', '199356708912', '0712345610', 'B2145610'],
];

(async () => {
  const { data: centres } = await s.from('collection_centres').select('id, name').eq('is_active', true).order('name');
  const { data: coordinator } = await s.from('profiles').select('id').eq('role', 'transport_coordinator').limit(1).maybeSingle();
  const centreFor = i => (centres && centres.length ? centres[i % centres.length].id : null); // spread over the centres

  const { data: haveV } = await s.from('transport_vehicles').select('plate_number');
  const { data: haveD } = await s.from('drivers').select('nic_number');
  const plates = new Set((haveV || []).map(v => v.plate_number.replace(/\s+/g, '').toUpperCase()));
  const nics = new Set((haveD || []).map(d => d.nic_number.toUpperCase()));

  const vRows = VEHICLES.filter(([p]) => !plates.has(p.replace(/\s+/g, '').toUpperCase())).map(([plate, type, cap], i) => ({
    plate_number: plate, vehicle_type: type, capacity_kg: cap, centre_id: centreFor(i), is_active: true, created_by: coordinator ? coordinator.id : null,
  }));
  const dRows = DRIVERS.filter(([, nic]) => !nics.has(nic.toUpperCase())).map(([name, nic, phone, lic], i) => ({
    full_name: name, nic_number: nic, phone, license_no: lic, centre_id: centreFor(i), is_active: true, created_by: coordinator ? coordinator.id : null,
  }));

  if (vRows.length) { const r = await s.from('transport_vehicles').insert(vRows).select('id'); console.log('vehicles inserted:', r.error ? 'ERROR ' + r.error.message : r.data.length); }
  else console.log('vehicles: all already present');
  if (dRows.length) { const r = await s.from('drivers').insert(dRows).select('id'); console.log('drivers inserted: ', r.error ? 'ERROR ' + r.error.message : r.data.length); }
  else console.log('drivers: all already present');

  const { count: vc } = await s.from('transport_vehicles').select('id', { count: 'exact', head: true });
  const { count: dc } = await s.from('drivers').select('id', { count: 'exact', head: true });
  console.log('totals in database -> vehicles:', vc, '| drivers:', dc);
})();
