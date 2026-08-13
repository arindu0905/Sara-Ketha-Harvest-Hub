-- ============================================================
-- HarvestHub Migration 002: Row Level Security Policies
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collection_centres ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.farmers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.farmer_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crop_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crop_varieties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.farmer_crops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crop_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produce_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quality_inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collection_rejections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.storage_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buyers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buyer_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buyer_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.farmer_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.farmer_payment_deductions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transport_vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaint_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- HELPER FUNCTION: get current user role
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS user_role AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_administrator()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'administrator'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_finance_officer()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'finance_officer'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.get_farmer_id_for_user()
RETURNS UUID AS $$
  SELECT id FROM public.farmers WHERE profile_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.get_buyer_id_for_user()
RETURNS UUID AS $$
  SELECT id FROM public.buyers WHERE profile_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- PROFILES POLICIES
-- ============================================================

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "Administrators can view all profiles"
  ON public.profiles FOR SELECT
  USING (public.is_administrator());

CREATE POLICY "Officers can view all profiles"
  ON public.profiles FOR SELECT
  USING (public.get_current_user_role() IN (
    'collection_centre_officer', 'quality_inspector',
    'inventory_manager', 'finance_officer', 'transport_coordinator'
  ));

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid());

CREATE POLICY "Administrators can update all profiles"
  ON public.profiles FOR UPDATE
  USING (public.is_administrator());

CREATE POLICY "Service role can insert profiles"
  ON public.profiles FOR INSERT
  WITH CHECK (TRUE);

-- ============================================================
-- COLLECTION CENTRES POLICIES
-- ============================================================

CREATE POLICY "Anyone authenticated can view active centres"
  ON public.collection_centres FOR SELECT
  USING (auth.uid() IS NOT NULL AND is_active = TRUE);

CREATE POLICY "Administrators can manage centres"
  ON public.collection_centres FOR ALL
  USING (public.is_administrator());

-- ============================================================
-- FARMERS POLICIES
-- ============================================================

CREATE POLICY "Farmer can view own record"
  ON public.farmers FOR SELECT
  USING (profile_id = auth.uid());

CREATE POLICY "Staff can view all farmers"
  ON public.farmers FOR SELECT
  USING (public.get_current_user_role() IN (
    'collection_centre_officer', 'quality_inspector', 'inventory_manager',
    'finance_officer', 'transport_coordinator', 'administrator'
  ));

CREATE POLICY "Farmer can update own record"
  ON public.farmers FOR UPDATE
  USING (profile_id = auth.uid());

CREATE POLICY "Officers and admins can insert farmers"
  ON public.farmers FOR INSERT
  WITH CHECK (public.get_current_user_role() IN ('collection_centre_officer', 'administrator'));

CREATE POLICY "Officers and admins can update farmers"
  ON public.farmers FOR UPDATE
  USING (public.get_current_user_role() IN ('collection_centre_officer', 'administrator'));

-- ============================================================
-- FARMER DOCUMENTS POLICIES
-- ============================================================

CREATE POLICY "Farmer can view own documents"
  ON public.farmer_documents FOR SELECT
  USING (
    farmer_id IN (SELECT id FROM public.farmers WHERE profile_id = auth.uid())
  );

CREATE POLICY "Staff can view farmer documents"
  ON public.farmer_documents FOR SELECT
  USING (public.get_current_user_role() IN (
    'collection_centre_officer', 'administrator'
  ));

CREATE POLICY "Farmer can upload own documents"
  ON public.farmer_documents FOR INSERT
  WITH CHECK (
    farmer_id IN (SELECT id FROM public.farmers WHERE profile_id = auth.uid())
  );

-- ============================================================
-- CROP CATEGORIES & VARIETIES POLICIES (public read)
-- ============================================================

CREATE POLICY "Anyone can view active crop categories"
  ON public.crop_categories FOR SELECT
  USING (auth.uid() IS NOT NULL AND is_active = TRUE);

CREATE POLICY "Administrators can manage crop categories"
  ON public.crop_categories FOR ALL
  USING (public.is_administrator());

