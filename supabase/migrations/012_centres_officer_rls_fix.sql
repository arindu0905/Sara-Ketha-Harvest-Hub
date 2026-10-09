-- ============================================================
-- HarvestHub — IMMEDIATE FIX for collection_centres RLS
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- STEP 1: Drop ALL existing policies on collection_centres
-- (the old "Administrators can manage centres" FOR ALL policy
--  blocks officers AND can interfere with service role)
DROP POLICY IF EXISTS "Anyone authenticated can view active centres" ON public.collection_centres;
DROP POLICY IF EXISTS "Administrators can manage centres"            ON public.collection_centres;

-- Also drop anything from migration 011/012 in case they ran partially
DROP POLICY IF EXISTS "centres_select_all"              ON public.collection_centres;
DROP POLICY IF EXISTS "centres_insert_officer"          ON public.collection_centres;
DROP POLICY IF EXISTS "centres_update_officer"          ON public.collection_centres;
DROP POLICY IF EXISTS "centres_select_authenticated"    ON public.collection_centres;
DROP POLICY IF EXISTS "centres_insert_officer_admin"    ON public.collection_centres;
DROP POLICY IF EXISTS "centres_update_officer_admin"    ON public.collection_centres;
DROP POLICY IF EXISTS "centres_delete_admin_only"       ON public.collection_centres;

-- STEP 2: Disable FORCE ROW LEVEL SECURITY so service role bypasses cleanly
ALTER TABLE public.collection_centres NO FORCE ROW LEVEL SECURITY;

-- STEP 3: Re-create clean, clear policies
-- SELECT — any authenticated user can read all centres
CREATE POLICY "centres_select"
  ON public.collection_centres FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- INSERT — officers and admins can create centres
--         (security enforced in backend middleware; this is DB-level safety net)
CREATE POLICY "centres_insert"
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

-- UPDATE — officers and admins can update centres
CREATE POLICY "centres_update"
  ON public.collection_centres FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('collection_centre_officer', 'administrator')
        AND account_status = 'active'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('collection_centre_officer', 'administrator')
        AND account_status = 'active'
    )
  );

-- DELETE — admins only
CREATE POLICY "centres_delete"
  ON public.collection_centres FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role = 'administrator'
        AND account_status = 'active'
    )
  );

-- ============================================================
-- Verify the fix — run this SELECT to confirm policies applied
-- ============================================================
SELECT schemaname, tablename, policyname, cmd, roles
FROM pg_policies
WHERE tablename = 'collection_centres'
ORDER BY policyname;
