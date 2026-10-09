-- Migration: 018_farmer_invoices_table.sql
-- Create farmer_invoices table for storing separate farmer invoice records in Supabase PostgreSQL

CREATE TABLE IF NOT EXISTS public.farmer_invoices (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_no          TEXT UNIQUE NOT NULL,
  payment_id          UUID REFERENCES public.farmer_payments(id) ON DELETE SET NULL,
  collection_id       UUID NOT NULL REFERENCES public.produce_collections(id),
  farmer_id           UUID NOT NULL REFERENCES public.farmers(id),
  issue_date          DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date            DATE,
  gross_amount_lkr    DECIMAL(15, 2) NOT NULL,
  deductions_lkr      DECIMAL(15, 2) NOT NULL DEFAULT 0,
  net_amount_lkr      DECIMAL(15, 2) NOT NULL,
  status              TEXT NOT NULL DEFAULT 'issued', -- issued, calculated, approved, paid, cancelled
  payment_method      TEXT,
  payment_date        DATE,
  reference_no        TEXT,
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by          UUID REFERENCES public.profiles(id)
);

-- RLS Enable & Grant Access
ALTER TABLE public.farmer_invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read farmer_invoices" ON public.farmer_invoices;
CREATE POLICY "Allow authenticated read farmer_invoices"
  ON public.farmer_invoices FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow authenticated all farmer_invoices" ON public.farmer_invoices;
CREATE POLICY "Allow authenticated all farmer_invoices"
  ON public.farmer_invoices FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

GRANT ALL ON public.farmer_invoices TO postgres, service_role, authenticated;

-- Function: generate_farmer_invoice_no()
CREATE OR REPLACE FUNCTION generate_farmer_invoice_no()
RETURNS TEXT AS $$
DECLARE
  v_year TEXT;
  v_seq INTEGER;
  v_invoice_no TEXT;
BEGIN
  v_year := TO_CHAR(CURRENT_DATE, 'YYYY');
  SELECT COALESCE(
    MAX(
      CASE 
        WHEN invoice_no ~ ('^FINV-' || v_year || '-[0-9]+$') 
        THEN (regexp_replace(invoice_no, '^FINV-' || v_year || '-', ''))::INTEGER 
        ELSE 0 
      END
    ), 0
  ) + 1 INTO v_seq FROM public.farmer_invoices;
  
  v_invoice_no := 'FINV-' || v_year || '-' || LPAD(v_seq::TEXT, 6, '0');
  RETURN v_invoice_no;
END;
$$ LANGUAGE plpgsql;
