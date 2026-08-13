-- ============================================================
-- HarvestHub Migration 003: Database Functions & Triggers
-- ============================================================

-- ============================================================
-- FUNCTION: Auto-create profile on new Supabase auth user
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, account_status)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'farmer'),
    'pending'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- FUNCTION: Generate collection number
-- ============================================================

CREATE OR REPLACE FUNCTION public.generate_collection_no()
RETURNS TEXT AS $$
DECLARE
  v_date TEXT;
  v_seq  INTEGER;
BEGIN
  v_date := TO_CHAR(NOW(), 'YYYYMMDD');
  SELECT COUNT(*) + 1 INTO v_seq
  FROM public.produce_collections
  WHERE created_at::DATE = CURRENT_DATE;
  RETURN 'COL-' || v_date || '-' || LPAD(v_seq::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- FUNCTION: Generate batch number
-- ============================================================

CREATE OR REPLACE FUNCTION public.generate_batch_no()
RETURNS TEXT AS $$
DECLARE
  v_date TEXT;
  v_seq  INTEGER;
BEGIN
  v_date := TO_CHAR(NOW(), 'YYYYMMDD');
  SELECT COUNT(*) + 1 INTO v_seq
  FROM public.inventory_batches
  WHERE received_date = CURRENT_DATE;
  RETURN 'BAT-' || v_date || '-' || LPAD(v_seq::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- FUNCTION: Generate order number
-- ============================================================

CREATE OR REPLACE FUNCTION public.generate_order_no()
RETURNS TEXT AS $$
DECLARE
  v_seq INTEGER;
BEGIN
  SELECT COUNT(*) + 1 INTO v_seq FROM public.purchase_orders;
  RETURN 'ORD-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(v_seq::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- FUNCTION: Generate invoice number
-- ============================================================

CREATE OR REPLACE FUNCTION public.generate_invoice_no()
RETURNS TEXT AS $$
DECLARE
  v_seq INTEGER;
BEGIN
  SELECT COUNT(*) + 1 INTO v_seq FROM public.invoices;
  RETURN 'INV-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(v_seq::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- FUNCTION: Generate payment number
-- ============================================================

CREATE OR REPLACE FUNCTION public.generate_payment_no()
RETURNS TEXT AS $$
DECLARE
  v_seq INTEGER;
BEGIN
  SELECT COUNT(*) + 1 INTO v_seq FROM public.farmer_payments;
  RETURN 'PAY-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(v_seq::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- FUNCTION: Generate complaint number
-- ============================================================

CREATE OR REPLACE FUNCTION public.generate_complaint_no()
RETURNS TEXT AS $$
DECLARE
  v_seq INTEGER;
BEGIN
  SELECT COUNT(*) + 1 INTO v_seq FROM public.complaints;
  RETURN 'CMP-' || TO_CHAR(NOW(), 'YYYYMM') || '-' || LPAD(v_seq::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- FUNCTION: Generate farmer code
-- ============================================================

CREATE OR REPLACE FUNCTION public.generate_farmer_code()
RETURNS TEXT AS $$
DECLARE
  v_seq INTEGER;
BEGIN
  SELECT COUNT(*) + 1 INTO v_seq FROM public.farmers;
  RETURN 'FRM-' || LPAD(v_seq::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- FUNCTION: Generate buyer code
-- ============================================================

CREATE OR REPLACE FUNCTION public.generate_buyer_code()
RETURNS TEXT AS $$
DECLARE
  v_seq INTEGER;
BEGIN
  SELECT COUNT(*) + 1 INTO v_seq FROM public.buyers;
  RETURN 'BUY-' || LPAD(v_seq::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- FUNCTION: Calculate inventory batch available quantity
-- Called when inventory_transactions are inserted
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_batch_available_qty()
RETURNS TRIGGER AS $$
DECLARE
  v_reserved DECIMAL(12,3);
  v_sold     DECIMAL(12,3);
  v_wasted   DECIMAL(12,3);
  v_initial  DECIMAL(12,3);
BEGIN
  SELECT initial_qty_kg, reserved_qty_kg, sold_qty_kg, wasted_qty_kg
  INTO v_initial, v_reserved, v_sold, v_wasted
  FROM public.inventory_batches
  WHERE id = NEW.batch_id;

  UPDATE public.inventory_batches
  SET available_qty_kg = v_initial - v_reserved - v_sold - v_wasted
  WHERE id = NEW.batch_id;

  -- Auto-update batch status
  UPDATE public.inventory_batches
  SET status = CASE
    WHEN available_qty_kg <= 0 AND sold_qty_kg >= initial_qty_kg THEN 'sold'::batch_status
    WHEN available_qty_kg <= 0 AND wasted_qty_kg > 0 THEN 'damaged'::batch_status
    WHEN sold_qty_kg > 0 AND available_qty_kg > 0 THEN 'partially_sold'::batch_status
    WHEN reserved_qty_kg > 0 AND available_qty_kg = 0 THEN 'reserved'::batch_status
    WHEN expected_expiry_date IS NOT NULL AND expected_expiry_date < CURRENT_DATE THEN 'expired'::batch_status
    ELSE 'available'::batch_status
  END
  WHERE id = NEW.batch_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_batch_qty
  AFTER INSERT OR UPDATE ON public.inventory_batches
  FOR EACH ROW EXECUTE FUNCTION public.update_batch_available_qty();

-- ============================================================
-- FUNCTION: Validate collection weight constraints
-- ============================================================

CREATE OR REPLACE FUNCTION public.validate_collection_weights()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.gross_weight_kg IS NOT NULL AND NEW.container_weight_kg IS NOT NULL THEN
    IF NEW.gross_weight_kg <= NEW.container_weight_kg THEN
      RAISE EXCEPTION 'Gross weight must be greater than container weight';
    END IF;
    IF NEW.gross_weight_kg <= 0 THEN
      RAISE EXCEPTION 'Gross weight must be positive';
    END IF;
    IF NEW.container_weight_kg < 0 THEN
      RAISE EXCEPTION 'Container weight cannot be negative';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validate_weights
  BEFORE INSERT OR UPDATE ON public.produce_collections
  FOR EACH ROW EXECUTE FUNCTION public.validate_collection_weights();

-- ============================================================
-- FUNCTION: Validate inspection quantities
-- ============================================================

CREATE OR REPLACE FUNCTION public.validate_inspection_quantities()
RETURNS TRIGGER AS $$
DECLARE
  v_net_weight DECIMAL(12,3);
BEGIN
  SELECT net_weight_kg INTO v_net_weight
  FROM public.produce_collections
  WHERE id = NEW.collection_id;

  IF v_net_weight IS NULL THEN
    RAISE EXCEPTION 'Collection must be weighed before inspection';
  END IF;

  IF NEW.accepted_qty_kg + NEW.rejected_qty_kg > v_net_weight THEN
    RAISE EXCEPTION 'Accepted + rejected quantity cannot exceed net weight (% kg)', v_net_weight;
  END IF;

  IF NEW.accepted_qty_kg < 0 THEN
    RAISE EXCEPTION 'Accepted quantity cannot be negative';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validate_inspection
  BEFORE INSERT OR UPDATE ON public.quality_inspections
  FOR EACH ROW EXECUTE FUNCTION public.validate_inspection_quantities();

-- ============================================================
-- FUNCTION: Prevent stock oversell
-- ============================================================

CREATE OR REPLACE FUNCTION public.validate_stock_allocation()
RETURNS TRIGGER AS $$
DECLARE
  v_available DECIMAL(12,3);
  v_expiry    DATE;
BEGIN
  SELECT available_qty_kg, expected_expiry_date
  INTO v_available, v_expiry
  FROM public.inventory_batches
  WHERE id = NEW.batch_id;

  IF v_expiry IS NOT NULL AND v_expiry < CURRENT_DATE THEN
    RAISE EXCEPTION 'Cannot allocate expired batch';
  END IF;

  IF NEW.allocated_qty_kg > v_available THEN
    RAISE EXCEPTION 'Cannot reserve more than available quantity (% kg available)', v_available;
  END IF;

  -- Update reserved quantity
  UPDATE public.inventory_batches
  SET reserved_qty_kg = reserved_qty_kg + NEW.allocated_qty_kg,
      available_qty_kg = available_qty_kg - NEW.allocated_qty_kg
  WHERE id = NEW.batch_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validate_allocation
  BEFORE INSERT ON public.stock_allocations
  FOR EACH ROW EXECUTE FUNCTION public.validate_stock_allocation();

-- ============================================================
-- FUNCTION: Audit log trigger (generic)
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_audit_log()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, old_values, new_values)
  VALUES (
    auth.uid(),
    TG_OP,
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply audit triggers to critical tables
CREATE TRIGGER audit_farmers
  AFTER INSERT OR UPDATE OR DELETE ON public.farmers
  FOR EACH ROW EXECUTE FUNCTION public.create_audit_log();

CREATE TRIGGER audit_crop_prices
  AFTER INSERT OR UPDATE OR DELETE ON public.crop_prices
  FOR EACH ROW EXECUTE FUNCTION public.create_audit_log();

CREATE TRIGGER audit_collections
  AFTER INSERT OR UPDATE OR DELETE ON public.produce_collections
  FOR EACH ROW EXECUTE FUNCTION public.create_audit_log();

CREATE TRIGGER audit_inspections
  AFTER INSERT OR UPDATE OR DELETE ON public.quality_inspections
  FOR EACH ROW EXECUTE FUNCTION public.create_audit_log();

CREATE TRIGGER audit_farmer_payments
  AFTER INSERT OR UPDATE OR DELETE ON public.farmer_payments
  FOR EACH ROW EXECUTE FUNCTION public.create_audit_log();

CREATE TRIGGER audit_invoices
  AFTER INSERT OR UPDATE OR DELETE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.create_audit_log();

CREATE TRIGGER audit_profiles_status
  AFTER UPDATE OF account_status, role ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.create_audit_log();

-- ============================================================
-- FUNCTION: Notify farmer on collection status change
-- ============================================================

CREATE OR REPLACE FUNCTION public.notify_collection_status_change()
RETURNS TRIGGER AS $$
DECLARE
  v_farmer_profile_id UUID;
  v_title TEXT;
  v_message TEXT;
  v_type notification_type;
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    SELECT p.id INTO v_farmer_profile_id
    FROM public.farmers f
    JOIN public.profiles p ON p.id = f.profile_id
    WHERE f.id = NEW.farmer_id;

    CASE NEW.status
      WHEN 'weighed' THEN
        v_title := 'Produce Weighed';
        v_message := 'Your produce (Collection ' || NEW.collection_no || ') has been weighed. Net weight: ' || COALESCE(NEW.net_weight_kg::TEXT, 'TBD') || ' kg';
        v_type := 'weighing_completed';
      WHEN 'accepted' THEN
        v_title := 'Produce Accepted';
        v_message := 'Your produce (Collection ' || NEW.collection_no || ') has been accepted after quality inspection.';
        v_type := 'inspection_completed';
      WHEN 'rejected' THEN
        v_title := 'Produce Rejected';
        v_message := 'Your produce (Collection ' || NEW.collection_no || ') has been rejected. Please contact the collection centre for details.';
        v_type := 'produce_rejection';
      WHEN 'payment_pending' THEN
        v_title := 'Payment Pending';
        v_message := 'Payment for Collection ' || NEW.collection_no || ' is being processed.';
        v_type := 'payment_approval';
      ELSE
        RETURN NEW;
    END CASE;

    IF v_farmer_profile_id IS NOT NULL THEN
      INSERT INTO public.notifications (recipient_id, type, title, message, related_entity_type, related_entity_id)
      VALUES (v_farmer_profile_id, v_type, v_title, v_message, 'produce_collection', NEW.id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_notify_collection_status
  AFTER UPDATE OF status ON public.produce_collections
  FOR EACH ROW EXECUTE FUNCTION public.notify_collection_status_change();

-- ============================================================
-- FUNCTION: Notify on farmer payment status change
-- ============================================================

CREATE OR REPLACE FUNCTION public.notify_payment_status_change()
RETURNS TRIGGER AS $$
DECLARE
  v_farmer_profile_id UUID;
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    SELECT p.id INTO v_farmer_profile_id
    FROM public.farmers f
    JOIN public.profiles p ON p.id = f.profile_id
    WHERE f.id = NEW.farmer_id;

    IF NEW.status = 'paid' AND v_farmer_profile_id IS NOT NULL THEN
      INSERT INTO public.notifications (recipient_id, type, title, message, related_entity_type, related_entity_id)
      VALUES (
        v_farmer_profile_id,
        'payment_completed',
        'Payment Completed',
        'Your payment of LKR ' || NEW.net_amount_lkr || ' for ' || NEW.payment_no || ' has been processed.',
        'farmer_payment',
        NEW.id
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_notify_payment_status
  AFTER UPDATE OF status ON public.farmer_payments
  FOR EACH ROW EXECUTE FUNCTION public.notify_payment_status_change();

-- ============================================================
-- VIEWS for dashboard reporting
-- ============================================================

CREATE OR REPLACE VIEW public.v_dashboard_summary AS
SELECT
  (SELECT COUNT(*) FROM public.farmers WHERE account_status = 'active') AS active_farmers,
  (SELECT COUNT(*) FROM public.farmer_crops WHERE is_active = TRUE) AS active_crops,
  (SELECT COUNT(*) FROM public.produce_collections WHERE created_at::DATE = CURRENT_DATE) AS today_collections,
  (SELECT COALESCE(SUM(accepted_qty_kg), 0) FROM public.quality_inspections qi
   JOIN public.produce_collections pc ON pc.id = qi.collection_id
   WHERE pc.created_at::DATE = CURRENT_DATE) AS today_accepted_kg,
  (SELECT COALESCE(SUM(rejected_qty_kg), 0) FROM public.quality_inspections qi
   JOIN public.produce_collections pc ON pc.id = qi.collection_id
   WHERE pc.created_at::DATE = CURRENT_DATE) AS today_rejected_kg,
  (SELECT COALESCE(SUM(available_qty_kg), 0) FROM public.inventory_batches WHERE status = 'available') AS available_stock_kg,
  (SELECT COUNT(*) FROM public.inventory_batches
   WHERE expected_expiry_date IS NOT NULL
   AND expected_expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'
   AND status = 'available') AS near_expiry_batches,
  (SELECT COUNT(*) FROM public.farmer_payments WHERE status IN ('pending_calculation', 'calculated', 'pending_approval')) AS pending_farmer_payments,
  (SELECT COUNT(*) FROM public.invoices WHERE status IN ('issued', 'overdue')) AS outstanding_invoices,
  (SELECT COUNT(*) FROM public.purchase_orders WHERE status IN ('submitted', 'under_review', 'approved', 'stock_reserved', 'preparing')) AS active_orders,
  (SELECT COALESCE(SUM(amount_lkr), 0) FROM public.buyer_payments
   WHERE payment_date >= DATE_TRUNC('month', CURRENT_DATE)) AS monthly_revenue_lkr,
  (SELECT COALESCE(SUM(net_amount_lkr), 0) FROM public.farmer_payments
   WHERE status = 'paid' AND paid_at >= DATE_TRUNC('month', CURRENT_DATE)) AS monthly_farmer_payments_lkr;

-- ============================================================
-- FUNCTION: Get current active price for a crop/grade
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_current_price(
  p_category_id UUID,
  p_grade quality_grade,
  p_centre_id UUID DEFAULT NULL,
  p_variety_id UUID DEFAULT NULL
)
RETURNS TABLE(purchase_price DECIMAL, selling_price DECIMAL, unit TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT cp.purchase_price, cp.selling_price, cp.unit
  FROM public.crop_prices cp
  WHERE cp.category_id = p_category_id
    AND cp.grade = p_grade
    AND cp.status = 'active'
    AND cp.effective_from <= CURRENT_DATE
    AND (cp.effective_until IS NULL OR cp.effective_until >= CURRENT_DATE)
    AND (p_centre_id IS NULL OR cp.centre_id = p_centre_id OR cp.centre_id IS NULL)
    AND (p_variety_id IS NULL OR cp.variety_id = p_variety_id OR cp.variety_id IS NULL)
  ORDER BY cp.centre_id NULLS LAST, cp.variety_id NULLS LAST
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;
