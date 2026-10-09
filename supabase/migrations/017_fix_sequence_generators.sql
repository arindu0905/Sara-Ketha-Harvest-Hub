-- HarvestHub Migration 017: Fix Sequence Generators to Prevent Duplicate Key Violations

-- 1. Order Number Generator
CREATE OR REPLACE FUNCTION public.generate_order_no()
RETURNS TEXT AS $$
DECLARE
  v_year TEXT := TO_CHAR(NOW(), 'YYYY');
  v_max_seq INTEGER;
  v_next_no TEXT;
BEGIN
  SELECT COALESCE(
    MAX(
      CASE 
        WHEN order_no ~ '^ORD-\d{4}-\d+$' 
        THEN regexp_replace(order_no, '^ORD-\d{4}-', '')::INTEGER 
        ELSE 0 
      END
    ), 
    0
  ) + 1
  INTO v_max_seq
  FROM public.purchase_orders
  WHERE order_no LIKE 'ORD-' || v_year || '-%';

  v_next_no := 'ORD-' || v_year || '-' || LPAD(v_max_seq::TEXT, 6, '0');
  RETURN v_next_no;
END;
$$ LANGUAGE plpgsql;

-- 2. Invoice Number Generator
CREATE OR REPLACE FUNCTION public.generate_invoice_no()
RETURNS TEXT AS $$
DECLARE
  v_year TEXT := TO_CHAR(NOW(), 'YYYY');
  v_max_seq INTEGER;
  v_next_no TEXT;
BEGIN
  SELECT COALESCE(
    MAX(
      CASE 
        WHEN invoice_no ~ '^INV-\d{4}-\d+$' 
        THEN regexp_replace(invoice_no, '^INV-\d{4}-', '')::INTEGER 
        ELSE 0 
      END
    ), 
    0
  ) + 1
  INTO v_max_seq
  FROM public.invoices
  WHERE invoice_no LIKE 'INV-' || v_year || '-%';

  v_next_no := 'INV-' || v_year || '-' || LPAD(v_max_seq::TEXT, 6, '0');
  RETURN v_next_no;
END;
$$ LANGUAGE plpgsql;

-- 3. Batch Number Generator
CREATE OR REPLACE FUNCTION public.generate_batch_no()
RETURNS TEXT AS $$
DECLARE
  v_date TEXT := TO_CHAR(NOW(), 'YYYYMMDD');
  v_max_seq INTEGER;
  v_next_no TEXT;
BEGIN
  SELECT COALESCE(
    MAX(
      CASE 
        WHEN batch_no ~ ('^BAT-' || v_date || '-\d+$')
        THEN regexp_replace(batch_no, '^BAT-\d{8}-', '')::INTEGER 
        ELSE 0 
      END
    ), 
    0
  ) + 1
  INTO v_max_seq
  FROM public.inventory_batches
  WHERE batch_no LIKE 'BAT-' || v_date || '-%';

  v_next_no := 'BAT-' || v_date || '-' || LPAD(v_max_seq::TEXT, 4, '0');
  RETURN v_next_no;
END;
$$ LANGUAGE plpgsql;

-- 4. Collection Number Generator
CREATE OR REPLACE FUNCTION public.generate_collection_no()
RETURNS TEXT AS $$
DECLARE
  v_date TEXT := TO_CHAR(NOW(), 'YYYYMMDD');
  v_max_seq INTEGER;
  v_next_no TEXT;
BEGIN
  SELECT COALESCE(
    MAX(
      CASE 
        WHEN collection_no ~ ('^COL-' || v_date || '-\d+$')
        THEN regexp_replace(collection_no, '^COL-\d{8}-', '')::INTEGER 
        ELSE 0 
      END
    ), 
    0
  ) + 1
  INTO v_max_seq
  FROM public.produce_collections
  WHERE collection_no LIKE 'COL-' || v_date || '-%';

  v_next_no := 'COL-' || v_date || '-' || LPAD(v_max_seq::TEXT, 4, '0');
  RETURN v_next_no;
END;
$$ LANGUAGE plpgsql;

-- 5. Farmer Code Generator
CREATE OR REPLACE FUNCTION public.generate_farmer_code()
RETURNS TEXT AS $$
DECLARE
  v_max_seq INTEGER;
  v_next_no TEXT;
BEGIN
  SELECT COALESCE(
    MAX(
      CASE 
        WHEN farmer_code ~ '^FRM-\d+$' 
        THEN regexp_replace(farmer_code, '^FRM-', '')::INTEGER 
        ELSE 0 
      END
    ), 
    0
  ) + 1
  INTO v_max_seq
  FROM public.farmers;

  v_next_no := 'FRM-' || LPAD(v_max_seq::TEXT, 6, '0');
  RETURN v_next_no;
END;
$$ LANGUAGE plpgsql;

-- 6. Buyer Code Generator
CREATE OR REPLACE FUNCTION public.generate_buyer_code()
RETURNS TEXT AS $$
DECLARE
  v_max_seq INTEGER;
  v_next_no TEXT;
BEGIN
  SELECT COALESCE(
    MAX(
      CASE 
        WHEN buyer_code ~ '^BUY-\d+$' 
        THEN regexp_replace(buyer_code, '^BUY-', '')::INTEGER 
        ELSE 0 
      END
    ), 
    0
  ) + 1
  INTO v_max_seq
  FROM public.buyers;

  v_next_no := 'BUY-' || LPAD(v_max_seq::TEXT, 6, '0');
  RETURN v_next_no;
END;
$$ LANGUAGE plpgsql;
