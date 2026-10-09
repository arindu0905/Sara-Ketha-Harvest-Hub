-- Migration 024: Inventory integrity (E3-US4, E3-US9)
--  * wastage_records table (spoilage / damage / expiry with reason + value lost)
--  * atomic FEFO reservation / release functions that never oversell, never
--    allocate expired stock and cap excessive reservations
--  * expiry sweep + stale reservation release
--  * replaces the double-counting validate_stock_allocation trigger

-- ── Settings ────────────────────────────────────────────────────────────────
INSERT INTO public.system_settings (key, value, description) VALUES
  ('max_reservation_pct_per_order', '70', 'Max % of currently available category stock a single order may reserve'),
  ('reservation_hold_hours', '48', 'Hours an approved-but-unpaid reservation is held before auto-release'),
  ('max_appointments_per_centre_per_day', '60', 'Maximum delivery appointments a centre accepts per day'),
  ('require_payment_approval_separation', 'false', 'When true, the finance officer who calculated a farmer payment cannot approve it')
ON CONFLICT (key) DO NOTHING;

-- ── wastage_records ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.wastage_records (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  batch_id      UUID NOT NULL REFERENCES public.inventory_batches(id),
  quantity_kg   DECIMAL(12,3) NOT NULL CHECK (quantity_kg > 0),
  reason        TEXT NOT NULL CHECK (reason IN ('spoilage','damage','expiry','pest_disease','handling','temperature','other')),
  notes         TEXT,
  value_lost_lkr DECIMAL(15,2) NOT NULL DEFAULT 0,
  recorded_by   UUID REFERENCES public.profiles(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_wastage_batch ON public.wastage_records(batch_id);
CREATE INDEX IF NOT EXISTS idx_wastage_created ON public.wastage_records(created_at);

ALTER TABLE public.wastage_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "wastage read" ON public.wastage_records;
CREATE POLICY "wastage read" ON public.wastage_records FOR SELECT TO authenticated USING (true);
GRANT ALL ON public.wastage_records TO postgres, service_role;
GRANT SELECT ON public.wastage_records TO authenticated;

-- ── Replace allocation trigger: validate only (reservation is done in the RPC) ──
CREATE OR REPLACE FUNCTION public.validate_stock_allocation()
RETURNS TRIGGER AS $$
DECLARE
  v_expiry DATE;
  v_status batch_status;
BEGIN
  SELECT expected_expiry_date, status INTO v_expiry, v_status
  FROM public.inventory_batches WHERE id = NEW.batch_id;

  IF v_expiry IS NOT NULL AND v_expiry < CURRENT_DATE THEN
    RAISE EXCEPTION 'Cannot allocate expired batch';
  END IF;
  IF v_status IN ('expired','damaged','disposed','sold') THEN
    RAISE EXCEPTION 'Cannot allocate batch in status %', v_status;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_allocation ON public.stock_allocations;
CREATE TRIGGER trg_validate_allocation
  BEFORE INSERT ON public.stock_allocations
  FOR EACH ROW EXECUTE FUNCTION public.validate_stock_allocation();

-- ── helper: notify all users with a role ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_role(p_role user_role, p_type notification_type,
  p_title TEXT, p_message TEXT, p_entity_type TEXT, p_entity_id UUID)
RETURNS VOID AS $$
BEGIN
  INSERT INTO public.notifications (recipient_id, type, title, message, related_entity_type, related_entity_id)
  SELECT id, p_type, p_title, p_message, p_entity_type, p_entity_id
  FROM public.profiles WHERE role = p_role AND account_status = 'active';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── reserve_order_stock: atomic, FEFO, no overselling ───────────────────────
-- Raises  INSUFFICIENT_STOCK:<detail>  or  EXCESSIVE_RESERVATION:<detail>  and
-- rolls back everything if any item cannot be fully satisfied.
CREATE OR REPLACE FUNCTION public.reserve_order_stock(p_order_id UUID, p_user UUID DEFAULT NULL)
RETURNS JSONB AS $$
DECLARE
  v_order   RECORD;
  v_item    RECORD;
  v_batch   RECORD;
  v_need    DECIMAL(12,3);
  v_total   DECIMAL(12,3);
  v_take    DECIMAL(12,3);
  v_cap_pct DECIMAL := 70;
  v_allocs  JSONB := '[]'::JSONB;
  v_name    TEXT;
BEGIN
  SELECT * INTO v_order FROM public.purchase_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ORDER_NOT_FOUND'; END IF;
  IF v_order.status NOT IN ('submitted','under_review') THEN
    RAISE EXCEPTION 'INVALID_STATE: order is % and cannot be approved/reserved', v_order.status;
  END IF;

  SELECT COALESCE(NULLIF(value,'')::DECIMAL, 70) INTO v_cap_pct
  FROM public.system_settings WHERE key = 'max_reservation_pct_per_order';
  v_cap_pct := COALESCE(v_cap_pct, 70);

  FOR v_item IN SELECT * FROM public.purchase_order_items WHERE order_id = p_order_id LOOP
    v_need := v_item.requested_qty_kg;

    SELECT COALESCE(SUM(available_qty_kg),0) INTO v_total
    FROM public.inventory_batches
    WHERE category_id = v_item.category_id
      AND available_qty_kg > 0
      AND status IN ('available','partially_sold')
      AND (expected_expiry_date IS NULL OR expected_expiry_date >= CURRENT_DATE)
      AND (v_item.grade IS NULL OR grade = v_item.grade)
      AND (v_item.variety_id IS NULL OR variety_id = v_item.variety_id);

    SELECT name INTO v_name FROM public.crop_categories WHERE id = v_item.category_id;

    IF v_total < v_need THEN
      RAISE EXCEPTION 'INSUFFICIENT_STOCK: % requested %kg but only %kg is available', v_name, v_need, v_total;
    END IF;
    IF v_total > 0 AND v_need > v_total * (v_cap_pct / 100.0) AND v_need > 50 THEN
      RAISE EXCEPTION 'EXCESSIVE_RESERVATION: % request of %kg exceeds % %% of available stock (%kg)', v_name, v_need, v_cap_pct, v_total;
    END IF;

    FOR v_batch IN
      SELECT * FROM public.inventory_batches
      WHERE category_id = v_item.category_id
        AND available_qty_kg > 0
        AND status IN ('available','partially_sold')
        AND (expected_expiry_date IS NULL OR expected_expiry_date >= CURRENT_DATE)
        AND (v_item.grade IS NULL OR grade = v_item.grade)
        AND (v_item.variety_id IS NULL OR variety_id = v_item.variety_id)
      ORDER BY expected_expiry_date ASC NULLS LAST, received_date ASC
      FOR UPDATE
    LOOP
      EXIT WHEN v_need <= 0;
      v_take := LEAST(v_need, v_batch.available_qty_kg);

      UPDATE public.inventory_batches
      SET reserved_qty_kg  = reserved_qty_kg + v_take,
          available_qty_kg = available_qty_kg - v_take,
          status = CASE WHEN available_qty_kg - v_take <= 0 THEN 'reserved'::batch_status ELSE status END,
          updated_at = NOW()
      WHERE id = v_batch.id;

      INSERT INTO public.stock_allocations (order_id, order_item_id, batch_id, allocated_qty_kg, allocated_by, status)
      VALUES (p_order_id, v_item.id, v_batch.id, v_take, p_user, 'reserved')
      ON CONFLICT (order_item_id, batch_id)
      DO UPDATE SET allocated_qty_kg = public.stock_allocations.allocated_qty_kg + EXCLUDED.allocated_qty_kg;

      INSERT INTO public.inventory_transactions (batch_id, transaction_type, quantity_kg, balance_kg, reference_id, reference_type, notes, created_by)
      VALUES (v_batch.id, 'reserved', v_take, v_batch.available_qty_kg - v_take, p_order_id, 'purchase_order',
              'Reserved for order ' || v_order.order_no, p_user);

      v_allocs := v_allocs || jsonb_build_object('item_id', v_item.id, 'batch_id', v_batch.id,
                                                 'batch_no', v_batch.batch_no, 'allocated_qty_kg', v_take);
      v_need := v_need - v_take;
    END LOOP;
  END LOOP;

  UPDATE public.purchase_orders
  SET status = 'approved', approved_by = p_user, approved_at = NOW(), updated_at = NOW()
  WHERE id = p_order_id;

  RETURN jsonb_build_object('order_id', p_order_id, 'status', 'approved', 'allocations', v_allocs);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── release_order_stock ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.release_order_stock(p_order_id UUID, p_user UUID DEFAULT NULL)
RETURNS INT AS $$
DECLARE
  v_alloc RECORD;
  v_n INT := 0;
BEGIN
  FOR v_alloc IN
    SELECT * FROM public.stock_allocations WHERE order_id = p_order_id AND status = 'reserved' FOR UPDATE
  LOOP
    UPDATE public.inventory_batches
    SET reserved_qty_kg  = GREATEST(0, reserved_qty_kg - v_alloc.allocated_qty_kg),
        available_qty_kg = available_qty_kg + v_alloc.allocated_qty_kg,
        status = CASE WHEN status IN ('reserved','partially_sold') THEN 'available'::batch_status ELSE status END,
        updated_at = NOW()
    WHERE id = v_alloc.batch_id;

    INSERT INTO public.inventory_transactions (batch_id, transaction_type, quantity_kg, balance_kg, reference_id, reference_type, notes, created_by)
    SELECT v_alloc.batch_id, 'released', v_alloc.allocated_qty_kg, available_qty_kg, p_order_id, 'purchase_order',
           'Reservation released', p_user
    FROM public.inventory_batches WHERE id = v_alloc.batch_id;

    UPDATE public.stock_allocations SET status = 'released' WHERE id = v_alloc.id;
    v_n := v_n + 1;
  END LOOP;
  RETURN v_n;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── release_stale_reservations: unpaid holds expire ─────────────────────────
CREATE OR REPLACE FUNCTION public.release_stale_reservations()
RETURNS INT AS $$
DECLARE
  v_hours INT := 48;
  v_order RECORD;
  v_n INT := 0;
BEGIN
  SELECT COALESCE(NULLIF(value,'')::INT, 48) INTO v_hours FROM public.system_settings WHERE key = 'reservation_hold_hours';
  v_hours := COALESCE(v_hours, 48);

  FOR v_order IN
    SELECT o.id, o.order_no, b.profile_id
    FROM public.purchase_orders o
    LEFT JOIN public.buyers b ON b.id = o.buyer_id
    WHERE o.status = 'approved' AND o.approved_at < NOW() - make_interval(hours => v_hours)
  LOOP
    PERFORM public.release_order_stock(v_order.id);
    UPDATE public.purchase_orders SET status = 'cancelled', cancelled_at = NOW(),
      cancel_reason = 'Reservation hold expired (' || v_hours || 'h)' WHERE id = v_order.id;
    IF v_order.profile_id IS NOT NULL THEN
      INSERT INTO public.notifications (recipient_id, type, title, message, related_entity_type, related_entity_id)
      VALUES (v_order.profile_id, 'reservation_released', 'Reservation expired',
              'Order ' || v_order.order_no || ' was cancelled and its stock released because it was not confirmed in time.',
              'purchase_order', v_order.id);
    END IF;
    v_n := v_n + 1;
  END LOOP;
  RETURN v_n;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── record_wastage: validated, ledgered, alerts managers ────────────────────
CREATE OR REPLACE FUNCTION public.record_wastage(p_batch_id UUID, p_qty DECIMAL, p_reason TEXT,
  p_notes TEXT DEFAULT NULL, p_user UUID DEFAULT NULL)
RETURNS JSONB AS $$
DECLARE
  v_b public.inventory_batches%ROWTYPE;
  v_value DECIMAL(15,2);
  v_id UUID;
BEGIN
  IF p_qty IS NULL OR p_qty <= 0 THEN RAISE EXCEPTION 'INVALID_QTY: quantity must be greater than zero'; END IF;
  SELECT * INTO v_b FROM public.inventory_batches WHERE id = p_batch_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'BATCH_NOT_FOUND'; END IF;
  IF p_qty > v_b.available_qty_kg THEN
    RAISE EXCEPTION 'INVALID_QTY: cannot write off %kg - only %kg available in batch %', p_qty, v_b.available_qty_kg, v_b.batch_no;
  END IF;

  v_value := ROUND(p_qty * v_b.purchase_price_lkr, 2);

  UPDATE public.inventory_batches
  SET wasted_qty_kg = wasted_qty_kg + p_qty,
      available_qty_kg = available_qty_kg - p_qty,
      status = CASE
        WHEN available_qty_kg - p_qty <= 0 AND reserved_qty_kg <= 0 THEN
             (CASE WHEN p_reason = 'expiry' THEN 'expired' ELSE 'damaged' END)::batch_status
        ELSE status END,
      updated_at = NOW()
  WHERE id = p_batch_id;

  INSERT INTO public.wastage_records (batch_id, quantity_kg, reason, notes, value_lost_lkr, recorded_by)
  VALUES (p_batch_id, p_qty, p_reason, p_notes, v_value, p_user) RETURNING id INTO v_id;

  INSERT INTO public.inventory_transactions (batch_id, transaction_type, quantity_kg, balance_kg, reference_id, reference_type, notes, created_by)
  VALUES (p_batch_id, 'wasted', p_qty, v_b.available_qty_kg - p_qty, v_id, 'wastage_record',
          p_reason || COALESCE(': ' || p_notes, ''), p_user);

  RETURN jsonb_build_object('wastage_id', v_id, 'batch_no', v_b.batch_no, 'quantity_kg', p_qty, 'value_lost_lkr', v_value);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── sweep_expired_batches: write off past-expiry stock, alert managers ──────
CREATE OR REPLACE FUNCTION public.sweep_expired_batches(p_user UUID DEFAULT NULL)
RETURNS JSONB AS $$
DECLARE
  v_b RECORD;
  v_count INT := 0;
  v_kg DECIMAL(14,3) := 0;
  v_near INT := 0;
  v_days INT := 7;
BEGIN
  FOR v_b IN
    SELECT id, batch_no, available_qty_kg FROM public.inventory_batches
    WHERE expected_expiry_date IS NOT NULL AND expected_expiry_date < CURRENT_DATE
      AND available_qty_kg > 0 AND status NOT IN ('expired','damaged','disposed','sold')
    FOR UPDATE
  LOOP
    PERFORM public.record_wastage(v_b.id, v_b.available_qty_kg, 'expiry', 'Auto-sweep: past expiry date', p_user);
    UPDATE public.inventory_batches SET status = 'expired' WHERE id = v_b.id AND reserved_qty_kg <= 0;
    v_count := v_count + 1; v_kg := v_kg + v_b.available_qty_kg;
  END LOOP;

  IF v_count > 0 THEN
    PERFORM public.notify_role('inventory_manager', 'wastage_alert', 'Expired stock written off',
      v_count || ' batch(es) totalling ' || v_kg || ' kg passed expiry and were written off.', 'inventory_batch', NULL);
  END IF;

  SELECT COALESCE(NULLIF(value,'')::INT, 7) INTO v_days FROM public.system_settings WHERE key = 'near_expiry_days';
  SELECT COUNT(*) INTO v_near FROM public.inventory_batches
  WHERE available_qty_kg > 0 AND status IN ('available','partially_sold')
    AND expected_expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + COALESCE(v_days,7);

  RETURN jsonb_build_object('expired_batches', v_count, 'expired_kg', v_kg, 'near_expiry_batches', v_near);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.reserve_order_stock, public.release_order_stock, public.release_stale_reservations,
  public.record_wastage, public.sweep_expired_batches, public.notify_role TO service_role;