CREATE POLICY "Anyone can view active crop varieties"
  ON public.crop_varieties FOR SELECT
  USING (auth.uid() IS NOT NULL AND is_active = TRUE);

CREATE POLICY "Administrators can manage crop varieties"
  ON public.crop_varieties FOR ALL
  USING (public.is_administrator());

-- ============================================================
-- FARMER CROPS POLICIES
-- ============================================================

CREATE POLICY "Farmer can manage own crops"
  ON public.farmer_crops FOR ALL
  USING (
    farmer_id IN (SELECT id FROM public.farmers WHERE profile_id = auth.uid())
  );

CREATE POLICY "Staff can view all crops"
  ON public.farmer_crops FOR SELECT
  USING (public.get_current_user_role() IN (
    'collection_centre_officer', 'quality_inspector',
    'inventory_manager', 'finance_officer', 'administrator'
  ));

-- ============================================================
-- CROP PRICES POLICIES
-- ============================================================

CREATE POLICY "Anyone authenticated can view active prices"
  ON public.crop_prices FOR SELECT
  USING (auth.uid() IS NOT NULL AND status = 'active');

CREATE POLICY "All staff can view all prices"
  ON public.crop_prices FOR SELECT
  USING (public.get_current_user_role() IN (
    'collection_centre_officer', 'quality_inspector', 'inventory_manager',
    'finance_officer', 'transport_coordinator', 'administrator'
  ));

CREATE POLICY "Administrators can manage prices"
  ON public.crop_prices FOR ALL
  USING (public.is_administrator());

CREATE POLICY "Finance officers can create prices"
  ON public.crop_prices FOR INSERT
  WITH CHECK (public.is_finance_officer() OR public.is_administrator());

-- ============================================================
-- PRODUCE COLLECTIONS POLICIES
-- ============================================================

CREATE POLICY "Farmer can view own collections"
  ON public.produce_collections FOR SELECT
  USING (
    farmer_id IN (SELECT id FROM public.farmers WHERE profile_id = auth.uid())
  );

CREATE POLICY "Staff can view all collections"
  ON public.produce_collections FOR SELECT
  USING (public.get_current_user_role() IN (
    'collection_centre_officer', 'quality_inspector', 'inventory_manager',
    'finance_officer', 'transport_coordinator', 'administrator'
  ));

CREATE POLICY "Officers can create collections"
  ON public.produce_collections FOR INSERT
  WITH CHECK (public.get_current_user_role() IN ('collection_centre_officer', 'administrator'));

CREATE POLICY "Officers and inspectors can update collections"
  ON public.produce_collections FOR UPDATE
  USING (public.get_current_user_role() IN (
    'collection_centre_officer', 'quality_inspector', 'administrator'
  ));

-- ============================================================
-- QUALITY INSPECTIONS POLICIES
-- ============================================================

CREATE POLICY "Farmer can view own inspections"
  ON public.quality_inspections FOR SELECT
  USING (
    collection_id IN (
      SELECT id FROM public.produce_collections
      WHERE farmer_id IN (SELECT id FROM public.farmers WHERE profile_id = auth.uid())
    )
  );

CREATE POLICY "Staff can view inspections"
  ON public.quality_inspections FOR SELECT
  USING (public.get_current_user_role() IN (
    'collection_centre_officer', 'quality_inspector', 'inventory_manager',
    'finance_officer', 'administrator'
  ));

CREATE POLICY "Inspectors can create and update inspections"
  ON public.quality_inspections FOR ALL
  USING (public.get_current_user_role() IN ('quality_inspector', 'administrator'));

-- ============================================================
-- INVENTORY BATCHES POLICIES
-- ============================================================

CREATE POLICY "Inventory managers can manage batches"
  ON public.inventory_batches FOR ALL
  USING (public.get_current_user_role() IN ('inventory_manager', 'administrator'));

CREATE POLICY "Buyers can view available batches"
  ON public.inventory_batches FOR SELECT
  USING (
    public.get_current_user_role() = 'buyer'
    AND status = 'available'
  );

CREATE POLICY "Staff can view batches"
  ON public.inventory_batches FOR SELECT
  USING (public.get_current_user_role() IN (
    'collection_centre_officer', 'quality_inspector', 'finance_officer',
    'transport_coordinator', 'administrator'
  ));

