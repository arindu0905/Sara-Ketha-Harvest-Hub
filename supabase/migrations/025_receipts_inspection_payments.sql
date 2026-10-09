-- Migration 025: Collection receipts, transactional inspection finalisation,
-- payment receipts / partial buyer payments, outstanding payments, shelf life.
-- Covers E2-US4..US9, E3-US1/US4, E4-US4/US5.

-- ── Shelf life (drives expected_expiry_date on new batches) ─────────────────
ALTER TABLE public.crop_categories ADD COLUMN IF NOT EXISTS shelf_life_days INTEGER NOT NULL DEFAULT 7;
UPDATE public.crop_categories SET shelf_life_days = 180 WHERE name ILIKE '%rice%' OR name ILIKE '%paddy%' OR name ILIKE '%spice%' OR name ILIKE '%pepper%' OR name ILIKE '%cinnamon%';
UPDATE public.crop_categories SET shelf_life_days = 365 WHERE name ILIKE '%tea%';
UPDATE public.crop_categories SET shelf_life_days = 60  WHERE name ILIKE '%coconut%';
UPDATE public.crop_categories SET shelf_life_days = 10  WHERE name ILIKE '%fruit%' OR name ILIKE '%banana%' OR name ILIKE '%mango%';
UPDATE public.crop_categories SET shelf_life_days = 5   WHERE name ILIKE '%veg%' OR name ILIKE '%tomato%' OR name ILIKE '%leaf%' OR name ILIKE '%green%';

-- ── Sequence helpers ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.next_receipt_no(p_prefix TEXT, p_table TEXT, p_col TEXT)
RETURNS TEXT AS $$
DECLARE
  v_year TEXT := TO_CHAR(NOW(), 'YYYY');
  v_next INTEGER;
