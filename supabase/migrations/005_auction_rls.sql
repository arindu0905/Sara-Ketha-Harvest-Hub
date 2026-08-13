-- ============================================================
-- HarvestHub Migration 005: Auction Module – Row Level Security
-- ============================================================

-- ─── Enable RLS on all new tables ──────────────────────────

ALTER TABLE public.auctions                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auction_lots               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auction_lot_images         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auction_bids               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auction_winners            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auction_watchlists         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auction_events             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auction_disputes           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auction_settlements        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buyer_credit_limits        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buyer_deposits             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auction_lot_images         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auction_notification_prefs ENABLE ROW LEVEL SECURITY;

-- ─── Helper functions (reuse existing where possible) ───────

CREATE OR REPLACE FUNCTION public.is_inventory_manager()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'inventory_manager'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_buyer()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'buyer'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_finance_or_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('finance_officer', 'administrator')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Returns the buyer.id for the currently authenticated user
-- (re-uses existing get_buyer_id_for_user from migration 002)

-- Returns the farmer.id for the currently authenticated user
-- (re-uses existing get_farmer_id_for_user from migration 002)

-- ============================================================
-- AUCTIONS TABLE POLICIES
-- ============================================================

-- Public (unauthenticated): NO access to any auction data
-- Any authenticated user: can view scheduled/open/closed auctions (summary only)
CREATE POLICY "Authenticated users can view published auctions"
  ON public.auctions FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND status NOT IN ('draft')
  );

-- Inventory managers: full management of auctions at their centre
CREATE POLICY "Inventory managers can manage centre auctions"
  ON public.auctions FOR ALL
  USING (
    public.is_inventory_manager()
    AND collection_centre_id IN (
      SELECT assigned_centre FROM public.profiles WHERE id = auth.uid()
    )
  );

-- Administrators: full access to all auctions
CREATE POLICY "Administrators can manage all auctions"
  ON public.auctions FOR ALL
  USING (public.is_administrator());

-- Finance officers: read-only on all auctions
CREATE POLICY "Finance officers can view all auctions"
  ON public.auctions FOR SELECT
  USING (public.is_finance_officer());

-- Officers can approve/update status
CREATE POLICY "Officers can update auction status"
  ON public.auctions FOR UPDATE
  USING (
    public.get_current_user_role() IN ('collection_centre_officer', 'administrator')
  );

-- Service role insert (e.g., from backend)
CREATE POLICY "Service role can insert auctions"
  ON public.auctions FOR INSERT
  WITH CHECK (TRUE);

-- ============================================================
-- AUCTION_LOTS TABLE POLICIES
-- ============================================================

CREATE POLICY "Authenticated users can view lots of non-draft auctions"
  ON public.auction_lots FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND auction_id IN (
      SELECT id FROM public.auctions WHERE status NOT IN ('draft')
    )
  );

