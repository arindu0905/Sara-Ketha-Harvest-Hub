-- ============================================================
-- HarvestHub Migration 011: Warehouse Storage & Centre RLS
-- Adds RLS policies for:
--   1. storage_locations — insert/update by inventory_manager & administrator
--   2. collection_centres — insert/update by collection_centre_officer & administrator
-- ============================================================

-- ─── Enable RLS on storage_locations (if not already) ──────────────────────
ALTER TABLE public.storage_locations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "storage_locations_select_all"     ON public.storage_locations;
DROP POLICY IF EXISTS "storage_locations_insert_manager" ON public.storage_locations;
DROP POLICY IF EXISTS "storage_locations_update_manager" ON public.storage_locations;

-- All authenticated users can view storage locations (needed for batch detail views)
CREATE POLICY "storage_locations_select_all"
  ON public.storage_locations FOR SELECT
  TO authenticated
  USING (TRUE);

-- Only inventory managers and admins can create storage locations
CREATE POLICY "storage_locations_insert_manager"
  ON public.storage_locations FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('inventory_manager', 'administrator')
        AND account_status = 'active'
    )
  );

-- Only inventory managers and admins can update storage locations
CREATE POLICY "storage_locations_update_manager"
  ON public.storage_locations FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('inventory_manager', 'administrator')
        AND account_status = 'active'
    )
  );

-- ─── Enable RLS on warehouses (if not already) ─────────────────────────────
ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "warehouses_select_all"      ON public.warehouses;
DROP POLICY IF EXISTS "warehouses_insert_manager"  ON public.warehouses;
DROP POLICY IF EXISTS "warehouses_update_manager"  ON public.warehouses;

-- All authenticated users can view warehouses
CREATE POLICY "warehouses_select_all"
  ON public.warehouses FOR SELECT
  TO authenticated
  USING (TRUE);

-- Only inventory managers and admins can create warehouses
CREATE POLICY "warehouses_insert_manager"
  ON public.warehouses FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('inventory_manager', 'administrator')
        AND account_status = 'active'
    )
  );

-- Only inventory managers and admins can update warehouses
CREATE POLICY "warehouses_update_manager"
  ON public.warehouses FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('inventory_manager', 'administrator')
        AND account_status = 'active'
    )
  );

-- ─── collection_centres — officer can now INSERT/UPDATE ─────────────────────
-- (Admins already have service role access; this grants row-level access
--  so the centreRoutes.ts backend using supabaseAdmin bypasses RLS naturally.
--  These policies support any future client-side direct Supabase calls.)

ALTER TABLE public.collection_centres ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "centres_select_all"        ON public.collection_centres;
DROP POLICY IF EXISTS "centres_insert_officer"    ON public.collection_centres;
DROP POLICY IF EXISTS "centres_update_officer"    ON public.collection_centres;

-- All authenticated users can view collection centres
CREATE POLICY "centres_select_all"
  ON public.collection_centres FOR SELECT
  TO authenticated
  USING (TRUE);

-- Collection centre officers and admins can register new centres
CREATE POLICY "centres_insert_officer"
  ON public.collection_centres FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('collection_centre_officer', 'administrator')
        AND account_status = 'active'
    )
  );

-- Collection centre officers can update centres; admins can update any
CREATE POLICY "centres_update_officer"
  ON public.collection_centres FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('collection_centre_officer', 'administrator')
        AND account_status = 'active'
    )
  );

-- ─── Grant service role bypass (safety net) ────────────────────────────────
-- The backend uses supabaseAdmin (service role) which bypasses RLS automatically.
-- No additional grants needed. The above policies protect direct client access.
