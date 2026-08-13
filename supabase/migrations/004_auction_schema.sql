-- ============================================================
-- HarvestHub Migration 004: Agricultural Produce Auction Module
-- Sri Lankan Agricultural Produce Auction & Competitive Bidding
-- Currency: LKR | Weight: kg | Timezone: Asia/Colombo
-- ============================================================

-- ============================================================
-- NEW ENUMS
-- ============================================================

CREATE TYPE auction_status AS ENUM (
  'draft',
  'scheduled',
  'open',
  'paused',
  'closed',
  'reserve_not_met',
  'awaiting_award',
  'awarded',
  'payment_pending',
  'paid',
  'stock_allocated',
  'preparing',
  'dispatched',
  'delivered',
  'completed',
  'cancelled',
  'payment_defaulted',
  'disputed'
);

CREATE TYPE auction_lot_status AS ENUM (
  'draft',
  'published',
  'open',
  'closed',
  'awarded',
  'cancelled',
  're_offered'
);

CREATE TYPE auction_bid_status AS ENUM (
  'pending',
  'accepted',
  'rejected',
  'outbid',
  'withdrawn_system',
  'winning'
);

CREATE TYPE auction_type AS ENUM (
  'open_ascending',
  'sealed_bid'
);

CREATE TYPE auction_dispute_status AS ENUM (
  'submitted',
  'under_review',
  'resolved',
  'rejected'
);

CREATE TYPE auction_unit AS ENUM (
  'kg',
  'metric_ton',
  'bag',
  'crate',
  'piece'
);

CREATE TYPE auction_payment_method AS ENUM (
  'bank_transfer',
  'lanka_qr',
  'card',
  'cash',
  'buyer_credit'
);

-- ============================================================
-- TABLE: auctions
-- ============================================================

CREATE TABLE IF NOT EXISTS public.auctions (
  id                       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auction_number           TEXT UNIQUE NOT NULL,
  collection_centre_id     UUID NOT NULL REFERENCES public.collection_centres(id),
  auction_type             auction_type NOT NULL DEFAULT 'open_ascending',
  title                    TEXT NOT NULL,
  title_sinhala            TEXT,
  title_tamil              TEXT,
  description              TEXT,
  description_sinhala      TEXT,
  description_tamil        TEXT,

  -- Timing
  start_at                 TIMESTAMPTZ NOT NULL,
  end_at                   TIMESTAMPTZ NOT NULL,
  original_end_at          TIMESTAMPTZ NOT NULL,   -- preserved when auto-extended

  -- Pricing
  currency                 TEXT NOT NULL DEFAULT 'LKR',
  starting_price           DECIMAL(15, 2) NOT NULL,    -- per unit (summary; lot overrides)
  reserve_price            DECIMAL(15, 2),              -- per unit (optional)
  minimum_increment        DECIMAL(12, 2) NOT NULL DEFAULT 100.00,

  -- Deadline
  payment_deadline_hours   INTEGER NOT NULL DEFAULT 48,

  -- Anti-sniping
  auto_extension_enabled   BOOLEAN NOT NULL DEFAULT TRUE,
  extension_minutes        INTEGER NOT NULL DEFAULT 5,

  -- Status
  status                   auction_status NOT NULL DEFAULT 'draft',

  -- Workflow actors
  created_by               UUID NOT NULL REFERENCES public.profiles(id),
  submitted_by             UUID REFERENCES public.profiles(id),
  submitted_at             TIMESTAMPTZ,
  approved_by              UUID REFERENCES public.profiles(id),
  approved_at              TIMESTAMPTZ,
  published_by             UUID REFERENCES public.profiles(id),
  published_at             TIMESTAMPTZ,
  cancelled_by             UUID REFERENCES public.profiles(id),
  cancelled_at             TIMESTAMPTZ,
  cancellation_reason      TEXT,

  -- Audit
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by               UUID REFERENCES public.profiles(id),

  -- Constraints
  CONSTRAINT ck_auction_dates        CHECK (start_at < end_at),
  CONSTRAINT ck_auction_original_end CHECK (original_end_at <= end_at),
  CONSTRAINT ck_starting_price_pos   CHECK (starting_price > 0),
  CONSTRAINT ck_reserve_gte_start    CHECK (reserve_price IS NULL OR reserve_price >= starting_price),
  CONSTRAINT ck_min_increment_pos    CHECK (minimum_increment > 0),
  CONSTRAINT ck_payment_deadline_pos CHECK (payment_deadline_hours > 0),
  CONSTRAINT ck_extension_min_pos    CHECK (extension_minutes > 0)
);