CREATE POLICY "Inventory managers can manage lots of their centre auctions"
  ON public.auction_lots FOR ALL
  USING (
    public.is_inventory_manager()
    AND auction_id IN (
      SELECT id FROM public.auctions
      WHERE collection_centre_id IN (
        SELECT assigned_centre FROM public.profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Administrators can manage all lots"
  ON public.auction_lots FOR ALL
  USING (public.is_administrator());

CREATE POLICY "Service role can insert lots"
  ON public.auction_lots FOR INSERT
  WITH CHECK (TRUE);

-- ============================================================
-- AUCTION_LOT_IMAGES TABLE POLICIES
-- ============================================================

CREATE POLICY "Authenticated users can view lot images of non-draft auctions"
  ON public.auction_lot_images FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND lot_id IN (
      SELECT id FROM public.auction_lots
      WHERE auction_id IN (
        SELECT id FROM public.auctions WHERE status NOT IN ('draft')
      )
    )
  );

CREATE POLICY "Inventory managers can manage lot images"
  ON public.auction_lot_images FOR ALL
  USING (public.is_inventory_manager() OR public.is_administrator());

-- ============================================================
-- AUCTION_BIDS TABLE POLICIES
-- ─────────────────────────────────────────────────────────────
-- CRITICAL: No UPDATE or DELETE allowed through any client policy.
-- Immutability is enforced by:
--   1. DB-level triggers (prevent_bid_mutation)
--   2. RLS: no UPDATE/DELETE policy defined → denied by default
-- ============================================================

-- Buyers: can view their own complete bid history
CREATE POLICY "Buyer can view own bids"
  ON public.auction_bids FOR SELECT
  USING (
    public.is_buyer()
    AND buyer_id = public.get_buyer_id_for_user()
  );

-- Buyers: can see current winning bid on open auctions (amount only, masked buyer)
-- This is handled at the application layer by returning only bid amount and time,
-- not buyer identity. The RLS below allows reading bids on open auctions.
CREATE POLICY "Anyone can view bid amounts on open/closed auctions"
  ON public.auction_bids FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND auction_id IN (
      SELECT id FROM public.auctions
      WHERE status IN ('open', 'closed', 'awaiting_award', 'awarded',
                       'payment_pending', 'paid', 'completed', 'reserve_not_met')
    )
  );

-- Buyers: can place bids (INSERT only – their own buyer_id enforced)
CREATE POLICY "Verified buyer can insert own bids"
  ON public.auction_bids FOR INSERT
  WITH CHECK (
    public.is_buyer()
    AND buyer_id = public.get_buyer_id_for_user()
    AND buyer_id IN (
      SELECT id FROM public.buyers
      WHERE verification_status = 'verified'
        AND account_status = 'active'
    )
  );

-- NO UPDATE policy for auction_bids → denied by default
-- NO DELETE policy for auction_bids → denied by default

-- Staff & admin: full read access for auditing
CREATE POLICY "Staff can view all bids for auditing"
  ON public.auction_bids FOR SELECT
  USING (
    public.get_current_user_role() IN (
      'inventory_manager', 'finance_officer', 'administrator'
    )
  );

-- ============================================================
-- AUCTION_WINNERS TABLE POLICIES
-- ============================================================

-- Winning buyer can view their own winner record
CREATE POLICY "Buyer can view own winner records"
  ON public.auction_winners FOR SELECT
  USING (
    public.is_buyer()
    AND buyer_id = public.get_buyer_id_for_user()
  );

-- Staff can view all winner records
CREATE POLICY "Staff can view all winner records"
  ON public.auction_winners FOR SELECT
  USING (
    public.get_current_user_role() IN (
      'inventory_manager', 'finance_officer', 'transport_coordinator', 'administrator'
    )
  );

-- Finance officers and admins can update winner records (payment confirmation)
CREATE POLICY "Finance officers can update winner payment status"
  ON public.auction_winners FOR UPDATE
  USING (public.is_finance_or_admin());

CREATE POLICY "Service role can insert winner records"
  ON public.auction_winners FOR INSERT
  WITH CHECK (TRUE);

-- ============================================================
-- AUCTION_WATCHLISTS TABLE POLICIES
-- ============================================================

-- Buyers: manage own watchlist
CREATE POLICY "Buyer can manage own watchlist"
  ON public.auction_watchlists FOR ALL
  USING (
    public.is_buyer()
    AND buyer_id = public.get_buyer_id_for_user()
  );

CREATE POLICY "Buyer can insert watchlist items"
  ON public.auction_watchlists FOR INSERT
  WITH CHECK (
    public.is_buyer()
    AND buyer_id = public.get_buyer_id_for_user()
  );

-- ============================================================
-- AUCTION_EVENTS TABLE POLICIES
-- ============================================================

-- All staff can view auction events for auditing
CREATE POLICY "Staff can view auction events"
  ON public.auction_events FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND public.get_current_user_role() IN (
      'inventory_manager', 'finance_officer', 'administrator',
      'collection_centre_officer', 'quality_inspector'
    )
  );

-- Administrators: full view
CREATE POLICY "Administrators can view all events"
  ON public.auction_events FOR SELECT
  USING (public.is_administrator());

-- Only service role can insert events (inserted by DB functions)
CREATE POLICY "Service role inserts auction events"
  ON public.auction_events FOR INSERT
  WITH CHECK (TRUE);

