\set ON_ERROR_STOP 0
insert into auth.users(id,email) select id::uuid,e from (values
 ('11111111-1111-1111-1111-111111111111','f@x.lk'),('22222222-2222-2222-2222-222222222222','i@x.lk'),('33333333-3333-3333-3333-333333333333','b@x.lk'),('44444444-4444-4444-4444-444444444444','m@x.lk'),('55555555-5555-5555-5555-555555555555','fin@x.lk')) v(id,e);
insert into profiles(id,email,full_name,role,account_status) values
 ('11111111-1111-1111-1111-111111111111','f@x.lk','Farmer F','farmer','active'),
 ('22222222-2222-2222-2222-222222222222','i@x.lk','Inspector','quality_inspector','active'),
 ('33333333-3333-3333-3333-333333333333','b@x.lk','Buyer','buyer','active'),
 ('44444444-4444-4444-4444-444444444444','m@x.lk','InvMgr','inventory_manager','active'),
 ('55555555-5555-5555-5555-555555555555','fin@x.lk','Fin','finance_officer','active') on conflict (id) do update set role=excluded.role, account_status='active', full_name=excluded.full_name;
update farmers set full_name='Farmer F' where profile_id='11111111-1111-1111-1111-111111111111';
select id as fid from farmers where profile_id='11111111-1111-1111-1111-111111111111' \gset
insert into buyers(id,profile_id,buyer_code,company_name,contact_person,email,phone,address,district) values
 ('b0000000-0000-0000-0000-000000000001','33333333-3333-3333-3333-333333333333','B-1','BuyCo','P','b@x.lk','077','a','Colombo');
select id as cat from crop_categories where name ilike '%tomato%' or name ilike '%veg%' limit 1 \gset
select :'cat' as cat;
-- two collections
insert into produce_collections(id,collection_no,farmer_id,centre_id,category_id,gross_weight_kg,container_weight_kg,status)
 values ('c0000000-0000-0000-0000-000000000001','COL-T1',:'fid','cc000001-0000-0000-0000-000000000001',:'cat',110,10,'weighed'),
        ('c0000000-0000-0000-0000-000000000002','COL-T2',:'fid','cc000001-0000-0000-0000-000000000001',:'cat',60,10,'weighed');
\echo --- 1. mismatch qty (expect INVALID_QTY)
select finalize_inspection('c0000000-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222','grade_a',90,5,null,'[]');
\echo --- 2. reject w/o reasons (expect INVALID_QTY)
select finalize_inspection('c0000000-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222','grade_a',90,10,null,'[]');
\echo --- 3. ok partial 90 acc/10 rej
select finalize_inspection('c0000000-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222','grade_a',90,10,'ok','[{"reason":"damaged","quantity_kg":10}]');
\echo --- 4. double inspect (expect INVALID_STATE)
select finalize_inspection('c0000000-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222','grade_a',90,10,'ok','[{"reason":"damaged","quantity_kg":10}]');
\echo --- 5. second collection fully accepted 50
select finalize_inspection('c0000000-0000-0000-0000-000000000002','22222222-2222-2222-2222-222222222222','grade_b',50,0,null,'[]');
select batch_no,grade,available_qty_kg,purchase_price_lkr,expected_expiry_date from inventory_batches order by batch_no;
select receipt_no,accepted_qty_kg,rejected_qty_kg,batch_no from collection_receipts;
select status from produce_collections order by collection_no;
\echo --- ORDERS
insert into purchase_orders(id,order_no,buyer_id,status,centre_id) values ('d0000000-0000-0000-0000-000000000001','ORD-T1','b0000000-0000-0000-0000-000000000001','submitted','cc000001-0000-0000-0000-000000000001'),
 ('d0000000-0000-0000-0000-000000000002','ORD-T2','b0000000-0000-0000-0000-000000000001','submitted','cc000001-0000-0000-0000-000000000001'),
 ('d0000000-0000-0000-0000-000000000003','ORD-T3','b0000000-0000-0000-0000-000000000001','submitted','cc000001-0000-0000-0000-000000000001');
insert into purchase_order_items(order_id,category_id,requested_qty_kg,unit_price_lkr) values
 ('d0000000-0000-0000-0000-000000000001',:'cat',1000,100),
 ('d0000000-0000-0000-0000-000000000002',:'cat',120,100),
 ('d0000000-0000-0000-0000-000000000003',:'cat',60,100);
\echo --- oversell 1000 (expect INSUFFICIENT_STOCK)
select reserve_order_stock('d0000000-0000-0000-0000-000000000001','44444444-4444-4444-4444-444444444444');
\echo --- 120 of 140 avail (expect EXCESSIVE_RESERVATION)
select reserve_order_stock('d0000000-0000-0000-0000-000000000002','44444444-4444-4444-4444-444444444444');
\echo --- 60 ok FEFO
select reserve_order_stock('d0000000-0000-0000-0000-000000000003','44444444-4444-4444-4444-444444444444');
select batch_no,available_qty_kg,reserved_qty_kg,status from inventory_batches order by expected_expiry_date;
select allocated_qty_kg,status from stock_allocations;
select status from purchase_orders where id='d0000000-0000-0000-0000-000000000003';
\echo --- release
select release_order_stock('d0000000-0000-0000-0000-000000000003');
select batch_no,available_qty_kg,reserved_qty_kg,status from inventory_batches order by expected_expiry_date;
\echo --- wastage over qty (expect INVALID_QTY) then ok
select record_wastage((select id from inventory_batches order by batch_no limit 1), 9999,'spoilage');
select record_wastage((select id from inventory_batches order by batch_no limit 1), 5,'spoilage','wilted','44444444-4444-4444-4444-444444444444');
select batch_no,available_qty_kg,wasted_qty_kg from inventory_batches order by batch_no;
\echo --- expiry sweep
update inventory_batches set expected_expiry_date = current_date - 1 where batch_no=(select min(batch_no) from inventory_batches);
select sweep_expired_batches('44444444-4444-4444-4444-444444444444');
select batch_no,available_qty_kg,wasted_qty_kg,status from inventory_batches order by batch_no;
select count(*) as mgr_notifs from notifications where type='wastage_alert';