BEGIN
  EXECUTE format(
    'SELECT COALESCE(MAX(NULLIF(regexp_replace(%I, ''^.*-'', ''''), '''')::INTEGER), 0) + 1 FROM public.%I WHERE %I LIKE %L',
    p_col, p_table, p_col, p_prefix || '-' || v_year || '-%') INTO v_next;
  RETURN p_prefix || '-' || v_year || '-' || LPAD(v_next::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

-- ── collection_receipts (E2-US8) ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.collection_receipts (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  receipt_no         TEXT UNIQUE NOT NULL,
  collection_id      UUID UNIQUE NOT NULL REFERENCES public.produce_collections(id),
  farmer_id          UUID NOT NULL REFERENCES public.farmers(id),
  centre_id          UUID REFERENCES public.collection_centres(id),
  gross_weight_kg    DECIMAL(12,3),
  container_weight_kg DECIMAL(12,3),
  net_weight_kg      DECIMAL(12,3),
  accepted_qty_kg    DECIMAL(12,3) NOT NULL DEFAULT 0,
  rejected_qty_kg    DECIMAL(12,3) NOT NULL DEFAULT 0,
  grade              quality_grade,
  batch_no           TEXT,
  status             TEXT NOT NULL DEFAULT 'issued' CHECK (status IN ('issued','confirmed','disputed')),
  issued_by          UUID REFERENCES public.profiles(id),
  issued_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  farmer_confirmed_at TIMESTAMPTZ,
  farmer_note        TEXT
);
CREATE INDEX IF NOT EXISTS idx_receipts_farmer ON public.collection_receipts(farmer_id);
ALTER TABLE public.collection_receipts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "receipts read" ON public.collection_receipts;
CREATE POLICY "receipts read" ON public.collection_receipts FOR SELECT TO authenticated USING (true);
GRANT ALL ON public.collection_receipts TO postgres, service_role;
GRANT SELECT ON public.collection_receipts TO authenticated;

-- ── finalize_inspection (E2-US4/5/7/8/9): one transaction, all validations ──
CREATE OR REPLACE FUNCTION public.finalize_inspection(
  p_collection_id UUID, p_inspector UUID, p_grade quality_grade,
  p_accepted DECIMAL, p_rejected DECIMAL, p_notes TEXT, p_rejections JSONB DEFAULT '[]'::JSONB
) RETURNS JSONB AS $$
DECLARE
  v_c         public.produce_collections%ROWTYPE;
  v_insp_id   UUID;
  v_batch_id  UUID;
  v_batch_no  TEXT;
  v_receipt_no TEXT;
  v_rej       JSONB;
  v_rej_sum   DECIMAL := 0;
  v_status    collection_status;
  v_buy       DECIMAL := 0;
  v_sell      DECIMAL := 0;
  v_shelf     INTEGER := 7;
  v_farmer_profile UUID;
  v_expiry    DATE;
BEGIN
  SELECT * INTO v_c FROM public.produce_collections WHERE id = p_collection_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND: collection not found'; END IF;
  IF v_c.net_weight_kg IS NULL OR v_c.net_weight_kg <= 0 THEN
    RAISE EXCEPTION 'INVALID_STATE: net weight has not been recorded for this collection';
  END IF;
  IF v_c.status NOT IN ('weighed','pending_inspection','under_inspection') THEN
    RAISE EXCEPTION 'INVALID_STATE: collection is % and cannot be inspected', v_c.status;
  END IF;
  IF EXISTS (SELECT 1 FROM public.quality_inspections WHERE collection_id = p_collection_id) THEN
    RAISE EXCEPTION 'INVALID_STATE: an inspection already exists for this collection';
  END IF;

  IF p_accepted IS NULL OR p_rejected IS NULL OR p_accepted < 0 OR p_rejected < 0 THEN
    RAISE EXCEPTION 'INVALID_QTY: quantities must be zero or greater';
  END IF;
  IF ABS((p_accepted + p_rejected) - v_c.net_weight_kg) > 0.01 THEN
    RAISE EXCEPTION 'INVALID_QTY: accepted (% kg) + rejected (% kg) must equal the net weight (% kg)',
      p_accepted, p_rejected, v_c.net_weight_kg;
  END IF;
  IF p_grade = 'rejected' AND p_accepted > 0 THEN
    RAISE EXCEPTION 'INVALID_QTY: a rejected grade cannot have accepted quantity';
  END IF;
  IF p_grade <> 'rejected' AND p_accepted <= 0 THEN
    RAISE EXCEPTION 'INVALID_QTY: grade % requires an accepted quantity greater than zero', p_grade;
  END IF;
  IF p_rejected > 0 AND (p_rejections IS NULL OR jsonb_array_length(p_rejections) = 0) THEN
    RAISE EXCEPTION 'INVALID_QTY: at least one rejection reason is required when produce is rejected';
  END IF;

  FOR v_rej IN SELECT * FROM jsonb_array_elements(COALESCE(p_rejections,'[]'::JSONB)) LOOP
    v_rej_sum := v_rej_sum + COALESCE((v_rej->>'quantity_kg')::DECIMAL, 0);
  END LOOP;
  IF v_rej_sum > p_rejected + 0.01 THEN
    RAISE EXCEPTION 'INVALID_QTY: rejection line quantities (% kg) exceed total rejected (% kg)', v_rej_sum, p_rejected;
  END IF;

  INSERT INTO public.quality_inspections (collection_id, inspector_id, grade, accepted_qty_kg, rejected_qty_kg, inspection_notes, approved_at)
  VALUES (p_collection_id, p_inspector, p_grade, p_accepted, p_rejected, p_notes, NOW())
  RETURNING id INTO v_insp_id;

  FOR v_rej IN SELECT * FROM jsonb_array_elements(COALESCE(p_rejections,'[]'::JSONB)) LOOP
    INSERT INTO public.collection_rejections (inspection_id, reason, quantity_kg, notes)
    VALUES (v_insp_id, (v_rej->>'reason')::rejection_reason, COALESCE((v_rej->>'quantity_kg')::DECIMAL, 0), v_rej->>'notes');
  END LOOP;

  v_status := CASE WHEN p_grade = 'rejected' THEN 'rejected'
                   WHEN p_rejected > 0 THEN 'partially_accepted' ELSE 'accepted' END;
  UPDATE public.produce_collections SET status = v_status, updated_by = p_inspector, updated_at = NOW() WHERE id = p_collection_id;

  IF v_c.appointment_id IS NOT NULL THEN
    UPDATE public.delivery_appointments SET status = 'completed', updated_at = NOW()
    WHERE id = v_c.appointment_id AND status IN ('scheduled','confirmed','arrived');
  END IF;

  -- Batch generation (E2-US7) – only for accepted produce
  IF p_accepted > 0 THEN
    SELECT public.generate_batch_no() INTO v_batch_no;
    SELECT purchase_price, selling_price INTO v_buy, v_sell
    FROM public.get_current_price(v_c.category_id, p_grade, v_c.centre_id, v_c.variety_id);
    v_buy := COALESCE(v_buy, 0); v_sell := COALESCE(v_sell, 0);
    SELECT COALESCE(shelf_life_days, 7) INTO v_shelf FROM public.crop_categories WHERE id = v_c.category_id;
    v_expiry := CURRENT_DATE + COALESCE(v_shelf, 7);

    INSERT INTO public.inventory_batches (batch_no, qr_code_value, collection_id, farmer_id, category_id, variety_id, grade,
      initial_qty_kg, available_qty_kg, purchase_price_lkr, selling_price_lkr, expected_expiry_date, status, created_by)
    VALUES (v_batch_no, 'HH-' || v_batch_no, p_collection_id, v_c.farmer_id, v_c.category_id, v_c.variety_id, p_grade,
      p_accepted, p_accepted, v_buy, v_sell, v_expiry, 'available', p_inspector)
    RETURNING id INTO v_batch_id;

    INSERT INTO public.inventory_transactions (batch_id, transaction_type, quantity_kg, balance_kg, reference_id, reference_type, notes, created_by)
    VALUES (v_batch_id, 'received', p_accepted, p_accepted, p_collection_id, 'produce_collection', 'Batch created from inspection', p_inspector);

    UPDATE public.produce_collections SET status = 'added_to_inventory' WHERE id = p_collection_id AND v_status IN ('accepted','partially_accepted');
  END IF;

  -- Receipt (E2-US8)
  v_receipt_no := public.next_receipt_no('RCT', 'collection_receipts', 'receipt_no');
  INSERT INTO public.collection_receipts (receipt_no, collection_id, farmer_id, centre_id, gross_weight_kg, container_weight_kg,
    net_weight_kg, accepted_qty_kg, rejected_qty_kg, grade, batch_no, issued_by)
  VALUES (v_receipt_no, p_collection_id, v_c.farmer_id, v_c.centre_id, v_c.gross_weight_kg, v_c.container_weight_kg,
    v_c.net_weight_kg, p_accepted, p_rejected, p_grade, v_batch_no, p_inspector);

  SELECT profile_id INTO v_farmer_profile FROM public.farmers WHERE id = v_c.farmer_id;
  IF v_farmer_profile IS NOT NULL THEN
    INSERT INTO public.notifications (recipient_id, type, title, message, related_entity_type, related_entity_id)
    VALUES (v_farmer_profile, 'collection_receipt', 'Collection receipt ' || v_receipt_no,
      'Collection ' || v_c.collection_no || ': ' || p_accepted || ' kg accepted, ' || p_rejected || ' kg rejected. Please confirm your receipt.',
      'produce_collection', p_collection_id);
  END IF;

  RETURN jsonb_build_object('inspection_id', v_insp_id, 'batch_id', v_batch_id, 'batch_no', v_batch_no,
                            'receipt_no', v_receipt_no, 'collection_status', v_status);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── Buyer payments: partial payments + receipts (E4-US4/US5) ────────────────
ALTER TABLE public.invoices       ADD COLUMN IF NOT EXISTS amount_paid_lkr DECIMAL(15,2) NOT NULL DEFAULT 0;
ALTER TABLE public.buyer_invoices ADD COLUMN IF NOT EXISTS amount_paid_lkr DECIMAL(15,2) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.payment_receipts (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  receipt_no         TEXT UNIQUE NOT NULL,
  receipt_type       TEXT NOT NULL CHECK (receipt_type IN ('buyer_payment','farmer_payout')),
  buyer_payment_id   UUID REFERENCES public.buyer_payments(id),
  invoice_id         UUID REFERENCES public.invoices(id),
  farmer_payment_id  UUID REFERENCES public.farmer_payments(id),
  party_name         TEXT,
  amount_lkr         DECIMAL(15,2) NOT NULL CHECK (amount_lkr > 0),
  balance_after_lkr  DECIMAL(15,2) NOT NULL DEFAULT 0,
  payment_method     TEXT,
  reference_no       TEXT,
  payment_date       DATE NOT NULL DEFAULT CURRENT_DATE,
  issued_by          UUID REFERENCES public.profiles(id),
  issued_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_receipt_ref CHECK (buyer_payment_id IS NOT NULL OR farmer_payment_id IS NOT NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_receipt_farmer_payment ON public.payment_receipts(farmer_payment_id) WHERE farmer_payment_id IS NOT NULL;
ALTER TABLE public.payment_receipts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pay receipts read" ON public.payment_receipts;
CREATE POLICY "pay receipts read" ON public.payment_receipts FOR SELECT TO authenticated USING (true);
GRANT ALL ON public.payment_receipts TO postgres, service_role;
GRANT SELECT ON public.payment_receipts TO authenticated;

CREATE OR REPLACE FUNCTION public.record_buyer_payment(
  p_invoice_id UUID, p_amount DECIMAL, p_method TEXT, p_date DATE, p_reference TEXT, p_notes TEXT, p_user UUID
) RETURNS JSONB AS $$
DECLARE
  v_inv public.invoices%ROWTYPE;
  v_order_status order_status;
  v_pay_id UUID; v_paid DECIMAL(15,2); v_balance DECIMAL(15,2); v_status TEXT;
  v_receipt TEXT; v_name TEXT; v_buyer_profile UUID;
BEGIN
  SELECT * INTO v_inv FROM public.invoices WHERE id = p_invoice_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND: invoice not found'; END IF;
  IF v_inv.status IN ('cancelled') THEN RAISE EXCEPTION 'INVALID_STATE: invoice is cancelled'; END IF;
  IF v_inv.status = 'paid' THEN RAISE EXCEPTION 'INVALID_STATE: invoice is already fully paid'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'INVALID_QTY: payment amount must be greater than zero'; END IF;

  SELECT status INTO v_order_status FROM public.purchase_orders WHERE id = v_inv.order_id;
  IF v_order_status IN ('submitted','under_review','rejected','cancelled','draft') THEN
    RAISE EXCEPTION 'INVALID_STATE: order is % - payment cannot be recorded until the order is approved', v_order_status;
  END IF;

  v_balance := v_inv.total_amount_lkr - v_inv.amount_paid_lkr;
  IF p_amount > v_balance + 0.005 THEN
    RAISE EXCEPTION 'INVALID_QTY: payment of % exceeds outstanding balance of %', p_amount, v_balance;
  END IF;

  INSERT INTO public.buyer_payments (invoice_id, buyer_id, amount_lkr, payment_method, payment_date, reference_no, notes, recorded_by)
  VALUES (p_invoice_id, v_inv.buyer_id, p_amount, COALESCE(p_method,'bank_transfer'), COALESCE(p_date, CURRENT_DATE), p_reference, p_notes, p_user)
  RETURNING id INTO v_pay_id;

  v_paid := v_inv.amount_paid_lkr + p_amount;
  v_balance := v_inv.total_amount_lkr - v_paid;
  v_status := CASE WHEN v_balance <= 0.005 THEN 'paid' ELSE 'partially_paid' END;

  UPDATE public.invoices SET amount_paid_lkr = v_paid, status = v_status, updated_at = NOW() WHERE id = p_invoice_id;
  UPDATE public.buyer_invoices SET amount_paid_lkr = v_paid, status = v_status,
    payment_method = COALESCE(p_method, payment_method), payment_date = COALESCE(p_date, CURRENT_DATE),
    reference_no = COALESCE(p_reference, reference_no), updated_at = NOW()
  WHERE invoice_no = v_inv.invoice_no;

  IF v_status = 'paid' THEN
    UPDATE public.purchase_orders SET status = 'paid', updated_at = NOW()
    WHERE id = v_inv.order_id AND status IN ('approved','payment_pending','stock_reserved');
  ELSE
    UPDATE public.purchase_orders SET status = 'payment_pending', updated_at = NOW()
    WHERE id = v_inv.order_id AND status IN ('approved','stock_reserved');
  END IF;

  SELECT company_name, profile_id INTO v_name, v_buyer_profile FROM public.buyers WHERE id = v_inv.buyer_id;
  v_receipt := public.next_receipt_no('PRC', 'payment_receipts', 'receipt_no');
  INSERT INTO public.payment_receipts (receipt_no, receipt_type, buyer_payment_id, invoice_id, party_name, amount_lkr,
    balance_after_lkr, payment_method, reference_no, payment_date, issued_by)
  VALUES (v_receipt, 'buyer_payment', v_pay_id, p_invoice_id, v_name, p_amount, GREATEST(v_balance,0),
    COALESCE(p_method,'bank_transfer'), p_reference, COALESCE(p_date, CURRENT_DATE), p_user);

  IF v_buyer_profile IS NOT NULL THEN
    INSERT INTO public.notifications (recipient_id, type, title, message, related_entity_type, related_entity_id)
    VALUES (v_buyer_profile, 'payment_receipt', 'Payment received - ' || v_receipt,
      'LKR ' || p_amount || ' received for invoice ' || v_inv.invoice_no || '. Balance: LKR ' || GREATEST(v_balance,0),
      'invoice', p_invoice_id);
  END IF;

  RETURN jsonb_build_object('payment_id', v_pay_id, 'receipt_no', v_receipt, 'invoice_status', v_status,
                            'amount_paid_lkr', v_paid, 'balance_lkr', GREATEST(v_balance,0));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── mark farmer payment paid: must be approved; issues payout receipt ───────
CREATE OR REPLACE FUNCTION public.pay_farmer_payment(
  p_payment_id UUID, p_method TEXT, p_date DATE, p_reference TEXT, p_user UUID
) RETURNS JSONB AS $$
DECLARE
  v_p public.farmer_payments%ROWTYPE;
  v_receipt TEXT; v_name TEXT; v_profile UUID;
BEGIN
  SELECT * INTO v_p FROM public.farmer_payments WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND: payment not found'; END IF;
  IF v_p.status = 'paid' THEN RAISE EXCEPTION 'INVALID_STATE: payment is already paid'; END IF;
  IF v_p.status NOT IN ('approved','processing') THEN
    RAISE EXCEPTION 'INVALID_STATE: payment is % - it must be approved before it can be paid', v_p.status;
  END IF;

  UPDATE public.farmer_payments SET status = 'paid', payment_method = COALESCE(p_method,'bank_transfer'),
    payment_date = COALESCE(p_date, CURRENT_DATE), paid_by = p_user, paid_at = NOW(), updated_at = NOW()
  WHERE id = p_payment_id;

  UPDATE public.produce_collections SET status = 'completed' WHERE id = v_p.collection_id;
  UPDATE public.farmer_invoices SET status = 'paid', payment_method = COALESCE(p_method,'bank_transfer'),
    payment_date = COALESCE(p_date, CURRENT_DATE), reference_no = COALESCE(p_reference, 'REF-' || RIGHT(EXTRACT(EPOCH FROM NOW())::BIGINT::TEXT, 6)),
    updated_at = NOW()
  WHERE payment_id = p_payment_id;

  SELECT full_name, profile_id INTO v_name, v_profile FROM public.farmers WHERE id = v_p.farmer_id;
  v_receipt := public.next_receipt_no('PRC', 'payment_receipts', 'receipt_no');
  INSERT INTO public.payment_receipts (receipt_no, receipt_type, farmer_payment_id, party_name, amount_lkr, balance_after_lkr,
    payment_method, reference_no, payment_date, issued_by)
  VALUES (v_receipt, 'farmer_payout', p_payment_id, v_name, v_p.net_amount_lkr, 0,
    COALESCE(p_method,'bank_transfer'), p_reference, COALESCE(p_date, CURRENT_DATE), p_user);

  IF v_profile IS NOT NULL THEN
    INSERT INTO public.notifications (recipient_id, type, title, message, related_entity_type, related_entity_id)
    VALUES (v_profile, 'payment_receipt', 'Payment received - ' || v_receipt,
      'LKR ' || v_p.net_amount_lkr || ' has been paid for payment ' || v_p.payment_no || '.', 'farmer_payment', p_payment_id);
  END IF;

  RETURN jsonb_build_object('payment_id', p_payment_id, 'receipt_no', v_receipt, 'net_amount_lkr', v_p.net_amount_lkr);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── Outstanding payments (E4-US5) ───────────────────────────────────────────
CREATE OR REPLACE VIEW public.outstanding_payments AS
SELECT 'buyer_invoice'::TEXT AS kind, i.id, i.invoice_no AS reference, b.company_name AS party,
       (i.total_amount_lkr - i.amount_paid_lkr) AS outstanding_lkr, i.due_date,
       GREATEST(0, CURRENT_DATE - i.due_date) AS days_overdue, i.status::TEXT AS status
FROM public.invoices i JOIN public.buyers b ON b.id = i.buyer_id
JOIN public.purchase_orders o ON o.id = i.order_id
WHERE i.status IN ('issued','partially_paid','overdue') AND o.status NOT IN ('submitted','under_review','rejected','cancelled','draft')
UNION ALL
SELECT 'farmer_payout', p.id, p.payment_no, f.full_name, p.net_amount_lkr,
       (p.calculated_at::DATE + 3), GREATEST(0, CURRENT_DATE - (p.calculated_at::DATE + 3)), p.status::TEXT
FROM public.farmer_payments p JOIN public.farmers f ON f.id = p.farmer_id
WHERE p.status IN ('calculated','pending_approval','approved','processing');
GRANT SELECT ON public.outstanding_payments TO service_role, authenticated;

GRANT EXECUTE ON FUNCTION public.finalize_inspection, public.record_buyer_payment, public.pay_farmer_payment,
  public.next_receipt_no TO service_role;