-- ============================================================
-- TABLE: auction_lots
-- ============================================================

CREATE TABLE IF NOT EXISTS public.auction_lots (
  id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auction_id                  UUID NOT NULL REFERENCES public.auctions(id) ON DELETE CASCADE,
  lot_number                  INTEGER NOT NULL,            -- sequential within auction
  inventory_batch_id          UUID NOT NULL REFERENCES public.inventory_batches(id),
  crop_category_id            UUID NOT NULL REFERENCES public.crop_categories(id),
  crop_variety_id             UUID REFERENCES public.crop_varieties(id),
  quality_grade               quality_grade NOT NULL,

  -- Quantity
  lot_quantity                DECIMAL(12, 3) NOT NULL,
  unit                        auction_unit NOT NULL DEFAULT 'kg',

  -- Pricing (per unit)
  starting_price_per_unit     DECIMAL(12, 2) NOT NULL,
  reserve_price_per_unit      DECIMAL(12, 2),
  current_price_per_unit      DECIMAL(12, 2) NOT NULL,    -- updated on each accepted bid

  -- Location
  warehouse_id                UUID REFERENCES public.warehouses(id),
  storage_location_id         UUID REFERENCES public.storage_locations(id),

  -- Dates
  expiry_date                 DATE,                        -- must be after auction end_at

  -- Traceability
  harvest_season              TEXT,                        -- 'Maha 2025/26', 'Yala 2025'
  farming_method              farming_method,
  origin_district             TEXT,
  origin_divisional_secretariat TEXT,
  traceability_notes          TEXT,

  -- Status
  lot_status                  auction_lot_status NOT NULL DEFAULT 'draft',

  -- Winner (denormalized for fast reads)
  winning_bid_id              UUID,                        -- FK set after close
  winning_buyer_id            UUID REFERENCES public.buyers(id),
  winning_price_per_unit      DECIMAL(12, 2),
  total_winning_amount        DECIMAL(15, 2),

  -- Audit
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by                  UUID REFERENCES public.profiles(id),

  CONSTRAINT ck_lot_qty_positive         CHECK (lot_quantity > 0),
  CONSTRAINT ck_lot_starting_price_pos   CHECK (starting_price_per_unit > 0),
  CONSTRAINT ck_lot_reserve_gte_start    CHECK (reserve_price_per_unit IS NULL OR reserve_price_per_unit >= starting_price_per_unit),
  CONSTRAINT ck_lot_current_price_pos    CHECK (current_price_per_unit > 0),
  CONSTRAINT uq_lot_per_auction          UNIQUE (auction_id, lot_number)
);

-- ============================================================
-- TABLE: auction_lot_images
-- ============================================================

CREATE TABLE IF NOT EXISTS public.auction_lot_images (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lot_id         UUID NOT NULL REFERENCES public.auction_lots(id) ON DELETE CASCADE,
  storage_path   TEXT NOT NULL,
  file_name      TEXT NOT NULL,
  mime_type      TEXT,
  sort_order     INTEGER NOT NULL DEFAULT 0,
  uploaded_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  uploaded_by    UUID REFERENCES public.profiles(id)
);

-- ============================================================
-- TABLE: auction_bids
-- IMMUTABLE: no UPDATE or DELETE allowed through client access
-- ============================================================