-- ============================================================
-- PURCHASE ORDERS POLICIES
-- ============================================================

CREATE POLICY "Buyer can manage own orders"
  ON public.purchase_orders FOR ALL
  USING (
    buyer_id IN (SELECT id FROM public.buyers WHERE profile_id = auth.uid())
  );

CREATE POLICY "Staff can view and manage orders"
  ON public.purchase_orders FOR ALL
  USING (public.get_current_user_role() IN (
    'inventory_manager', 'finance_officer', 'transport_coordinator', 'administrator'
  ));

-- ============================================================
-- INVOICES POLICIES
-- ============================================================

CREATE POLICY "Buyer can view own invoices"
  ON public.invoices FOR SELECT
  USING (
    buyer_id IN (SELECT id FROM public.buyers WHERE profile_id = auth.uid())
  );

CREATE POLICY "Finance officers can manage invoices"
  ON public.invoices FOR ALL
  USING (public.is_finance_officer() OR public.is_administrator());

-- ============================================================
-- FARMER PAYMENTS POLICIES
-- ============================================================

CREATE POLICY "Farmer can view own payments"
  ON public.farmer_payments FOR SELECT
  USING (
    farmer_id IN (SELECT id FROM public.farmers WHERE profile_id = auth.uid())
  );

CREATE POLICY "Finance officers can manage farmer payments"
  ON public.farmer_payments FOR ALL
  USING (public.is_finance_officer() OR public.is_administrator());

CREATE POLICY "Staff can view farmer payments"
  ON public.farmer_payments FOR SELECT
  USING (public.get_current_user_role() IN (
    'collection_centre_officer', 'administrator'
  ));

-- ============================================================
-- NOTIFICATIONS POLICIES
-- ============================================================

CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT
  USING (recipient_id = auth.uid());

CREATE POLICY "Users can update own notifications (mark read)"
  ON public.notifications FOR UPDATE
  USING (recipient_id = auth.uid());

CREATE POLICY "Service role can insert notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (TRUE);

-- ============================================================
-- COMPLAINTS POLICIES
-- ============================================================

CREATE POLICY "Users can view own complaints"
  ON public.complaints FOR SELECT
  USING (submitted_by = auth.uid());

CREATE POLICY "Users can create complaints"
  ON public.complaints FOR INSERT
  WITH CHECK (submitted_by = auth.uid());

CREATE POLICY "Staff can view and manage all complaints"
  ON public.complaints FOR ALL
  USING (public.get_current_user_role() IN (
    'collection_centre_officer', 'finance_officer', 'administrator'
  ));

-- ============================================================
-- AUDIT LOGS POLICIES
-- ============================================================

CREATE POLICY "Administrators can view audit logs"
  ON public.audit_logs FOR SELECT
  USING (public.is_administrator());

CREATE POLICY "Service role can insert audit logs"
  ON public.audit_logs FOR INSERT
  WITH CHECK (TRUE);

-- ============================================================
-- SYSTEM SETTINGS POLICIES
-- ============================================================

CREATE POLICY "All authenticated users can view settings"
  ON public.system_settings FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Only administrators can modify settings"
  ON public.system_settings FOR ALL
  USING (public.is_administrator());

-- ============================================================
-- DELIVERY SCHEDULES POLICIES
-- ============================================================

CREATE POLICY "Transport coordinators can manage schedules"
  ON public.delivery_schedules FOR ALL
  USING (public.get_current_user_role() IN ('transport_coordinator', 'administrator'));

CREATE POLICY "Staff can view delivery schedules"
  ON public.delivery_schedules FOR SELECT
  USING (public.get_current_user_role() IN (
    'inventory_manager', 'finance_officer', 'collection_centre_officer'
  ));

CREATE POLICY "Buyers can view their own delivery schedules"
  ON public.delivery_schedules FOR SELECT
  USING (
    order_id IN (
      SELECT id FROM public.purchase_orders
      WHERE buyer_id IN (SELECT id FROM public.buyers WHERE profile_id = auth.uid())
    )
  );
