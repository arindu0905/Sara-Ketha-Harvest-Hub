select reserve_order_stock('d0000000-0000-0000-0000-000000000003','44444444-4444-4444-4444-444444444444') is not null as reserved;
insert into invoices(id,invoice_no,order_id,buyer_id,subtotal_lkr,total_amount_lkr) values ('e0000000-0000-0000-0000-000000000001','INV-T1','d0000000-0000-0000-0000-000000000003','b0000000-0000-0000-0000-000000000001',6000,6000);
insert into buyer_invoices(invoice_no,order_id,buyer_id,subtotal_lkr,total_amount_lkr) values ('INV-T1','d0000000-0000-0000-0000-000000000003','b0000000-0000-0000-0000-000000000001',6000,6000);
\echo partial 2500
select record_buyer_payment('e0000000-0000-0000-0000-000000000001',2500,'cash',null,'R1',null,'55555555-5555-5555-5555-555555555555');
\echo overpay 5000 (expect error)
select record_buyer_payment('e0000000-0000-0000-0000-000000000001',5000,'cash',null,'R1',null,'55555555-5555-5555-5555-555555555555');
\echo final 3500
select record_buyer_payment('e0000000-0000-0000-0000-000000000001',3500,'bank_transfer',null,'R2',null,'55555555-5555-5555-5555-555555555555');
\echo again (expect already paid)
select record_buyer_payment('e0000000-0000-0000-0000-000000000001',1,'cash',null,'R3',null,null);
select status,amount_paid_lkr from invoices; select status from purchase_orders where id='d0000000-0000-0000-0000-000000000003';
select receipt_no,amount_lkr,balance_after_lkr from payment_receipts order by receipt_no;
\echo farmer payout
select id as fid from farmers limit 1 \gset
insert into farmer_payments(id,payment_no,collection_id,farmer_id,grade,accepted_qty_kg,price_per_kg_lkr,gross_amount_lkr,net_amount_lkr,status,calculated_at)
 values ('a0000000-0000-0000-0000-000000000001','PAY-T1','c0000000-0000-0000-0000-000000000001',:'fid','grade_a',90,180,16200,16000,'calculated',now());
select pay_farmer_payment('a0000000-0000-0000-0000-000000000001','bank_transfer',null,'X','55555555-5555-5555-5555-555555555555');
update farmer_payments set status='approved' where id='a0000000-0000-0000-0000-000000000001';
select pay_farmer_payment('a0000000-0000-0000-0000-000000000001','bank_transfer',null,'X','55555555-5555-5555-5555-555555555555');
select pay_farmer_payment('a0000000-0000-0000-0000-000000000001','bank_transfer',null,'X','55555555-5555-5555-5555-555555555555');
select kind,reference,outstanding_lkr from outstanding_payments;