CREATE TABLE IF NOT EXISTS public.auction_bids (
  id                       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auction_id               UUID NOT NULL REFERENCES public.auctions(id),
  auction_lot_id           UUID NOT NULL REFERENCES public.auction_lots(id),
  buyer_id                 UUID NOT NULL REFERENCES public.buyers(id),

  -- Bid amounts
  bid_amount_per_unit      DECIMAL(12, 2) NOT NULL,
  bid_quantity             DECIMAL(12, 3) NOT NULL,
  total_bid_amount         DECIMAL(15, 2) NOT NULL
                           GENERATED ALWAYS AS (bid_amount_per_unit * bid_quantity) STORED,

  -- Sequencing
  bid_sequence             BIGINT NOT NULL,                -- from sequence; monotone across auction lot

  -- Timing (server-side only)
  bid_time                 TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC'),

  -- Status
  status                   auction_bid_status NOT NULL DEFAULT 'pending',
  rejection_reason         TEXT,

  -- Privacy / forensics (hashed, not raw data)
  bidder_ip_hash           TEXT,
  bidder_device_reference  TEXT,

  -- Audit
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT ck_bid_amount_positive  CHECK (bid_amount_per_unit > 0),
  CONSTRAINT ck_bid_qty_positive     CHECK (bid_quantity > 0)
);

-- Sequence for bid ordering within a lot
CREATE SEQUENCE IF NOT EXISTS auction_bid_sequence START 1 INCREMENT 1;

-- ============================================================
-- TABLE: auction_winners
-- ============================================================

CREATE TABLE IF NOT EXISTS public.auction_winners (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auction_id            UUID NOT NULL REFERENCES public.auctions(id),
  auction_lot_id        UUID NOT NULL REFERENCES public.auction_lots(id),
  winning_bid_id        UUID NOT NULL REFERENCES public.auction_bids(id),
  buyer_id              UUID NOT NULL REFERENCES public.buyers(id),

  -- Winning terms
  winning_price_per_unit DECIMAL(12, 2) NOT NULL,
  awarded_quantity       DECIMAL(12, 3) NOT NULL,
  total_award_amount     DECIMAL(15, 2) NOT NULL,

  -- Payment
  payment_deadline_at    TIMESTAMPTZ NOT NULL,
  payment_status         TEXT NOT NULL DEFAULT 'pending',  -- pending, paid, defaulted
  payment_confirmed_at   TIMESTAMPTZ,
  payment_confirmed_by   UUID REFERENCES public.profiles(id),

  -- Linked documents
  purchase_order_id      UUID REFERENCES public.purchase_orders(id),
  invoice_id             UUID REFERENCES public.invoices(id),

  -- Offer order (1 = original winner, 2+ = next bidder offers)
  offer_round            INTEGER NOT NULL DEFAULT 1,

  -- Audit
  awarded_by             UUID REFERENCES public.profiles(id),
  awarded_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT ck_winner_price_pos  CHECK (winning_price_per_unit > 0),
  CONSTRAINT ck_winner_qty_pos    CHECK (awarded_quantity > 0),
  CONSTRAINT ck_winner_amount_pos CHECK (total_award_amount > 0),
  CONSTRAINT uq_active_winner_per_lot UNIQUE (auction_lot_id, offer_round)
);

-- ============================================================
-- TABLE: auction_watchlists
-- ============================================================

