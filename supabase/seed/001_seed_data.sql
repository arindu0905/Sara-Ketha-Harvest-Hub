-- ============================================================
-- HarvestHub Seed Data: Sri Lankan Agricultural Sample Data
-- Currency: LKR | Weight: kg
-- NOTE: All personal data is fictional / generated for demo
-- ============================================================

-- ============================================================
-- COLLECTION CENTRES
-- ============================================================

INSERT INTO public.collection_centres (id, name, code, address, district, phone, email, is_active) VALUES
  ('cc000001-0000-0000-0000-000000000001', 'Dambulla National Agricultural Collection Centre', 'DNACC', 'Dambulla Road, Dambulla, Matale', 'Matale', '0662284512', 'dambulla@harvesthub.lk', TRUE),
  ('cc000002-0000-0000-0000-000000000002', 'Colombo Central Market Collection Centre', 'CCMCC', 'Manning Place, Colombo 10', 'Colombo', '0112694801', 'colombo@harvesthub.lk', TRUE),
  ('cc000003-0000-0000-0000-000000000003', 'Nuwara Eliya Tea & Vegetable Centre', 'NETVCC', 'Park Road, Nuwara Eliya', 'Nuwara Eliya', '0522222561', 'nuwaraeliya@harvesthub.lk', TRUE),
  ('cc000004-0000-0000-0000-000000000004', 'Jaffna Northern Agricultural Centre', 'JNAC', 'Hospital Road, Jaffna', 'Jaffna', '0212222340', 'jaffna@harvesthub.lk', TRUE);

-- ============================================================
-- WAREHOUSES
-- ============================================================

INSERT INTO public.warehouses (id, centre_id, name, code, capacity_kg, is_active) VALUES
  ('wh000001-0000-0000-0000-000000000001', 'cc000001-0000-0000-0000-000000000001', 'Dambulla Main Warehouse A', 'DMB-WH-A', 500000, TRUE),
  ('wh000002-0000-0000-0000-000000000001', 'cc000001-0000-0000-0000-000000000001', 'Dambulla Cold Storage B', 'DMB-CS-B', 200000, TRUE),
  ('wh000003-0000-0000-0000-000000000002', 'cc000002-0000-0000-0000-000000000002', 'Colombo Central Warehouse', 'CCM-WH-A', 300000, TRUE),
  ('wh000004-0000-0000-0000-000000000003', 'cc000003-0000-0000-0000-000000000003', 'Nuwara Eliya Warehouse', 'NE-WH-A', 150000, TRUE);

-- ============================================================
-- CROP CATEGORIES
-- ============================================================

INSERT INTO public.crop_categories (id, name, name_sinhala, description, is_active) VALUES
  ('cat00001-0000-0000-0000-000000000001', 'Rice', 'හාල්', 'Paddy and rice varieties', TRUE),
  ('cat00002-0000-0000-0000-000000000002', 'Tomato', 'තක්කාලි', 'Fresh tomatoes', TRUE),
  ('cat00003-0000-0000-0000-000000000003', 'Carrot', 'කැරට්', 'Fresh carrots', TRUE),
  ('cat00004-0000-0000-0000-000000000004', 'Cabbage', 'ගෝවා', 'Fresh cabbage', TRUE),
  ('cat00005-0000-0000-0000-000000000005', 'Beans', 'බෝංචි', 'Green beans and long beans', TRUE),
  ('cat00006-0000-0000-0000-000000000006', 'Potato', 'ආලු', 'Fresh potatoes', TRUE),
  ('cat00007-0000-0000-0000-000000000007', 'Onion', 'ලූනු', 'Red and white onions', TRUE),
  ('cat00008-0000-0000-0000-000000000008', 'Pumpkin', 'වට්ටක්කා', 'Pumpkin varieties', TRUE),
  ('cat00009-0000-0000-0000-000000000009', 'Banana', 'කෙසෙල්', 'Banana varieties', TRUE),
  ('cat00010-0000-0000-0000-000000000010', 'Papaya', 'ගස්ලබු', 'Ripe and raw papaya', TRUE),
  ('cat00011-0000-0000-0000-000000000011', 'Mango', 'අඹ', 'Mango varieties', TRUE),
  ('cat00012-0000-0000-0000-000000000012', 'Coconut', 'පොල්', 'Coconuts and coconut products', TRUE),
  ('cat00013-0000-0000-0000-000000000013', 'Tea', 'තේ', 'Green leaf and made tea', TRUE),
  ('cat00014-0000-0000-0000-000000000014', 'Pepper', 'ගම්මිරිස්', 'Black and white pepper', TRUE);

-- ============================================================
-- CROP VARIETIES
-- ============================================================

