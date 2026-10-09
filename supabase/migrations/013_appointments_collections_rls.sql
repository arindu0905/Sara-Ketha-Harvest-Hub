-- ============================================================
-- HarvestHub Migration 013: Delivery Appointments RLS Policies
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- delivery_appointments had RLS enabled (from 002) but NO policies,
-- meaning authenticated non-service-role reads were denied.
-- Backend uses supabaseAdmin (service role) which bypasses RLS,
-- but adding explicit policies ensures safety and future-proofing.

ALTER TABLE public.delivery_appointments NO FORCE ROW LEVEL SECURITY;

-- SELECT: farmers can see their own; staff can see all
CREATE POLICY "appointments_select_farmer_own"
  ON public.delivery_appointments FOR SELECT
  TO authenticated
  USING (
    farmer_id IN (SELECT id FROM public.farmers WHERE profile_id = auth.uid())
    OR
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('collection_centre_officer', 'quality_inspector',
                     'inventory_manager', 'finance_officer',
                     'transport_coordinator', 'administrator')
    )
  );

-- INSERT: farmers can create their own appointments; officers/admins too
CREATE POLICY "appointments_insert"
  ON public.delivery_appointments FOR INSERT
  TO authenticated
  WITH CHECK (
    farmer_id IN (SELECT id FROM public.farmers WHERE profile_id = auth.uid())
    OR
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('collection_centre_officer', 'administrator')
    )
  );

-- UPDATE (status changes): officers and admins only
CREATE POLICY "appointments_update_staff"
  ON public.delivery_appointments FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('collection_centre_officer', 'administrator')
    )
  );

-- Also fix produce_collections (same pattern — RLS enabled, no policies)
ALTER TABLE public.produce_collections NO FORCE ROW LEVEL SECURITY;

CREATE POLICY "collections_select_staff"
  ON public.produce_collections FOR SELECT
  TO authenticated
  USING (
    farmer_id IN (SELECT id FROM public.farmers WHERE profile_id = auth.uid())
    OR
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('collection_centre_officer', 'quality_inspector',
                     'inventory_manager', 'finance_officer',
                     'transport_coordinator', 'administrator')
    )
  );

CREATE POLICY "collections_insert_officer"
  ON public.produce_collections FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('collection_centre_officer', 'administrator')
    )
  );

CREATE POLICY "collections_update_officer"
  ON public.produce_collections FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('collection_centre_officer', 'administrator')
    )
  );

-- Verify
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE tablename IN ('delivery_appointments', 'produce_collections')
ORDER BY tablename, policyname;
