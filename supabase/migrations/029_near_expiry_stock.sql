-- Migration 029: separate register of near-expiry stock (E3-US4)
--
-- public.near_expiry_stock keeps one row per inventory batch that is close to (or past) its expiry date,
-- with the quantity, value at risk, days left and risk level. It is kept up to date automatically:
--   * a trigger on inventory_batches refreshes the batch's row whenever its stock, price, status or expiry date changes
--   * refresh_near_expiry_stock() re-checks every batch (the API calls it so "days left" is always current)
-- When a batch stops being at risk (sold, written off, expiry extended ...) its row is kept as history
-- with status = 'resolved' and a note saying why.   Safe to re-run.

CREATE TABLE IF NOT EXISTS public.near_expiry_stock (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id           UUID NOT NULL UNIQUE REFERENCES public.inventory_batches(id) ON DELETE CASCADE,
  batch_no           TEXT NOT NULL,
  category_id        UUID REFERENCES public.crop_categories(id),
  farmer_id          UUID REFERENCES public.farmers(id),
  warehouse_id       UUID REFERENCES public.warehouses(id),
  grade              TEXT,
  available_qty_kg   NUMERIC(12,3) NOT NULL DEFAULT 0,
  reserved_qty_kg    NUMERIC(12,3) NOT NULL DEFAULT 0,
  purchase_price_lkr NUMERIC(12,2) NOT NULL DEFAULT 0,
  selling_price_lkr  NUMERIC(12,2) NOT NULL DEFAULT 0,
  expiry_date        DATE NOT NULL,
  days_left          INT  NOT NULL,
  risk_level         TEXT NOT NULL CHECK (risk_level IN ('expired','critical','high','medium')),
  value_at_risk_lkr  NUMERIC(14,2) NOT NULL DEFAULT 0,
  status             TEXT NOT NULL DEFAULT 'at_risk' CHECK (status IN ('at_risk','expired','resolved')),
  first_flagged_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_checked_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at        TIMESTAMPTZ,
  resolution_note    TEXT
);

CREATE INDEX IF NOT EXISTS idx_near_expiry_stock_status ON public.near_expiry_stock(status, expiry_date);

-- All access goes through the backend (service role)
ALTER TABLE public.near_expiry_stock ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.near_expiry_stock TO postgres, service_role;