INSERT INTO public.crop_varieties (category_id, name, is_active) VALUES
  ('cat00001-0000-0000-0000-000000000001', 'Samba', TRUE),
  ('cat00001-0000-0000-0000-000000000001', 'Nadu', TRUE),
  ('cat00001-0000-0000-0000-000000000001', 'Keeri Samba', TRUE),
  ('cat00002-0000-0000-0000-000000000002', 'Thakkali Local', TRUE),
  ('cat00002-0000-0000-0000-000000000002', 'Cherry Tomato', TRUE),
  ('cat00002-0000-0000-0000-000000000002', 'Roma', TRUE),
  ('cat00003-0000-0000-0000-000000000003', 'Nantes Carrot', TRUE),
  ('cat00003-0000-0000-0000-000000000003', 'Chantenay', TRUE),
  ('cat00004-0000-0000-0000-000000000004', 'Salted Head', TRUE),
  ('cat00004-0000-0000-0000-000000000004', 'Flat Head', TRUE),
  ('cat00005-0000-0000-0000-000000000005', 'Green Long Beans', TRUE),
  ('cat00005-0000-0000-0000-000000000005', 'French Beans', TRUE),
  ('cat00006-0000-0000-0000-000000000006', 'Katupita', TRUE),
  ('cat00006-0000-0000-0000-000000000006', 'Granola', TRUE),
  ('cat00007-0000-0000-0000-000000000007', 'Bombay Onion', TRUE),
  ('cat00007-0000-0000-0000-000000000007', 'Small Red Onion', TRUE),
  ('cat00009-0000-0000-0000-000000000009', 'Ambul Banana', TRUE),
  ('cat00009-0000-0000-0000-000000000009', 'Kolikuttu', TRUE),
  ('cat00009-0000-0000-0000-000000000009', 'Nethrampalam', TRUE),
  ('cat00011-0000-0000-0000-000000000011', 'Karutha Colomban', TRUE),
  ('cat00011-0000-0000-0000-000000000011', 'Willard', TRUE),
  ('cat00013-0000-0000-0000-000000000013', 'Single Estate Green Leaf', TRUE),
  ('cat00013-0000-0000-0000-000000000013', 'CTC Made Tea', TRUE),
  ('cat00014-0000-0000-0000-000000000014', 'Black Pepper Gariyapatta', TRUE),
  ('cat00014-0000-0000-0000-000000000014', 'White Pepper', TRUE);

-- ============================================================
-- CROP PRICES (LKR per kg)
-- ============================================================

INSERT INTO public.crop_prices (category_id, grade, purchase_price, selling_price, unit, effective_from, status) VALUES
  -- Tomato
  ('cat00002-0000-0000-0000-000000000002', 'grade_a', 180.00, 220.00, 'kg', '2026-01-01', 'active'),
  ('cat00002-0000-0000-0000-000000000002', 'grade_b', 140.00, 170.00, 'kg', '2026-01-01', 'active'),
  ('cat00002-0000-0000-0000-000000000002', 'grade_c', 90.00, 110.00, 'kg', '2026-01-01', 'active'),
  -- Carrot
  ('cat00003-0000-0000-0000-000000000003', 'grade_a', 210.00, 260.00, 'kg', '2026-01-01', 'active'),
  ('cat00003-0000-0000-0000-000000000003', 'grade_b', 160.00, 200.00, 'kg', '2026-01-01', 'active'),
  ('cat00003-0000-0000-0000-000000000003', 'grade_c', 100.00, 130.00, 'kg', '2026-01-01', 'active'),
  -- Cabbage
  ('cat00004-0000-0000-0000-000000000004', 'grade_a', 95.00, 120.00, 'kg', '2026-01-01', 'active'),
  ('cat00004-0000-0000-0000-000000000004', 'grade_b', 70.00, 90.00, 'kg', '2026-01-01', 'active'),
  ('cat00004-0000-0000-0000-000000000004', 'grade_c', 45.00, 60.00, 'kg', '2026-01-01', 'active'),
  -- Beans
  ('cat00005-0000-0000-0000-000000000005', 'grade_a', 320.00, 390.00, 'kg', '2026-01-01', 'active'),
  ('cat00005-0000-0000-0000-000000000005', 'grade_b', 250.00, 300.00, 'kg', '2026-01-01', 'active'),
  ('cat00005-0000-0000-0000-000000000005', 'grade_c', 180.00, 220.00, 'kg', '2026-01-01', 'active'),
  -- Potato
  ('cat00006-0000-0000-0000-000000000006', 'grade_a', 280.00, 340.00, 'kg', '2026-01-01', 'active'),
  ('cat00006-0000-0000-0000-000000000006', 'grade_b', 220.00, 270.00, 'kg', '2026-01-01', 'active'),
  ('cat00006-0000-0000-0000-000000000006', 'grade_c', 160.00, 200.00, 'kg', '2026-01-01', 'active'),
  -- Onion
  ('cat00007-0000-0000-0000-000000000007', 'grade_a', 260.00, 320.00, 'kg', '2026-01-01', 'active'),
  ('cat00007-0000-0000-0000-000000000007', 'grade_b', 200.00, 250.00, 'kg', '2026-01-01', 'active'),
  -- Banana
  ('cat00009-0000-0000-0000-000000000009', 'grade_a', 150.00, 190.00, 'kg', '2026-01-01', 'active'),
  ('cat00009-0000-0000-0000-000000000009', 'grade_b', 110.00, 145.00, 'kg', '2026-01-01', 'active'),
  -- Mango
  ('cat00011-0000-0000-0000-000000000011', 'grade_a', 380.00, 460.00, 'kg', '2026-01-01', 'active'),
  ('cat00011-0000-0000-0000-000000000011', 'grade_b', 280.00, 350.00, 'kg', '2026-01-01', 'active'),
  -- Pepper
  ('cat00014-0000-0000-0000-000000000014', 'grade_a', 1800.00, 2200.00, 'kg', '2026-01-01', 'active'),
  ('cat00014-0000-0000-0000-000000000014', 'grade_b', 1500.00, 1850.00, 'kg', '2026-01-01', 'active');

