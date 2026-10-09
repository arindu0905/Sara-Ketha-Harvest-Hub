-- Migration 026: Management analytics (E4-US6..US9) + bid-result notifications (E3-US14)
-- All report functions return JSONB so the API can pass them straight through.

-- ── Bid-result notifications: tell losing bidders when an auction closes ────
CREATE OR REPLACE FUNCTION public.notify_auction_losers()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status IN ('awaiting_award','reserve_not_met') THEN
    INSERT INTO public.notifications (recipient_id, type, title, message, related_entity_type, related_entity_id)
    SELECT DISTINCT p.id, 'bid_result'::notification_type,
           CASE WHEN NEW.status = 'reserve_not_met' THEN 'Auction closed - reserve not met' ELSE 'Bid not successful' END,
           CASE WHEN NEW.status = 'reserve_not_met'
                THEN format('"%s" closed without meeting its reserve price. Your bid was not accepted.', NEW.title)
                ELSE format('Another bidder won a lot you bid on in "%s". Your bid was not accepted.', NEW.title) END,
           'auction', NEW.id
    FROM public.auction_bids ab
    JOIN public.buyers b ON b.id = ab.buyer_id
    JOIN public.profiles p ON p.id = b.profile_id
    WHERE ab.auction_id = NEW.id
      AND NOT EXISTS (
        SELECT 1 FROM public.auction_winners aw
        JOIN public.auction_lots al ON al.id = aw.auction_lot_id
        WHERE al.auction_id = NEW.id AND aw.buyer_id = b.id AND aw.payment_status <> 'defaulted'
      );

    UPDATE public.auction_bids SET status = 'rejected'
    WHERE auction_id = NEW.id AND status IN ('outbid','accepted','pending');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_notify_auction_losers ON public.auctions;
CREATE TRIGGER trg_notify_auction_losers
  AFTER UPDATE OF status ON public.auctions
  FOR EACH ROW EXECUTE FUNCTION public.notify_auction_losers();

-- ── Farmer performance ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.report_farmer_performance(p_from DATE, p_to DATE)
RETURNS JSONB AS $$
  SELECT COALESCE(jsonb_agg(r ORDER BY r->>'total_net_kg' DESC), '[]'::JSONB) FROM (
    SELECT jsonb_build_object(
      'farmer_id', f.id, 'farmer_code', f.farmer_code, 'farmer_name', f.full_name, 'district', f.district,
      'collections', COUNT(c.id),
      'total_net_kg', ROUND(COALESCE(SUM(c.net_weight_kg),0),1),
      'accepted_kg', ROUND(COALESCE(SUM(qi.accepted_qty_kg),0),1),
      'rejected_kg', ROUND(COALESCE(SUM(qi.rejected_qty_kg),0),1),
      'acceptance_rate_pct', CASE WHEN COALESCE(SUM(qi.accepted_qty_kg + qi.rejected_qty_kg),0) > 0
          THEN ROUND(100 * SUM(qi.accepted_qty_kg) / SUM(qi.accepted_qty_kg + qi.rejected_qty_kg), 1) ELSE NULL END,
      'avg_grade_score', ROUND(AVG(CASE qi.grade WHEN 'grade_a' THEN 3 WHEN 'grade_b' THEN 2 WHEN 'grade_c' THEN 1 WHEN 'rejected' THEN 0 END)::NUMERIC, 2),
      'total_paid_lkr', COALESCE((SELECT SUM(fp.net_amount_lkr) FROM public.farmer_payments fp
                                  WHERE fp.farmer_id = f.id AND fp.status = 'paid'
                                    AND fp.paid_at::DATE BETWEEN p_from AND p_to), 0)
    ) AS r
    FROM public.farmers f
    JOIN public.produce_collections c ON c.farmer_id = f.id AND c.created_at::DATE BETWEEN p_from AND p_to
    LEFT JOIN public.quality_inspections qi ON qi.collection_id = c.id
    GROUP BY f.id
  ) t;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ── Buyer performance ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.report_buyer_performance(p_from DATE, p_to DATE)
