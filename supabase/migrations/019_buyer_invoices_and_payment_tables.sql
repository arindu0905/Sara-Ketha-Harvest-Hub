-- Migration: 019_buyer_invoices_and_payment_tables.sql
-- Dedicated buyer_invoices table, buyer_payments, farmer_invoices, and farmer_payments database tables

-- 1. Create buyer_invoices Table
CREATE TABLE IF NOT EXISTS public.buyer_invoices (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_no        TEXT UNIQUE NOT NULL,
  order_id          UUID NOT NULL REFERENCES public.purchase_orders(id),
  buyer_id          UUID NOT NULL REFERENCES public.buyers(id),
  issue_date        DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date          DATE,
  subtotal_lkr      DECIMAL(15, 2) NOT NULL DEFAULT 0,
  tax_amount_lkr    DECIMAL(15, 2) NOT NULL DEFAULT 0,
  discount_lkr      DECIMAL(15, 2) NOT NULL DEFAULT 0,
  total_amount_lkr  DECIMAL(15, 2) NOT NULL,
  status            TEXT NOT NULL DEFAULT 'issued', -- issued, paid, overdue, cancelled
  payment_method    TEXT,
  payment_date      DATE,
  reference_no      TEXT,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by        UUID REFERENCES public.profiles(id)
);

-- Enable RLS for buyer_invoices
ALTER TABLE public.buyer_invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read buyer_invoices" ON public.buyer_invoices;
CREATE POLICY "Allow authenticated read buyer_invoices"
  ON public.buyer_invoices FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow authenticated all buyer_invoices" ON public.buyer_invoices;
CREATE POLICY "Allow authenticated all buyer_invoices"
  ON public.buyer_invoices FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

GRANT ALL ON public.buyer_invoices TO postgres, service_role, authenticated;

-- 2. Ensure buyer_payments Table RLS & Permissions
ALTER TABLE public.buyer_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read buyer_payments" ON public.buyer_payments;
CREATE POLICY "Allow authenticated read buyer_payments"
  ON public.buyer_payments FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow authenticated all buyer_payments" ON public.buyer_payments;
CREATE POLICY "Allow authenticated all buyer_payments"
  ON public.buyer_payments FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

GRANT ALL ON public.buyer_payments TO postgres, service_role, authenticated;