-- ============================================================
-- SYSTEM SETTINGS
-- ============================================================

INSERT INTO public.system_settings (key, value, description) VALUES
  ('system_name', 'HarvestHub', 'System name displayed in UI'),
  ('default_currency', 'LKR', 'Default currency for all financial transactions'),
  ('default_weight_unit', 'kg', 'Default weight unit'),
  ('max_file_upload_mb', '10', 'Maximum file upload size in MB'),
  ('near_expiry_days', '7', 'Days threshold for near-expiry stock alerts'),
  ('payment_processing_days', '3', 'Standard payment processing days'),
  ('invoice_due_days', '30', 'Default invoice due days'),
  ('low_stock_threshold_kg', '100', 'Threshold for low stock alerts'),
  ('system_email', 'system@harvesthub.lk', 'System notification email'),
  ('support_phone', '0117801234', 'HarvestHub support phone number'),
  ('gst_rate_percent', '0', 'GST/VAT rate percentage'),
  ('transport_deduction_default_lkr', '0', 'Default transport deduction per collection'),
  ('service_charge_percent', '2', 'Default service charge percentage');

-- Note: Actual user accounts (farmers, buyers, staff) are created via Supabase Auth
-- and the handle_new_user() trigger populates profiles.
-- Demo users should be created through the Supabase Auth dashboard or API.
-- Their farmer/buyer records can then be inserted referencing the profile IDs.

-- ============================================================
-- DEMO STORAGE LOCATIONS
-- ============================================================

INSERT INTO public.storage_locations (warehouse_id, code, description, capacity_kg, is_active) VALUES
  ('wh000001-0000-0000-0000-000000000001', 'A1', 'Row A, Bay 1', 50000, TRUE),
  ('wh000001-0000-0000-0000-000000000001', 'A2', 'Row A, Bay 2', 50000, TRUE),
  ('wh000001-0000-0000-0000-000000000001', 'B1', 'Row B, Bay 1', 50000, TRUE),
  ('wh000001-0000-0000-0000-000000000001', 'B2', 'Row B, Bay 2', 50000, TRUE),
  ('wh000002-0000-0000-0000-000000000002', 'CS-1', 'Cold Room 1', 100000, TRUE),
  ('wh000002-0000-0000-0000-000000000002', 'CS-2', 'Cold Room 2', 100000, TRUE),
  ('wh000003-0000-0000-0000-000000000003', 'C1', 'Zone C, Bay 1', 75000, TRUE),
  ('wh000003-0000-0000-0000-000000000003', 'C2', 'Zone C, Bay 2', 75000, TRUE),
  ('wh000004-0000-0000-0000-000000000004', 'NE-1', 'Main Hall Bay 1', 50000, TRUE),
  ('wh000004-0000-0000-0000-000000000004', 'NE-2', 'Main Hall Bay 2', 50000, TRUE);

-- ============================================================
-- TRANSPORT VEHICLES
-- ============================================================

INSERT INTO public.transport_vehicles (centre_id, plate_number, vehicle_type, capacity_kg, is_active) VALUES
  ('cc000001-0000-0000-0000-000000000001', 'WP-CAB-1234', 'truck', 10000, TRUE),
  ('cc000001-0000-0000-0000-000000000001', 'WP-KP-5678', 'van', 3000, TRUE),
  ('cc000001-0000-0000-0000-000000000001', 'NC-3456', 'refrigerated', 5000, TRUE),
  ('cc000002-0000-0000-0000-000000000002', 'WP-AB-9012', 'truck', 8000, TRUE),
  ('cc000002-0000-0000-0000-000000000002', 'CP-GH-3456', 'pickup', 2000, TRUE),
  ('cc000003-0000-0000-0000-000000000003', 'NE-XY-7890', 'van', 2500, TRUE);