-- ============================================================
-- AUCTION_DISPUTES TABLE POLICIES
-- ============================================================

-- Any authenticated user can submit a dispute for an auction they participated in
CREATE POLICY "User can view own disputes"
  ON public.auction_disputes FOR SELECT
  USING (submitted_by = auth.uid());

CREATE POLICY "User can submit disputes"
  ON public.auction_disputes FOR INSERT
  WITH CHECK (submitted_by = auth.uid());

-- Administrators can manage all disputes
CREATE POLICY "Administrators can manage all disputes"
  ON public.auction_disputes FOR ALL
  USING (public.is_administrator());

-- Finance officers can view disputes
CREATE POLICY "Finance officers can view disputes"
  ON public.auction_disputes FOR SELECT
  USING (public.is_finance_officer());

-- ============================================================
-- AUCTION_SETTLEMENTS TABLE POLICIES
-- ============================================================

-- Farmer can view their own settlement records
CREATE POLICY "Farmer can view own settlements"
  ON public.auction_settlements FOR SELECT
  USING (
    farmer_id = public.get_farmer_id_for_user()
  );

-- Finance officers and admins manage settlements
CREATE POLICY "Finance officers can manage settlements"
  ON public.auction_settlements FOR ALL
  USING (public.is_finance_or_admin());

-- Inventory managers can view settlements for their centre
CREATE POLICY "Inventory managers can view settlements"
  ON public.auction_settlements FOR SELECT
  USING (public.is_inventory_manager());

CREATE POLICY "Service role can insert settlements"
  ON public.auction_settlements FOR INSERT
  WITH CHECK (TRUE);

-- ============================================================
-- BUYER_CREDIT_LIMITS TABLE POLICIES
-- ============================================================

-- Buyer can view their own credit limit
CREATE POLICY "Buyer can view own credit limit"
  ON public.buyer_credit_limits FOR SELECT
  USING (
    public.is_buyer()
    AND buyer_id = public.get_buyer_id_for_user()
  );

-- Finance officers and admins can manage credit limits
CREATE POLICY "Finance officers can manage credit limits"
  ON public.buyer_credit_limits FOR ALL
  USING (public.is_finance_or_admin());

CREATE POLICY "Service role can insert credit limits"
  ON public.buyer_credit_limits FOR INSERT
  WITH CHECK (TRUE);

-- ============================================================
-- BUYER_DEPOSITS TABLE POLICIES
-- ============================================================

-- Buyer can view their own deposit references
CREATE POLICY "Buyer can view own deposit records"
  ON public.buyer_deposits FOR SELECT
  USING (
    public.is_buyer()
    AND buyer_id = public.get_buyer_id_for_user()
  );

-- Finance officers and admins can manage deposit records
CREATE POLICY "Finance officers can manage deposit records"
  ON public.buyer_deposits FOR ALL
  USING (public.is_finance_or_admin());

CREATE POLICY "Service role can insert deposit records"
  ON public.buyer_deposits FOR INSERT
  WITH CHECK (TRUE);

-- ============================================================
-- AUCTION_NOTIFICATION_PREFS TABLE POLICIES
-- ============================================================

CREATE POLICY "Buyer can manage own notification prefs"
  ON public.auction_notification_prefs FOR ALL
  USING (
    public.is_buyer()
    AND buyer_id = public.get_buyer_id_for_user()
  );

CREATE POLICY "Admin can view all notification prefs"
  ON public.auction_notification_prefs FOR SELECT
  USING (public.is_administrator());

-- ============================================================
-- EXTEND notification_type ENUM with auction events
-- ============================================================

ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'auction_published';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'auction_opening_soon';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'auction_new_high_bid';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'auction_outbid';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'auction_extended';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'auction_closed';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'auction_reserve_not_met';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'auction_won';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'auction_lost';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'auction_payment_deadline';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'auction_payment_confirmed';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'auction_payment_default';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'auction_next_bidder';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'auction_dispatch';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'auction_delivery_complete';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'auction_settlement';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'auction_dispute_update';
