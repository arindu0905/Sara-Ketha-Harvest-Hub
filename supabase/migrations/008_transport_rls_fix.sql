-- ============================================================
-- HarvestHub Database Migration 008: Transport & Fleet RLS Fixes
-- Enables full access for Transport Coordinators & Administrators
-- ============================================================

-- 1. Transport Vehicles Policies
DROP POLICY IF EXISTS "Transport coordinators and admins can manage vehicles" ON public.transport_vehicles;
DROP POLICY IF EXISTS "Staff and authenticated users can view vehicles" ON public.transport_vehicles;
DROP POLICY IF EXISTS "Service role bypass transport_vehicles" ON public.transport_vehicles;

CREATE POLICY "Transport coordinators and admins can manage vehicles"
  ON public.transport_vehicles FOR ALL
  USING (public.get_current_user_role() IN ('transport_coordinator', 'administrator'))
  WITH CHECK (public.get_current_user_role() IN ('transport_coordinator', 'administrator'));

CREATE POLICY "Staff and authenticated users can view vehicles"
  ON public.transport_vehicles FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Service role bypass transport_vehicles"
  ON public.transport_vehicles FOR ALL
  USING (TRUE)
  WITH CHECK (TRUE);

-- 2. Drivers Policies
DROP POLICY IF EXISTS "Transport coordinators and admins can manage drivers" ON public.drivers;
DROP POLICY IF EXISTS "Staff and authenticated users can view drivers" ON public.drivers;
DROP POLICY IF EXISTS "Service role bypass drivers" ON public.drivers;

CREATE POLICY "Transport coordinators and admins can manage drivers"
  ON public.drivers FOR ALL
  USING (public.get_current_user_role() IN ('transport_coordinator', 'administrator'))
  WITH CHECK (public.get_current_user_role() IN ('transport_coordinator', 'administrator'));

CREATE POLICY "Staff and authenticated users can view drivers"
  ON public.drivers FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Service role bypass drivers"
  ON public.drivers FOR ALL
  USING (TRUE)
  WITH CHECK (TRUE);

-- 3. Delivery Schedules & Tracking Policies
DROP POLICY IF EXISTS "Transport coordinators can manage schedules" ON public.delivery_schedules;
DROP POLICY IF EXISTS "Staff can view delivery schedules" ON public.delivery_schedules;
DROP POLICY IF EXISTS "Buyers can view their own delivery schedules" ON public.delivery_schedules;
DROP POLICY IF EXISTS "Service role bypass delivery_schedules" ON public.delivery_schedules;

CREATE POLICY "Transport coordinators can manage schedules"
  ON public.delivery_schedules FOR ALL
  USING (public.get_current_user_role() IN ('transport_coordinator', 'administrator'))
  WITH CHECK (public.get_current_user_role() IN ('transport_coordinator', 'administrator'));

CREATE POLICY "Staff can view delivery schedules"
  ON public.delivery_schedules FOR SELECT
  USING (public.get_current_user_role() IN (
    'inventory_manager', 'finance_officer', 'collection_centre_officer', 'transport_coordinator', 'administrator'
  ));

CREATE POLICY "Buyers can view their own delivery schedules"
  ON public.delivery_schedules FOR SELECT
  USING (
    order_id IN (
      SELECT id FROM public.purchase_orders
      WHERE buyer_id IN (SELECT id FROM public.buyers WHERE profile_id = auth.uid())
    )
  );

CREATE POLICY "Service role bypass delivery_schedules"
  ON public.delivery_schedules FOR ALL
  USING (TRUE)
  WITH CHECK (TRUE);

-- 4. Delivery Tracking Policies
DROP POLICY IF EXISTS "Transport coordinators can manage tracking" ON public.delivery_tracking;
DROP POLICY IF EXISTS "Authenticated users can view tracking" ON public.delivery_tracking;
DROP POLICY IF EXISTS "Service role bypass delivery_tracking" ON public.delivery_tracking;

CREATE POLICY "Transport coordinators can manage tracking"
  ON public.delivery_tracking FOR ALL
  USING (public.get_current_user_role() IN ('transport_coordinator', 'administrator'))
  WITH CHECK (public.get_current_user_role() IN ('transport_coordinator', 'administrator'));

CREATE POLICY "Authenticated users can view tracking"
  ON public.delivery_tracking FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Service role bypass delivery_tracking"
  ON public.delivery_tracking FOR ALL
  USING (TRUE)
  WITH CHECK (TRUE);
