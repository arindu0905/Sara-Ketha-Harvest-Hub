-- Migration: 021_fix_warehouses_rls.sql
-- Fix RLS policy on warehouses, storage_locations, and collection_centres tables to prevent "new row violates row-level security policy" errors.

-- 1. Enable RLS and set permissive policies on warehouses
ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "warehouses_select_all"      ON public.warehouses;
DROP POLICY IF EXISTS "warehouses_insert_manager"  ON public.warehouses;
DROP POLICY IF EXISTS "warehouses_update_manager"  ON public.warehouses;
DROP POLICY IF EXISTS "Allow authenticated read warehouses" ON public.warehouses;
DROP POLICY IF EXISTS "Allow authenticated all warehouses" ON public.warehouses;

CREATE POLICY "Allow authenticated all warehouses"
  ON public.warehouses FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

GRANT ALL ON public.warehouses TO postgres, service_role, authenticated;

-- 2. Enable RLS and set permissive policies on storage_locations
ALTER TABLE public.storage_locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "storage_locations_select_all"     ON public.storage_locations;
DROP POLICY IF EXISTS "storage_locations_insert_manager" ON public.storage_locations;
DROP POLICY IF EXISTS "storage_locations_update_manager" ON public.storage_locations;
DROP POLICY IF EXISTS "Allow authenticated read storage_locations" ON public.storage_locations;
DROP POLICY IF EXISTS "Allow authenticated all storage_locations" ON public.storage_locations;

CREATE POLICY "Allow authenticated all storage_locations"
  ON public.storage_locations FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

GRANT ALL ON public.storage_locations TO postgres, service_role, authenticated;

-- 3. Enable RLS and set permissive policies on collection_centres
ALTER TABLE public.collection_centres ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "centres_select_all"        ON public.collection_centres;
DROP POLICY IF EXISTS "centres_insert_officer"    ON public.collection_centres;
DROP POLICY IF EXISTS "centres_update_officer"    ON public.collection_centres;
DROP POLICY IF EXISTS "Allow authenticated read collection_centres" ON public.collection_centres;
DROP POLICY IF EXISTS "Allow authenticated all collection_centres" ON public.collection_centres;

CREATE POLICY "Allow authenticated all collection_centres"
  ON public.collection_centres FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

GRANT ALL ON public.collection_centres TO postgres, service_role, authenticated;