RETURNS JSONB AS $$
  SELECT COALESCE(jsonb_agg(r ORDER BY (r->>'ordered_value_lkr')::NUMERIC DESC), '[]'::JSONB) FROM (
    SELECT jsonb_build_object(
      'buyer_id', b.id, 'buyer_code', b.buyer_code, 'company_name', b.company_name,
      'orders', COUNT(o.id),
      'cancelled_orders', COUNT(o.id) FILTER (WHERE o.status IN ('cancelled','rejected')),
      'ordered_value_lkr', COALESCE(SUM(o.total_amount_lkr) FILTER (WHERE o.status NOT IN ('cancelled','rejected')), 0),
      'paid_lkr', COALESCE((SELECT SUM(bp.amount_lkr) FROM public.buyer_payments bp
                            WHERE bp.buyer_id = b.id AND bp.payment_date BETWEEN p_from AND p_to), 0),
      'outstanding_lkr', COALESCE((SELECT SUM(i.total_amount_lkr - i.amount_paid_lkr) FROM public.invoices i
                                   WHERE i.buyer_id = b.id AND i.status IN ('issued','partially_paid','overdue')), 0),
      'cancellation_rate_pct', ROUND(100.0 * COUNT(o.id) FILTER (WHERE o.status IN ('cancelled','rejected')) / NULLIF(COUNT(o.id),0), 1)
    ) AS r
    FROM public.buyers b
    JOIN public.purchase_orders o ON o.buyer_id = b.id AND o.created_at::DATE BETWEEN p_from AND p_to
    GROUP BY b.id
  ) t;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ── Waste analysis ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.report_waste_analysis(p_from DATE, p_to DATE)
RETURNS JSONB AS $$
DECLARE
  v_total_kg DECIMAL; v_total_val DECIMAL; v_received DECIMAL;
