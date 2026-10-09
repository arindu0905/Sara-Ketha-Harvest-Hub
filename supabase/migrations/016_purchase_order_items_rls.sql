-- ============================================================
-- HarvestHub Migration 016: Purchase Order Items & Invoice Items RLS Policies
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- Drop existing policies if any exist
DROP POLICY IF EXISTS "Buyer can manage own order items" ON public.purchase_order_items;
DROP POLICY IF EXISTS "Staff can view and manage order items" ON public.purchase_order_items;
DROP POLICY IF EXISTS "Buyer can view own invoice items" ON public.invoice_items;
DROP POLICY IF EXISTS "Finance officers can manage invoice items" ON public.invoice_items;

-- Ensure RLS is enabled
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;

-- PURCHASE ORDER ITEMS POLICIES
CREATE POLICY "Buyer can manage own order items"
  ON public.purchase_order_items FOR ALL
  TO authenticated
  USING (
    order_id IN (
      SELECT id FROM public.purchase_orders
      WHERE buyer_id IN (SELECT id FROM public.buyers WHERE profile_id = auth.uid())
         OR created_by = auth.uid()
    )
  )
  WITH CHECK (
    order_id IN (
      SELECT id FROM public.purchase_orders
      WHERE buyer_id IN (SELECT id FROM public.buyers WHERE profile_id = auth.uid())
         OR created_by = auth.uid()
    )
  );

CREATE POLICY "Staff can view and manage order items"
  ON public.purchase_order_items FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('inventory_manager', 'finance_officer', 'transport_coordinator', 'administrator', 'collection_centre_officer')
    )
  );

-- INVOICE ITEMS POLICIES
CREATE POLICY "Buyer can view own invoice items"
  ON public.invoice_items FOR SELECT
  TO authenticated
  USING (
    invoice_id IN (
      SELECT id FROM public.invoices
      WHERE buyer_id IN (SELECT id FROM public.buyers WHERE profile_id = auth.uid())
    )
  );

CREATE POLICY "Finance officers can manage invoice items"
  ON public.invoice_items FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('finance_officer', 'administrator')
    )
  );