-- ── Re-check one batch ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.sync_near_expiry_batch(p_batch UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  b        RECORD;
  v_days   INT;
  v_today  DATE := (NOW() AT TIME ZONE 'Asia/Colombo')::DATE;
  v_left   INT;
  v_risk   TEXT;
  v_note   TEXT;
BEGIN
  SELECT COALESCE(NULLIF(value, '')::INT, 7) INTO v_days FROM public.system_settings WHERE key = 'near_expiry_days';
  v_days := COALESCE(v_days, 7);

  SELECT * INTO b FROM public.inventory_batches WHERE id = p_batch;
  IF NOT FOUND THEN RETURN; END IF;

  IF b.expected_expiry_date IS NOT NULL
     AND b.available_qty_kg > 0
     AND b.status::TEXT NOT IN ('disposed', 'damaged', 'sold')
     AND b.expected_expiry_date <= v_today + v_days THEN

    v_left := b.expected_expiry_date - v_today;
    v_risk := CASE WHEN v_left < 0 THEN 'expired' WHEN v_left <= 2 THEN 'critical' WHEN v_left <= CEIL(v_days / 2.0) THEN 'high' ELSE 'medium' END;

    INSERT INTO public.near_expiry_stock AS n (
      batch_id, batch_no, category_id, farmer_id, warehouse_id, grade, available_qty_kg, reserved_qty_kg,
      purchase_price_lkr, selling_price_lkr, expiry_date, days_left, risk_level, value_at_risk_lkr, status, last_checked_at
    ) VALUES (
      b.id, b.batch_no, b.category_id, b.farmer_id, b.warehouse_id, b.grade::TEXT, b.available_qty_kg, COALESCE(b.reserved_qty_kg, 0),
      COALESCE(b.purchase_price_lkr, 0), COALESCE(b.selling_price_lkr, 0), b.expected_expiry_date, v_left, v_risk,
      ROUND(b.available_qty_kg * COALESCE(b.purchase_price_lkr, 0), 2),
      CASE WHEN v_left < 0 THEN 'expired' ELSE 'at_risk' END, NOW()
    )
    ON CONFLICT (batch_id) DO UPDATE SET
      batch_no          = EXCLUDED.batch_no,
      category_id       = EXCLUDED.category_id,
      farmer_id         = EXCLUDED.farmer_id,
      warehouse_id      = EXCLUDED.warehouse_id,
      grade             = EXCLUDED.grade,
      available_qty_kg  = EXCLUDED.available_qty_kg,
      reserved_qty_kg   = EXCLUDED.reserved_qty_kg,
      purchase_price_lkr = EXCLUDED.purchase_price_lkr,
      selling_price_lkr = EXCLUDED.selling_price_lkr,
      expiry_date       = EXCLUDED.expiry_date,
      days_left         = EXCLUDED.days_left,
      risk_level        = EXCLUDED.risk_level,
      value_at_risk_lkr = EXCLUDED.value_at_risk_lkr,
      status            = EXCLUDED.status,
      first_flagged_at  = CASE WHEN n.status = 'resolved' THEN NOW() ELSE n.first_flagged_at END,
      last_checked_at   = NOW(),
      resolved_at       = NULL,
      resolution_note   = NULL;
  ELSE
    v_note := CASE
      WHEN b.status::TEXT IN ('disposed', 'damaged') THEN 'Written off as wastage'
      WHEN b.status::TEXT = 'sold' OR b.available_qty_kg <= 0 THEN 'All stock sold or used'
      WHEN b.expected_expiry_date IS NULL OR b.expected_expiry_date > v_today + v_days THEN 'Expiry date extended'
      ELSE 'No longer near expiry'
    END;
    UPDATE public.near_expiry_stock
       SET status = 'resolved', resolved_at = NOW(), resolution_note = v_note, last_checked_at = NOW(),
           available_qty_kg = b.available_qty_kg, reserved_qty_kg = COALESCE(b.reserved_qty_kg, 0), value_at_risk_lkr = 0
     WHERE batch_id = p_batch AND status <> 'resolved';
  END IF;
END;
$$;

-- ── Re-check every batch; returns how many are currently at risk ─────────────
CREATE OR REPLACE FUNCTION public.refresh_near_expiry_stock()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  v_count INT;
BEGIN
  FOR r IN
    SELECT id FROM public.inventory_batches WHERE expected_expiry_date IS NOT NULL
    UNION
    SELECT batch_id FROM public.near_expiry_stock WHERE status <> 'resolved'
  LOOP
    PERFORM public.sync_near_expiry_batch(r.id);
  END LOOP;
  SELECT COUNT(*) INTO v_count FROM public.near_expiry_stock WHERE status <> 'resolved';
  RETURN v_count;
END;
$$;

-- ── Keep the register current whenever a batch changes ───────────────────────
CREATE OR REPLACE FUNCTION public.trg_sync_near_expiry()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.sync_near_expiry_batch(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_inventory_batches_near_expiry ON public.inventory_batches;
CREATE TRIGGER trg_inventory_batches_near_expiry
  AFTER INSERT OR UPDATE OF available_qty_kg, reserved_qty_kg, expected_expiry_date, status, selling_price_lkr, warehouse_id
  ON public.inventory_batches
  FOR EACH ROW EXECUTE FUNCTION public.trg_sync_near_expiry();

GRANT EXECUTE ON FUNCTION public.sync_near_expiry_batch(UUID), public.refresh_near_expiry_stock() TO postgres, service_role;

-- Fill the register from the stock that exists today
SELECT public.refresh_near_expiry_stock();

-- Readable version for the SQL editor (names instead of IDs)
CREATE SCHEMA IF NOT EXISTS readable;
CREATE OR REPLACE VIEW readable.near_expiry_stock AS
SELECT
  n.batch_no                                   AS "Batch",
  c.name                                       AS "Crop",
  initcap(replace(n.grade, '_', ' '))          AS "Grade",
  f.full_name                                  AS "Farmer",
  w.name                                       AS "Warehouse",
  n.available_qty_kg                           AS "Available (kg)",
  n.reserved_qty_kg                            AS "Reserved (kg)",
  n.value_at_risk_lkr                          AS "Value at risk (LKR)",
  to_char(n.expiry_date, 'YYYY-MM-DD')         AS "Expiry date",
  n.days_left                                  AS "Days left",
  initcap(n.risk_level)                        AS "Risk",
  initcap(replace(n.status, '_', ' '))         AS "Status",
  to_char(n.first_flagged_at AT TIME ZONE 'Asia/Colombo', 'YYYY-MM-DD HH24:MI') AS "First flagged",
  to_char(n.resolved_at AT TIME ZONE 'Asia/Colombo', 'YYYY-MM-DD HH24:MI')      AS "Resolved at",
  n.resolution_note                            AS "How it was resolved"
FROM public.near_expiry_stock n
LEFT JOIN public.crop_categories c ON c.id = n.category_id
LEFT JOIN public.farmers f ON f.id = n.farmer_id
LEFT JOIN public.warehouses w ON w.id = n.warehouse_id
ORDER BY n.expiry_date;
GRANT USAGE ON SCHEMA readable TO postgres, service_role;
GRANT SELECT ON readable.near_expiry_stock TO postgres, service_role;

NOTIFY pgrst, 'reload schema';