BEGIN
  SELECT COALESCE(SUM(quantity_kg),0), COALESCE(SUM(value_lost_lkr),0) INTO v_total_kg, v_total_val
  FROM public.wastage_records WHERE created_at::DATE BETWEEN p_from AND p_to;
  SELECT COALESCE(SUM(initial_qty_kg),0) INTO v_received FROM public.inventory_batches WHERE received_date BETWEEN p_from AND p_to;

  RETURN jsonb_build_object(
    'total_wasted_kg', v_total_kg, 'total_value_lost_lkr', v_total_val, 'received_kg', v_received,
    'waste_rate_pct', CASE WHEN v_received > 0 THEN ROUND(100 * v_total_kg / v_received, 2) ELSE 0 END,
    'by_reason', COALESCE((SELECT jsonb_agg(jsonb_build_object('reason', reason, 'kg', kg, 'value_lkr', val) ORDER BY kg DESC)
        FROM (SELECT reason, SUM(quantity_kg) kg, SUM(value_lost_lkr) val FROM public.wastage_records
              WHERE created_at::DATE BETWEEN p_from AND p_to GROUP BY reason) x), '[]'::JSONB),
    'by_category', COALESCE((SELECT jsonb_agg(jsonb_build_object('category', name, 'kg', kg, 'value_lkr', val) ORDER BY kg DESC)
        FROM (SELECT cc.name, SUM(w.quantity_kg) kg, SUM(w.value_lost_lkr) val
              FROM public.wastage_records w JOIN public.inventory_batches b ON b.id = w.batch_id
              JOIN public.crop_categories cc ON cc.id = b.category_id
              WHERE w.created_at::DATE BETWEEN p_from AND p_to GROUP BY cc.name) x), '[]'::JSONB),
    'rejected_at_inspection_kg', COALESCE((SELECT SUM(rejected_qty_kg) FROM public.quality_inspections
                                           WHERE created_at::DATE BETWEEN p_from AND p_to),0)
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ── Supply / demand history + linear-trend forecast ─────────────────────────
-- History: supply = accepted kg received into inventory; demand = kg requested on
-- non-cancelled purchase orders. Forecast: least-squares line over the last
-- p_history months, projected p_ahead months forward (floored at 0).
CREATE OR REPLACE FUNCTION public.report_supply_demand(p_history INT DEFAULT 12, p_ahead INT DEFAULT 3)
RETURNS JSONB AS $$
DECLARE
  v_rows JSONB := '[]'::JSONB;
  v_m RECORD;
  v_n INT := 0;
  v_ss DOUBLE PRECISION; v_si DOUBLE PRECISION; v_ds DOUBLE PRECISION; v_di DOUBLE PRECISION;
  v_start DATE := (date_trunc('month', CURRENT_DATE) - make_interval(months => p_history - 1))::DATE;
  i INT;
BEGIN
  CREATE TEMP TABLE IF NOT EXISTS _sd(idx INT, month DATE, supply DOUBLE PRECISION, demand DOUBLE PRECISION) ON COMMIT DROP;
  TRUNCATE _sd;
  INSERT INTO _sd
  SELECT (row_number() OVER (ORDER BY gs.m) - 1)::INT, gs.m::DATE,
         COALESCE((SELECT SUM(initial_qty_kg) FROM public.inventory_batches WHERE date_trunc('month', received_date) = gs.m), 0)::DOUBLE PRECISION,
         COALESCE((SELECT SUM(poi.requested_qty_kg) FROM public.purchase_order_items poi JOIN public.purchase_orders po ON po.id = poi.order_id
                   WHERE po.status NOT IN ('cancelled','rejected','draft') AND date_trunc('month', po.created_at) = gs.m), 0)::DOUBLE PRECISION
  FROM generate_series(v_start, date_trunc('month', CURRENT_DATE)::DATE, interval '1 month') AS gs(m);

  SELECT COUNT(*) INTO v_n FROM _sd;
  SELECT regr_slope(supply, idx), regr_intercept(supply, idx), regr_slope(demand, idx), regr_intercept(demand, idx)
    INTO v_ss, v_si, v_ds, v_di FROM _sd;

  FOR v_m IN SELECT * FROM _sd ORDER BY idx LOOP
    v_rows := v_rows || jsonb_build_object('month', to_char(v_m.month, 'YYYY-MM'), 'label', to_char(v_m.month, 'Mon YYYY'),
      'supply_kg', ROUND(v_m.supply::NUMERIC, 1), 'demand_kg', ROUND(v_m.demand::NUMERIC, 1), 'is_forecast', false);
  END LOOP;

  IF v_n >= 3 AND v_ss IS NOT NULL THEN
    FOR i IN 1..p_ahead LOOP
      v_rows := v_rows || jsonb_build_object(
        'month', to_char(date_trunc('month', CURRENT_DATE) + make_interval(months => i), 'YYYY-MM'),
        'label', to_char(date_trunc('month', CURRENT_DATE) + make_interval(months => i), 'Mon YYYY'),
        'supply_kg', ROUND(GREATEST(0, v_si + v_ss * (v_n - 1 + i))::NUMERIC, 1),
        'demand_kg', ROUND(GREATEST(0, v_di + v_ds * (v_n - 1 + i))::NUMERIC, 1),
        'is_forecast', true);
    END LOOP;
  END IF;
  RETURN jsonb_build_object('months', v_rows, 'method', 'least-squares linear trend over last ' || p_history || ' months',
                            'supply_slope_kg_per_month', ROUND(COALESCE(v_ss,0)::NUMERIC,1), 'demand_slope_kg_per_month', ROUND(COALESCE(v_ds,0)::NUMERIC,1));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── Crop price trends (monthly average purchase / selling price per category) ──
CREATE OR REPLACE FUNCTION public.report_price_trends(p_months INT DEFAULT 12)
RETURNS JSONB AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object('month', to_char(m,'YYYY-MM'), 'category', name,
         'avg_purchase_lkr', ROUND(pp::NUMERIC,2), 'avg_selling_lkr', ROUND(sp::NUMERIC,2), 'volume_kg', ROUND(vol::NUMERIC,1))
         ORDER BY m, name), '[]'::JSONB)
  FROM (
    SELECT date_trunc('month', b.received_date)::DATE AS m, cc.name,
           SUM(b.purchase_price_lkr * b.initial_qty_kg) / NULLIF(SUM(b.initial_qty_kg),0) AS pp,
           SUM(b.selling_price_lkr  * b.initial_qty_kg) / NULLIF(SUM(b.initial_qty_kg),0) AS sp,
           SUM(b.initial_qty_kg) AS vol
    FROM public.inventory_batches b JOIN public.crop_categories cc ON cc.id = b.category_id
    WHERE b.received_date >= (date_trunc('month', CURRENT_DATE) - make_interval(months => p_months - 1))::DATE
      AND b.purchase_price_lkr > 0
    GROUP BY 1, 2
  ) t;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ── Financial summary (revenue, expenses, profit estimate) ──────────────────
