-- Migration: 020_backfill_invoices_data.sql
-- Populate existing purchase_orders and farmer_payments data into buyer_invoices and farmer_invoices tables

-- 1. Copy from public.invoices into public.buyer_invoices
INSERT INTO public.buyer_invoices (
  invoice_no, order_id, buyer_id, issue_date, due_date,
  subtotal_lkr, tax_amount_lkr, discount_lkr, total_amount_lkr,
  status, notes, created_at, updated_at, created_by
)
SELECT 
  inv.invoice_no, inv.order_id, inv.buyer_id, inv.issue_date, inv.due_date,
  inv.subtotal_lkr, inv.tax_amount_lkr, inv.discount_lkr, inv.total_amount_lkr,
  inv.status, inv.notes, inv.created_at, inv.updated_at, inv.created_by
FROM public.invoices inv
ON CONFLICT (invoice_no) DO NOTHING;

-- 2. Populate buyer_invoices & invoices for any purchase_orders currently missing invoice records
INSERT INTO public.invoices (
  invoice_no, order_id, buyer_id, issue_date, due_date,
  subtotal_lkr, tax_amount_lkr, discount_lkr, total_amount_lkr,
  status, created_at
)
SELECT 
  'INV-2026-' || LPAD(ROW_NUMBER() OVER (ORDER BY po.created_at)::TEXT, 6, '0'),
  po.id, po.buyer_id, po.created_at::DATE, (po.created_at + INTERVAL '30 days')::DATE,
  COALESCE(po.total_amount_lkr, 0), 0, 0, COALESCE(po.total_amount_lkr, 0),
  CASE WHEN po.status = 'completed' THEN 'paid' ELSE 'issued' END,
  po.created_at
FROM public.purchase_orders po
WHERE NOT EXISTS (
  SELECT 1 FROM public.invoices inv WHERE inv.order_id = po.id
)
ON CONFLICT (invoice_no) DO NOTHING;

INSERT INTO public.buyer_invoices (
  invoice_no, order_id, buyer_id, issue_date, due_date,
  subtotal_lkr, tax_amount_lkr, discount_lkr, total_amount_lkr,
  status, created_at
)
SELECT 
  'INV-2026-' || LPAD(ROW_NUMBER() OVER (ORDER BY po.created_at)::TEXT, 6, '0'),
  po.id, po.buyer_id, po.created_at::DATE, (po.created_at + INTERVAL '30 days')::DATE,
  COALESCE(po.total_amount_lkr, 0), 0, 0, COALESCE(po.total_amount_lkr, 0),
  CASE WHEN po.status = 'completed' THEN 'paid' ELSE 'issued' END,
  po.created_at
FROM public.purchase_orders po
WHERE NOT EXISTS (
  SELECT 1 FROM public.buyer_invoices bi WHERE bi.order_id = po.id
)
ON CONFLICT (invoice_no) DO NOTHING;

-- 3. Populate farmer_invoices from existing farmer_payments
INSERT INTO public.farmer_invoices (
  invoice_no, payment_id, collection_id, farmer_id, issue_date, due_date,
  gross_amount_lkr, deductions_lkr, net_amount_lkr, status, payment_method, payment_date, created_at
)
SELECT 
  'FINV-2026-' || LPAD(ROW_NUMBER() OVER (ORDER BY fp.created_at)::TEXT, 6, '0'),
  fp.id, fp.collection_id, fp.farmer_id, fp.created_at::DATE, (fp.created_at + INTERVAL '7 days')::DATE,
  COALESCE(fp.gross_amount_lkr, 0), COALESCE(fp.total_deductions_lkr, 0), COALESCE(fp.net_amount_lkr, 0),
  CASE WHEN fp.status = 'paid' THEN 'paid' WHEN fp.status = 'approved' THEN 'approved' ELSE 'calculated' END,
  fp.payment_method, fp.payment_date, fp.created_at
FROM public.farmer_payments fp
WHERE NOT EXISTS (
  SELECT 1 FROM public.farmer_invoices fi WHERE fi.payment_id = fp.id
)
ON CONFLICT (invoice_no) DO NOTHING;