CREATE TABLE IF NOT EXISTS public.auction_watchlists (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auction_id  UUID NOT NULL REFERENCES public.auctions(id) ON DELETE CASCADE,
  buyer_id    UUID NOT NULL REFERENCES public.buyers(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_watchlist_buyer_auction UNIQUE (auction_id, buyer_id)
);

-- ============================================================
-- TABLE: auction_events
-- Complete immutable timeline of every significant auction event
-- ============================================================

CREATE TABLE IF NOT EXISTS public.auction_events (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auction_id     UUID NOT NULL REFERENCES public.auctions(id),
  auction_lot_id UUID REFERENCES public.auction_lots(id),
  event_type     TEXT NOT NULL,   -- 'status_change','bid_placed','bid_rejected','extension',
                                  -- 'award_created','payment_confirmed','payment_default',
                                  -- 'dispute_submitted','offer_to_next','settlement_generated'
  event_data     JSONB,           -- flexible payload; never contains raw PII
  actor_id       UUID REFERENCES public.profiles(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC')
);

-- ============================================================
-- TABLE: auction_disputes
-- ============================================================

CREATE TABLE IF NOT EXISTS public.auction_disputes (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auction_id         UUID NOT NULL REFERENCES public.auctions(id),
  auction_lot_id     UUID REFERENCES public.auction_lots(id),
  submitted_by       UUID NOT NULL REFERENCES public.profiles(id),
  dispute_type       TEXT NOT NULL,   -- 'bid_dispute','payment_dispute','quality_dispute','other'
  description        TEXT NOT NULL,
  evidence_urls      TEXT[],
  status             auction_dispute_status NOT NULL DEFAULT 'submitted',
  assigned_to        UUID REFERENCES public.profiles(id),
  resolution         TEXT,
  resolved_by        UUID REFERENCES public.profiles(id),
  resolved_at        TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE: auction_settlements
-- Farmer settlement after auction completion
-- ============================================================

CREATE TABLE IF NOT EXISTS public.auction_settlements (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auction_id              UUID NOT NULL REFERENCES public.auctions(id),
  auction_lot_id          UUID NOT NULL REFERENCES public.auction_lots(id),
  farmer_id               UUID NOT NULL REFERENCES public.farmers(id),

  -- Calculation
  winning_price_per_unit  DECIMAL(12, 2) NOT NULL,
  awarded_quantity        DECIMAL(12, 3) NOT NULL,
  gross_amount_lkr        DECIMAL(15, 2) NOT NULL,
  service_charge_pct      DECIMAL(6, 4) NOT NULL,      -- e.g. 0.0200 = 2%
  service_charge_lkr      DECIMAL(15, 2) NOT NULL,
  other_deductions_lkr    DECIMAL(15, 2) NOT NULL DEFAULT 0,
  net_amount_lkr          DECIMAL(15, 2) NOT NULL,

  -- Status
  status                  payment_status NOT NULL DEFAULT 'pending_calculation',
  payment_method          TEXT,
  payment_date            DATE,
  payment_reference       TEXT,

  -- Workflow
  calculated_by           UUID REFERENCES public.profiles(id),
  calculated_at           TIMESTAMPTZ,
  approved_by             UUID REFERENCES public.profiles(id),
  approved_at             TIMESTAMPTZ,
  paid_by                 UUID REFERENCES public.profiles(id),
  paid_at                 TIMESTAMPTZ,

  notes                   TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT ck_settlement_gross_pos    CHECK (gross_amount_lkr > 0),
  CONSTRAINT ck_settlement_net_nonneg   CHECK (net_amount_lkr >= 0),
  CONSTRAINT ck_settlement_charge_range CHECK (service_charge_pct >= 0 AND service_charge_pct <= 1),
  CONSTRAINT uq_settlement_per_lot      UNIQUE (auction_lot_id, farmer_id)
);

-- ============================================================
-- TABLE: buyer_credit_limits
-- Per-buyer auction credit ceiling; managed by finance officer
-- ============================================================

CREATE TABLE IF NOT EXISTS public.buyer_credit_limits (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  buyer_id         UUID UNIQUE NOT NULL REFERENCES public.buyers(id) ON DELETE CASCADE,
  credit_limit_lkr DECIMAL(15, 2) NOT NULL DEFAULT 0,
  utilised_lkr     DECIMAL(15, 2) NOT NULL DEFAULT 0,
  available_lkr    DECIMAL(15, 2)
                   GENERATED ALWAYS AS (credit_limit_lkr - utilised_lkr) STORED,
  notes            TEXT,
  set_by           UUID REFERENCES public.profiles(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT ck_credit_limit_nonneg   CHECK (credit_limit_lkr >= 0),
  CONSTRAINT ck_utilised_nonneg       CHECK (utilised_lkr >= 0)
);

-- ============================================================
-- TABLE: buyer_deposits
-- External payment references ONLY – no internal stored-value wallet.
-- Stores only what is needed to reconcile with the licensed provider.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.buyer_deposits (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  buyer_id            UUID NOT NULL REFERENCES public.buyers(id) ON DELETE CASCADE,
  auction_winner_id   UUID REFERENCES public.auction_winners(id),

  -- Provider details
  payment_provider    TEXT NOT NULL,                -- 'payhere','ipay','bank_transfer','cash'
  provider_reference  TEXT,                         -- provider's transaction ID
  provider_status     TEXT NOT NULL DEFAULT 'pending', -- pending, completed, failed, refunded

  -- Amount (informational; no funds stored here)
  amount_lkr          DECIMAL(15, 2) NOT NULL,
  currency            TEXT NOT NULL DEFAULT 'LKR',

  -- Receipt
  receipt_storage_path TEXT,
  recorded_by          UUID REFERENCES public.profiles(id),
  verified_by          UUID REFERENCES public.profiles(id),
  verified_at          TIMESTAMPTZ,

  -- Timestamps
  payment_initiated_at TIMESTAMPTZ,
  payment_completed_at TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT ck_deposit_amount_pos CHECK (amount_lkr > 0)
);

-- ============================================================
-- TABLE: auction_notification_settings (per-buyer preferences)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.auction_notification_prefs (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  buyer_id         UUID UNIQUE NOT NULL REFERENCES public.buyers(id) ON DELETE CASCADE,
  notify_outbid    BOOLEAN NOT NULL DEFAULT TRUE,
  notify_won       BOOLEAN NOT NULL DEFAULT TRUE,
  notify_deadline  BOOLEAN NOT NULL DEFAULT TRUE,
  notify_new_lot   BOOLEAN NOT NULL DEFAULT TRUE,
  sms_enabled      BOOLEAN NOT NULL DEFAULT FALSE,
  sms_phone        TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================

-- auctions
CREATE INDEX idx_auctions_status         ON public.auctions(status);
CREATE INDEX idx_auctions_centre         ON public.auctions(collection_centre_id);
CREATE INDEX idx_auctions_dates          ON public.auctions(start_at, end_at);
CREATE INDEX idx_auctions_created_by     ON public.auctions(created_by);

-- auction_lots
CREATE INDEX idx_lots_auction            ON public.auction_lots(auction_id);
CREATE INDEX idx_lots_batch              ON public.auction_lots(inventory_batch_id);
CREATE INDEX idx_lots_status             ON public.auction_lots(lot_status);
CREATE INDEX idx_lots_category           ON public.auction_lots(crop_category_id);
CREATE INDEX idx_lots_expiry             ON public.auction_lots(expiry_date);

-- auction_bids  (critical for winner queries and buyer history)
CREATE INDEX idx_bids_lot_price          ON public.auction_bids(auction_lot_id, bid_amount_per_unit DESC, bid_time);
CREATE INDEX idx_bids_auction_buyer      ON public.auction_bids(auction_id, buyer_id);
CREATE INDEX idx_bids_buyer              ON public.auction_bids(buyer_id);
CREATE INDEX idx_bids_status             ON public.auction_bids(status);
CREATE INDEX idx_bids_time               ON public.auction_bids(bid_time);

-- auction_winners
CREATE INDEX idx_winners_auction         ON public.auction_winners(auction_id);
CREATE INDEX idx_winners_buyer           ON public.auction_winners(buyer_id);
CREATE INDEX idx_winners_payment_status  ON public.auction_winners(payment_status);

-- auction_watchlists
CREATE INDEX idx_watchlist_buyer         ON public.auction_watchlists(buyer_id);
CREATE INDEX idx_watchlist_auction       ON public.auction_watchlists(auction_id);

-- auction_events
CREATE INDEX idx_events_auction          ON public.auction_events(auction_id);
CREATE INDEX idx_events_lot              ON public.auction_events(auction_lot_id);
CREATE INDEX idx_events_type             ON public.auction_events(event_type);
CREATE INDEX idx_events_created          ON public.auction_events(created_at);

-- auction_disputes
CREATE INDEX idx_disputes_auction        ON public.auction_disputes(auction_id);
CREATE INDEX idx_disputes_status         ON public.auction_disputes(status);
CREATE INDEX idx_disputes_submitter      ON public.auction_disputes(submitted_by);

-- auction_settlements
CREATE INDEX idx_settlements_auction     ON public.auction_settlements(auction_id);
CREATE INDEX idx_settlements_farmer      ON public.auction_settlements(farmer_id);
CREATE INDEX idx_settlements_status      ON public.auction_settlements(status);

-- buyer_credit_limits
CREATE INDEX idx_credit_limits_buyer     ON public.buyer_credit_limits(buyer_id);

-- buyer_deposits
CREATE INDEX idx_deposits_buyer          ON public.buyer_deposits(buyer_id);
CREATE INDEX idx_deposits_winner         ON public.buyer_deposits(auction_winner_id);
CREATE INDEX idx_deposits_provider       ON public.buyer_deposits(payment_provider, provider_reference);

-- ============================================================
-- UPDATED_AT TRIGGERS for new tables
-- ============================================================

CREATE TRIGGER trg_auctions_updated_at
  BEFORE UPDATE ON public.auctions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trg_lots_updated_at
  BEFORE UPDATE ON public.auction_lots
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trg_winners_updated_at
  BEFORE UPDATE ON public.auction_winners
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trg_disputes_updated_at
  BEFORE UPDATE ON public.auction_disputes
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trg_settlements_updated_at
  BEFORE UPDATE ON public.auction_settlements
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trg_credit_limits_updated_at
  BEFORE UPDATE ON public.buyer_credit_limits
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trg_deposits_updated_at
  BEFORE UPDATE ON public.buyer_deposits
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trg_notif_prefs_updated_at
  BEFORE UPDATE ON public.auction_notification_prefs
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- BUSINESS RULE: Prevent immutable core lot fields from changing
-- after bidding has started on that lot
-- ============================================================

CREATE OR REPLACE FUNCTION public.prevent_lot_mutation_after_bidding()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if any accepted/winning bids exist for this lot
  IF EXISTS (
    SELECT 1 FROM public.auction_bids
    WHERE auction_lot_id = OLD.id
      AND status IN ('accepted', 'winning', 'outbid')
  ) THEN
    -- Only these fields are locked after bidding starts
    IF (OLD.lot_quantity IS DISTINCT FROM NEW.lot_quantity OR
        OLD.quality_grade IS DISTINCT FROM NEW.quality_grade OR
        OLD.reserve_price_per_unit IS DISTINCT FROM NEW.reserve_price_per_unit OR
        OLD.inventory_batch_id IS DISTINCT FROM NEW.inventory_batch_id) THEN
      RAISE EXCEPTION
        'Cannot modify lot quantity, grade, reserve price, or batch after bidding has started. Lot ID: %', OLD.id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prevent_lot_mutation
  BEFORE UPDATE ON public.auction_lots
  FOR EACH ROW EXECUTE FUNCTION public.prevent_lot_mutation_after_bidding();

-- ============================================================
-- BUSINESS RULE: Bids are IMMUTABLE after insertion
-- Prevent any UPDATE or DELETE on auction_bids (enforced at DB level)
-- ============================================================

CREATE OR REPLACE FUNCTION public.prevent_bid_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION
    'Auction bids are immutable records. They cannot be updated or deleted. Bid ID: %', COALESCE(OLD.id::TEXT, 'unknown');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_bids_no_update
  BEFORE UPDATE ON public.auction_bids
  FOR EACH ROW EXECUTE FUNCTION public.prevent_bid_mutation();

CREATE TRIGGER trg_bids_no_delete
  BEFORE DELETE ON public.auction_bids
  FOR EACH ROW EXECUTE FUNCTION public.prevent_bid_mutation();

-- ============================================================
-- BUSINESS RULE: Validate lot expiry vs auction end date
-- ============================================================

CREATE OR REPLACE FUNCTION public.validate_lot_expiry()
RETURNS TRIGGER AS $$
DECLARE
  v_end_at TIMESTAMPTZ;
BEGIN
  SELECT end_at INTO v_end_at FROM public.auctions WHERE id = NEW.auction_id;

  IF NEW.expiry_date IS NOT NULL AND NEW.expiry_date < v_end_at::DATE THEN
    RAISE EXCEPTION
      'Lot expiry date (%) must be on or after the auction end date (%)',
      NEW.expiry_date, v_end_at::DATE;
  END IF;

  -- Confirm batch is not expired now
  IF EXISTS (
    SELECT 1 FROM public.inventory_batches
    WHERE id = NEW.inventory_batch_id
      AND expected_expiry_date IS NOT NULL
      AND expected_expiry_date < CURRENT_DATE
  ) THEN
    RAISE EXCEPTION 'Cannot create a lot for an expired inventory batch';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validate_lot_expiry
  BEFORE INSERT ON public.auction_lots
  FOR EACH ROW EXECUTE FUNCTION public.validate_lot_expiry();

-- ============================================================
-- BUSINESS RULE: Prevent same batch being simultaneously reserved
-- for a regular stock allocation AND an auction lot
-- ============================================================

CREATE OR REPLACE FUNCTION public.prevent_double_reserve_auction()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if this batch already has an active auction lot
  IF EXISTS (
    SELECT 1 FROM public.auction_lots al
    JOIN public.auctions a ON a.id = al.auction_id
    WHERE al.inventory_batch_id = NEW.inventory_batch_id
      AND al.lot_status IN ('draft', 'published', 'open')
      AND a.status NOT IN ('cancelled', 'completed', 'reserve_not_met')
  ) THEN
    RAISE EXCEPTION
      'Inventory batch % is already committed to an active auction lot',
      NEW.inventory_batch_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prevent_double_reserve_auction
  BEFORE INSERT ON public.auction_lots
  FOR EACH ROW EXECUTE FUNCTION public.prevent_double_reserve_auction();

-- Symmetric check: prevent adding an auction lot for a batch
-- that already has a stock allocation (regular order)
CREATE OR REPLACE FUNCTION public.prevent_auction_on_reserved_batch()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.stock_allocations sa
    WHERE sa.batch_id = NEW.inventory_batch_id
      AND sa.status = 'reserved'
  ) THEN
    RAISE EXCEPTION
      'Inventory batch % is already reserved for a regular purchase order. Release it first.',
      NEW.inventory_batch_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prevent_auction_on_reserved_batch
  BEFORE INSERT ON public.auction_lots
  FOR EACH ROW EXECUTE FUNCTION public.prevent_auction_on_reserved_batch();

-- ============================================================
-- FUNCTION: Generate auction number
-- AUC-YYYY-NNNNNN
-- ============================================================

CREATE OR REPLACE FUNCTION public.generate_auction_number()
RETURNS TEXT AS $$
DECLARE
  v_seq INTEGER;
BEGIN
  SELECT COUNT(*) + 1 INTO v_seq FROM public.auctions;
  RETURN 'AUC-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(v_seq::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- SYSTEM SETTINGS: Auction-specific defaults
-- These are inserted only if the key does not already exist.
-- ============================================================

INSERT INTO public.system_settings (key, value, description)
VALUES
  ('auction_service_charge_pct',   '2.00',  'Auction service charge percentage applied to winning bids (e.g. 2.00 = 2%)'),
  ('auction_default_extension_min', '5',    'Default anti-snipe extension duration in minutes'),
  ('auction_default_payment_hours', '48',   'Default payment deadline in hours after auction closes'),
  ('auction_default_min_increment', '100',  'Default minimum bid increment in LKR'),
  ('auction_sms_enabled',           'false','Whether SMS fallback notifications are active'),
  ('auction_sms_provider',          'stub', 'SMS provider: stub | dialog | mobitel'),
  ('auction_payment_provider',      'stub', 'Payment provider: stub | payhere | ipay | webxpay')
ON CONFLICT (key) DO NOTHING;