CREATE OR REPLACE FUNCTION public.report_financial_summary(p_from DATE, p_to DATE)
RETURNS JSONB AS $$
DECLARE
  v_rev DECIMAL; v_exp DECIMAL; v_waste DECIMAL; v_out_buy DECIMAL; v_out_far DECIMAL;
BEGIN
  SELECT COALESCE(SUM(amount_lkr),0) INTO v_rev FROM public.buyer_payments WHERE payment_date BETWEEN p_from AND p_to;
  SELECT COALESCE(SUM(net_amount_lkr),0) INTO v_exp FROM public.farmer_payments WHERE status = 'paid' AND paid_at::DATE BETWEEN p_from AND p_to;
  SELECT COALESCE(SUM(value_lost_lkr),0) INTO v_waste FROM public.wastage_records WHERE created_at::DATE BETWEEN p_from AND p_to;
  SELECT COALESCE(SUM(outstanding_lkr),0) INTO v_out_buy FROM public.outstanding_payments WHERE kind = 'buyer_invoice';
  SELECT COALESCE(SUM(outstanding_lkr),0) INTO v_out_far FROM public.outstanding_payments WHERE kind = 'farmer_payout';
  RETURN jsonb_build_object(
    'revenue_lkr', v_rev, 'farmer_payouts_lkr', v_exp, 'wastage_cost_lkr', v_waste,
    'profit_estimate_lkr', v_rev - v_exp - v_waste,
    'outstanding_receivable_lkr', v_out_buy, 'outstanding_payable_lkr', v_out_far,
    'monthly', COALESCE((SELECT jsonb_agg(jsonb_build_object('month', to_char(m,'YYYY-MM'), 'label', to_char(m,'Mon YYYY'),
        'revenue_lkr', rev, 'farmer_payouts_lkr', exp, 'profit_lkr', rev - exp) ORDER BY m)
      FROM (SELECT gs.m::DATE AS m,
              COALESCE((SELECT SUM(amount_lkr) FROM public.buyer_payments WHERE date_trunc('month', payment_date) = gs.m),0) AS rev,
              COALESCE((SELECT SUM(net_amount_lkr) FROM public.farmer_payments WHERE status='paid' AND date_trunc('month', paid_at) = gs.m),0) AS exp
            FROM generate_series(date_trunc('month', p_from), date_trunc('month', p_to), interval '1 month') AS gs(m)) x), '[]'::JSONB)
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ── Collection / inventory / quality overview (E4-US6) ──────────────────────
CREATE OR REPLACE FUNCTION public.report_operations_overview(p_from DATE, p_to DATE)
RETURNS JSONB AS $$
  SELECT jsonb_build_object(
    'collections', jsonb_build_object(
      'count', (SELECT COUNT(*) FROM public.produce_collections WHERE created_at::DATE BETWEEN p_from AND p_to),
      'net_kg', (SELECT COALESCE(ROUND(SUM(net_weight_kg),1),0) FROM public.produce_collections WHERE created_at::DATE BETWEEN p_from AND p_to),
      'by_centre', COALESCE((SELECT jsonb_agg(jsonb_build_object('centre', cc.name, 'count', n, 'kg', kg))
          FROM (SELECT centre_id, COUNT(*) n, ROUND(COALESCE(SUM(net_weight_kg),0),1) kg FROM public.produce_collections
                WHERE created_at::DATE BETWEEN p_from AND p_to GROUP BY centre_id) x JOIN public.collection_centres cc ON cc.id = x.centre_id), '[]'::JSONB)),
    'quality', jsonb_build_object(
      'inspections', (SELECT COUNT(*) FROM public.quality_inspections WHERE created_at::DATE BETWEEN p_from AND p_to),
      'accepted_kg', (SELECT COALESCE(SUM(accepted_qty_kg),0) FROM public.quality_inspections WHERE created_at::DATE BETWEEN p_from AND p_to),
      'rejected_kg', (SELECT COALESCE(SUM(rejected_qty_kg),0) FROM public.quality_inspections WHERE created_at::DATE BETWEEN p_from AND p_to),
      'by_grade', COALESCE((SELECT jsonb_agg(jsonb_build_object('grade', grade, 'count', n)) FROM
          (SELECT grade, COUNT(*) n FROM public.quality_inspections WHERE created_at::DATE BETWEEN p_from AND p_to GROUP BY grade) g), '[]'::JSONB),
      'top_rejection_reasons', COALESCE((SELECT jsonb_agg(jsonb_build_object('reason', reason, 'kg', kg) ORDER BY kg DESC) FROM
          (SELECT cr.reason, ROUND(SUM(cr.quantity_kg),1) kg FROM public.collection_rejections cr
           JOIN public.quality_inspections qi ON qi.id = cr.inspection_id WHERE qi.created_at::DATE BETWEEN p_from AND p_to GROUP BY cr.reason) r), '[]'::JSONB)),
    'inventory', jsonb_build_object(
      'batches_in_stock', (SELECT COUNT(*) FROM public.inventory_batches WHERE available_qty_kg > 0 AND status IN ('available','partially_sold','reserved')),
      'available_kg', (SELECT COALESCE(SUM(available_qty_kg),0) FROM public.inventory_batches WHERE status IN ('available','partially_sold','reserved')),
      'reserved_kg', (SELECT COALESCE(SUM(reserved_qty_kg),0) FROM public.inventory_batches),
      'stock_value_lkr', (SELECT COALESCE(ROUND(SUM(available_qty_kg * purchase_price_lkr),2),0) FROM public.inventory_batches WHERE status IN ('available','partially_sold','reserved')),
      'near_expiry_batches', (SELECT COUNT(*) FROM public.inventory_batches WHERE available_qty_kg > 0 AND expected_expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 7),
      'by_category', COALESCE((SELECT jsonb_agg(jsonb_build_object('category', name, 'available_kg', kg)) FROM
          (SELECT cc.name, ROUND(SUM(b.available_qty_kg),1) kg FROM public.inventory_batches b JOIN public.crop_categories cc ON cc.id = b.category_id
           WHERE b.available_qty_kg > 0 AND b.status IN ('available','partially_sold','reserved') GROUP BY cc.name) c), '[]'::JSONB))
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.report_farmer_performance, public.report_buyer_performance, public.report_waste_analysis,
  public.report_supply_demand, public.report_price_trends, public.report_financial_summary, public.report_operations_overview TO service_role;
