-- ============================================================
-- HarvestHub Migration 006: Auction Module – Functions & Triggers
-- ============================================================

-- ============================================================
-- FUNCTION: place_auction_bid (atomic, concurrent-safe RPC)
-- Called by backend API; all validation happens server-side.
-- Uses FOR UPDATE lock to serialize concurrent bids on same lot.
-- ============================================================

CREATE OR REPLACE FUNCTION public.place_auction_bid(
  p_auction_id            UUID,
  p_lot_id                UUID,
  p_buyer_id              UUID,
  p_bid_amount_per_unit   DECIMAL,
  p_bid_quantity          DECIMAL,
  p_ip_hash               TEXT DEFAULT NULL,
  p_device_ref            TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_auction         RECORD;
  v_lot             RECORD;
  v_buyer           RECORD;
  v_credit_limit    RECORD;
  v_server_time     TIMESTAMPTZ;
  v_min_bid         DECIMAL;
  v_new_end_at      TIMESTAMPTZ;
  v_bid_id          UUID;
  v_bid_seq         BIGINT;
  v_prev_winning_bid_id UUID;
  v_prev_buyer_profile_id UUID;
  v_extension_applied BOOLEAN := FALSE;
  v_batch_expiry    DATE;
BEGIN
  -- ── 0. Get authoritative server time ──────────────────────
  v_server_time := NOW() AT TIME ZONE 'UTC';

  -- ── 1. Lock the auction lot (serialise concurrent bids) ────
  SELECT al.*, a.status AS auction_status, a.end_at, a.minimum_increment,
         a.auto_extension_enabled, a.extension_minutes, a.currency,
         a.reserve_price, a.payment_deadline_hours
  INTO v_lot
  FROM public.auction_lots al
  JOIN public.auctions a ON a.id = al.auction_id
  WHERE al.id = p_lot_id AND al.auction_id = p_auction_id
  FOR UPDATE OF al;         -- row-level lock on this lot

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'code', 'LOT_NOT_FOUND',
      'message', 'Auction lot not found.');
  END IF;

  -- ── 2. Confirm auction is open ────────────────────────────
  IF v_lot.auction_status <> 'open' THEN
    RETURN jsonb_build_object('success', FALSE, 'code', 'AUCTION_NOT_OPEN',
      'message', 'This auction is not currently open for bidding.');
  END IF;

  IF v_lot.lot_status <> 'open' THEN
    RETURN jsonb_build_object('success', FALSE, 'code', 'LOT_NOT_OPEN',
      'message', 'This lot is not open for bidding.');
  END IF;

  -- ── 3. Confirm server time is before end_at ───────────────
  IF v_server_time >= v_lot.end_at THEN
    RETURN jsonb_build_object('success', FALSE, 'code', 'AUCTION_ENDED',
      'message', 'The auction bidding window has closed.');
  END IF;

  -- ── 4. Confirm batch not expired ─────────────────────────
  SELECT expected_expiry_date INTO v_batch_expiry
  FROM public.inventory_batches
  WHERE id = v_lot.inventory_batch_id;

  IF v_batch_expiry IS NOT NULL AND v_batch_expiry < CURRENT_DATE THEN
    RETURN jsonb_build_object('success', FALSE, 'code', 'BATCH_EXPIRED',
      'message', 'The inventory batch for this lot has expired.');
  END IF;

  -- ── 5. Confirm inventory availability ────────────────────
  IF p_bid_quantity > v_lot.lot_quantity THEN
    RETURN jsonb_build_object('success', FALSE, 'code', 'INSUFFICIENT_QUANTITY',
      'message', format('Bid quantity (%s) exceeds available lot quantity (%s).',
                        p_bid_quantity, v_lot.lot_quantity));
  END IF;

  -- ── 6a. Calculate minimum acceptable bid ─────────────────
  -- First bid: must be >= starting_price_per_unit
  -- Subsequent bids: must be >= current_price + minimum_increment
  IF v_lot.current_price_per_unit = v_lot.starting_price_per_unit
     AND NOT EXISTS (
       SELECT 1 FROM public.auction_bids
       WHERE auction_lot_id = p_lot_id AND status IN ('accepted','winning','outbid')
     )
  THEN
    v_min_bid := v_lot.starting_price_per_unit;
  ELSE
    v_min_bid := v_lot.current_price_per_unit + v_lot.minimum_increment;
  END IF;

  -- Fetch minimum_increment from auction (stored in v_lot)
  IF v_lot.minimum_increment IS NOT NULL THEN
    -- already have it
  ELSE
    -- Fallback to system setting
    SELECT value::DECIMAL INTO v_lot.minimum_increment
    FROM public.system_settings WHERE key = 'auction_default_min_increment';
  END IF;

  IF p_bid_amount_per_unit < v_min_bid THEN
    RETURN jsonb_build_object('success', FALSE, 'code', 'BID_TOO_LOW',
      'message', format('Minimum acceptable bid is LKR %s per unit.', v_min_bid),
      'minimum_bid', v_min_bid);
  END IF;

  -- ── 6b. Validate buyer eligibility ────────────────────────
  SELECT b.*, p.account_status AS profile_status
  INTO v_buyer
  FROM public.buyers b
  JOIN public.profiles p ON p.id = b.profile_id
  WHERE b.id = p_buyer_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'code', 'BUYER_NOT_FOUND',
      'message', 'Buyer account not found.');
  END IF;

  IF v_buyer.verification_status <> 'verified' THEN
    RETURN jsonb_build_object('success', FALSE, 'code', 'BUYER_NOT_VERIFIED',
      'message', 'Only verified buyers can place bids.');
  END IF;

  IF v_buyer.account_status <> 'active' OR v_buyer.profile_status = 'suspended' THEN
    RETURN jsonb_build_object('success', FALSE, 'code', 'BUYER_SUSPENDED',
      'message', 'Your buyer account is not active. Please contact support.');
  END IF;

  -- ── 6c. Check buyer credit limit ─────────────────────────
  SELECT * INTO v_credit_limit
  FROM public.buyer_credit_limits
  WHERE buyer_id = p_buyer_id;

  IF FOUND AND v_credit_limit.credit_limit_lkr > 0 THEN
    IF (p_bid_amount_per_unit * p_bid_quantity) >
       (v_credit_limit.credit_limit_lkr - v_credit_limit.utilised_lkr) THEN
      RETURN jsonb_build_object('success', FALSE, 'code', 'CREDIT_LIMIT_EXCEEDED',
        'message', format('This bid of LKR %s exceeds your available auction credit limit of LKR %s.',
                          (p_bid_amount_per_unit * p_bid_quantity),
                          (v_credit_limit.credit_limit_lkr - v_credit_limit.utilised_lkr)));
    END IF;
  END IF;

  -- ── 7. Insert immutable bid record ───────────────────────
  v_bid_seq := nextval('auction_bid_sequence');
  v_bid_id  := uuid_generate_v4();

  INSERT INTO public.auction_bids (
    id, auction_id, auction_lot_id, buyer_id,
    bid_amount_per_unit, bid_quantity,
    bid_sequence, bid_time, status,
    bidder_ip_hash, bidder_device_reference
  ) VALUES (
    v_bid_id, p_auction_id, p_lot_id, p_buyer_id,
    p_bid_amount_per_unit, p_bid_quantity,
    v_bid_seq, v_server_time, 'accepted',
    p_ip_hash, p_device_ref
  );

  -- ── 8. Mark previous winning bid as outbid ───────────────
  SELECT id, buyer_id INTO v_prev_winning_bid_id, v_prev_buyer_profile_id
  FROM public.auction_bids
  WHERE auction_lot_id = p_lot_id AND status = 'winning'
  LIMIT 1;

  IF v_prev_winning_bid_id IS NOT NULL THEN
    -- Trigger is disabled for status-only updates via service role;
    -- we use a direct UPDATE here (status field only, no other columns change)
    UPDATE public.auction_bids
    SET status = 'outbid'
    WHERE id = v_prev_winning_bid_id;

    -- Get the outbid buyer's profile_id for notification
    SELECT p.id INTO v_prev_buyer_profile_id
    FROM public.buyers b
    JOIN public.profiles p ON p.id = b.profile_id
    WHERE b.id = (SELECT buyer_id FROM public.auction_bids WHERE id = v_prev_winning_bid_id);
  END IF;

  -- Mark new bid as winning
  UPDATE public.auction_bids SET status = 'winning' WHERE id = v_bid_id;

  -- ── 9. Update lot's current price ────────────────────────
  UPDATE public.auction_lots
  SET current_price_per_unit = p_bid_amount_per_unit,
      updated_at = v_server_time
  WHERE id = p_lot_id;

  -- ── 9b. Outbid notification ───────────────────────────────
  IF v_prev_buyer_profile_id IS NOT NULL THEN
    INSERT INTO public.notifications (
      recipient_id, type, title, message,
      related_entity_type, related_entity_id
    ) VALUES (
      v_prev_buyer_profile_id,
      'auction_outbid',
      'You have been outbid',
      format('A higher bid of LKR %s has been placed on an auction lot you were winning.',
             p_bid_amount_per_unit),
      'auction_lot', p_lot_id
    );
  END IF;

  -- ── 10. Anti-sniping: auto-extend if bid in final window ──
  IF v_lot.auto_extension_enabled THEN
    IF (v_lot.end_at - v_server_time) < (v_lot.extension_minutes * INTERVAL '1 minute') THEN
      v_new_end_at := v_lot.end_at + (v_lot.extension_minutes * INTERVAL '1 minute');
      v_extension_applied := TRUE;

      UPDATE public.auctions
      SET end_at = v_new_end_at,
          updated_at = v_server_time
      WHERE id = p_auction_id;

      -- Record extension event
      INSERT INTO public.auction_events (auction_id, auction_lot_id, event_type, event_data, actor_id)
      VALUES (
        p_auction_id, p_lot_id, 'extension',
        jsonb_build_object(
          'previous_end_at', v_lot.end_at,
          'new_end_at',      v_new_end_at,
          'extension_minutes', v_lot.extension_minutes,
          'triggered_by_bid', v_bid_id
        ),
        NULL  -- system action
      );

      -- Notify watchlist watchers
      INSERT INTO public.notifications (recipient_id, type, title, message, related_entity_type, related_entity_id)
      SELECT aw.buyer_id,  -- buyer_id here is the buyers.profile_id equivalent via join below
             'auction_extended',
             'Auction Extended',
             format('The auction has been extended by %s minutes due to a late bid.',
                    v_lot.extension_minutes),
             'auction', p_auction_id
      FROM public.auction_watchlists aw
      JOIN public.buyers b ON b.id = aw.buyer_id
      JOIN public.profiles p ON p.id = b.profile_id
      WHERE aw.auction_id = p_auction_id;
    END IF;
  END IF;

  -- ── 11. Create auction event record ──────────────────────
  INSERT INTO public.auction_events (auction_id, auction_lot_id, event_type, event_data, actor_id)
  VALUES (
    p_auction_id, p_lot_id, 'bid_placed',
    jsonb_build_object(
      'bid_id',              v_bid_id,
      'bid_amount_per_unit', p_bid_amount_per_unit,
      'bid_quantity',        p_bid_quantity,
      'bid_sequence',        v_bid_seq,
      'new_price_per_unit',  p_bid_amount_per_unit,
      'extension_applied',   v_extension_applied
    ),
    NULL  -- actor resolved by caller context; no PII in events
  );

  -- ── 12. Return success ────────────────────────────────────
  RETURN jsonb_build_object(
    'success',             TRUE,
    'bid_id',              v_bid_id,
    'bid_sequence',        v_bid_seq,
    'bid_amount_per_unit', p_bid_amount_per_unit,
    'bid_time',            v_server_time,
    'extension_applied',   v_extension_applied,
    'new_end_at',          CASE WHEN v_extension_applied THEN v_new_end_at ELSE v_lot.end_at END,
    'current_price',       p_bid_amount_per_unit
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'code',    'INTERNAL_ERROR',
      'message', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated users (bid validation is inside the function)
GRANT EXECUTE ON FUNCTION public.place_auction_bid TO authenticated;

-- ============================================================
-- FUNCTION: close_auction
-- Determines winners, checks reserve price, creates winner records.
-- Called by scheduler or manually by authorized officer.
-- ============================================================

CREATE OR REPLACE FUNCTION public.close_auction(p_auction_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_auction     RECORD;
  v_lot         RECORD;
  v_winning_bid RECORD;
  v_winner_id   UUID;
  v_lots_closed INTEGER := 0;
  v_lots_reserve_not_met INTEGER := 0;
BEGIN
  SELECT * INTO v_auction FROM public.auctions WHERE id = p_auction_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'message', 'Auction not found');
  END IF;

  IF v_auction.status NOT IN ('open', 'paused') THEN
    RETURN jsonb_build_object('success', FALSE, 'message',
      format('Auction cannot be closed from status: %s', v_auction.status));
  END IF;

  -- Process each lot
  FOR v_lot IN
    SELECT * FROM public.auction_lots
    WHERE auction_id = p_auction_id AND lot_status IN ('open', 'published')
  LOOP
    -- Find highest valid bid
    SELECT * INTO v_winning_bid
    FROM public.auction_bids
    WHERE auction_lot_id = v_lot.id
      AND status IN ('winning', 'accepted')
    ORDER BY bid_amount_per_unit DESC, bid_time ASC
    LIMIT 1;

    IF NOT FOUND THEN
      -- No bids placed
      UPDATE public.auction_lots SET lot_status = 'closed' WHERE id = v_lot.id;
      INSERT INTO public.auction_events (auction_id, auction_lot_id, event_type, event_data)
      VALUES (p_auction_id, v_lot.id, 'lot_closed_no_bids', jsonb_build_object('reason', 'no_bids'));
      v_lots_reserve_not_met := v_lots_reserve_not_met + 1;
      CONTINUE;
    END IF;

    -- Check reserve price
    IF v_lot.reserve_price_per_unit IS NOT NULL
       AND v_winning_bid.bid_amount_per_unit < v_lot.reserve_price_per_unit THEN
      UPDATE public.auction_lots SET lot_status = 'closed' WHERE id = v_lot.id;
      INSERT INTO public.auction_events (auction_id, auction_lot_id, event_type, event_data)
      VALUES (p_auction_id, v_lot.id, 'reserve_not_met',
        jsonb_build_object(
          'highest_bid', v_winning_bid.bid_amount_per_unit,
          'reserve',     v_lot.reserve_price_per_unit
        ));
      v_lots_reserve_not_met := v_lots_reserve_not_met + 1;
      CONTINUE;
    END IF;

    -- Reserve is met (or not set): create winner record
    v_winner_id := uuid_generate_v4();
    INSERT INTO public.auction_winners (
      id, auction_id, auction_lot_id, winning_bid_id, buyer_id,
      winning_price_per_unit, awarded_quantity, total_award_amount,
      payment_deadline_at, offer_round
    ) VALUES (
      v_winner_id, p_auction_id, v_lot.id,
      v_winning_bid.id, v_winning_bid.buyer_id,
      v_winning_bid.bid_amount_per_unit, v_lot.lot_quantity,
      v_winning_bid.bid_amount_per_unit * v_lot.lot_quantity,
      NOW() + (v_auction.payment_deadline_hours || ' hours')::INTERVAL,
      1
    );

    -- Update lot with winner details
    UPDATE public.auction_lots SET
      lot_status             = 'closed',
      winning_bid_id         = v_winning_bid.id,
      winning_buyer_id       = v_winning_bid.buyer_id,
      winning_price_per_unit = v_winning_bid.bid_amount_per_unit,
      total_winning_amount   = v_winning_bid.bid_amount_per_unit * v_lot.lot_quantity
    WHERE id = v_lot.id;

    INSERT INTO public.auction_events (auction_id, auction_lot_id, event_type, event_data)
    VALUES (p_auction_id, v_lot.id, 'winner_determined',
      jsonb_build_object(
        'winner_id',            v_winner_id,
        'winning_price',        v_winning_bid.bid_amount_per_unit,
        'total_award',          v_winning_bid.bid_amount_per_unit * v_lot.lot_quantity,
        'payment_deadline_at',  (NOW() + (v_auction.payment_deadline_hours || ' hours')::INTERVAL)
      ));

    -- Notify winner
    INSERT INTO public.notifications (recipient_id, type, title, message, related_entity_type, related_entity_id)
    SELECT p.id, 'auction_won',
           'Congratulations! You won an auction lot',
           format('You have won the auction lot for LKR %s per %s. Please complete payment within %s hours.',
                  v_winning_bid.bid_amount_per_unit, v_lot.unit, v_auction.payment_deadline_hours),
           'auction_lot', v_lot.id
    FROM public.buyers b
    JOIN public.profiles p ON p.id = b.profile_id
    WHERE b.id = v_winning_bid.buyer_id;

    v_lots_closed := v_lots_closed + 1;
  END LOOP;

  -- Update auction status
  UPDATE public.auctions SET
    status     = CASE WHEN v_lots_closed > 0 THEN 'awaiting_award' ELSE 'reserve_not_met' END,
    updated_at = NOW()
  WHERE id = p_auction_id;

  INSERT INTO public.auction_events (auction_id, event_type, event_data)
  VALUES (p_auction_id, 'auction_closed',
    jsonb_build_object(
      'lots_with_winners',       v_lots_closed,
      'lots_reserve_not_met',    v_lots_reserve_not_met
    ));

  RETURN jsonb_build_object(
    'success',                   TRUE,
    'lots_with_winners',         v_lots_closed,
    'lots_reserve_not_met',      v_lots_reserve_not_met
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- FUNCTION: award_auction_lot
-- Creates purchase order + invoice, reserves inventory
-- ============================================================

CREATE OR REPLACE FUNCTION public.award_auction_lot(
  p_winner_id    UUID,
  p_awarded_by   UUID
)
RETURNS JSONB AS $$
DECLARE
  v_winner      RECORD;
  v_lot         RECORD;
  v_auction     RECORD;
  v_order_no    TEXT;
  v_invoice_no  TEXT;
  v_order_id    UUID;
  v_invoice_id  UUID;
BEGIN
  SELECT aw.*, al.inventory_batch_id, al.crop_category_id, al.crop_variety_id,
         al.quality_grade, al.lot_quantity, al.unit
  INTO v_winner
  FROM public.auction_winners aw
  JOIN public.auction_lots al ON al.id = aw.auction_lot_id
  WHERE aw.id = p_winner_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'message', 'Winner record not found');
  END IF;

  SELECT * INTO v_auction FROM public.auctions WHERE id = v_winner.auction_id;

  -- Generate order number
  v_order_no := 'ORD-AUC-' || TO_CHAR(NOW(), 'YYYY') || '-' ||
                LPAD((SELECT COUNT(*) + 1 FROM public.purchase_orders)::TEXT, 6, '0');

  -- Create purchase order
  INSERT INTO public.purchase_orders (
    order_no, buyer_id, centre_id, status, total_amount_lkr,
    notes, created_by, approved_by, approved_at
  ) VALUES (
    v_order_no, v_winner.buyer_id, v_auction.collection_centre_id,
    'stock_reserved', v_winner.total_award_amount,
    format('Auction award: %s, Lot %s', v_auction.auction_number, v_winner.auction_lot_id),
    p_awarded_by, p_awarded_by, NOW()
  ) RETURNING id INTO v_order_id;

  -- Create purchase order item
  INSERT INTO public.purchase_order_items (
    order_id, category_id, variety_id, grade,
    requested_qty_kg, unit_price_lkr, total_price_lkr
  ) VALUES (
    v_order_id, v_winner.crop_category_id, v_winner.crop_variety_id,
    v_winner.quality_grade::quality_grade,
    v_winner.lot_quantity, v_winner.winning_price_per_unit, v_winner.total_award_amount
  );

  -- Reserve inventory
  INSERT INTO public.stock_allocations (
    order_id, order_item_id, batch_id, allocated_qty_kg, allocated_by, status
  )
  SELECT v_order_id,
         (SELECT id FROM public.purchase_order_items WHERE order_id = v_order_id LIMIT 1),
         v_winner.inventory_batch_id,
         v_winner.lot_quantity,
         p_awarded_by,
         'reserved';

  -- Generate invoice number
  v_invoice_no := 'INV-AUC-' || TO_CHAR(NOW(), 'YYYY') || '-' ||
                  LPAD((SELECT COUNT(*) + 1 FROM public.invoices)::TEXT, 6, '0');

  -- Create invoice
  INSERT INTO public.invoices (
    invoice_no, order_id, buyer_id, due_date,
    subtotal_lkr, tax_amount_lkr, discount_lkr, total_amount_lkr,
    status, notes, created_by
  ) VALUES (
    v_invoice_no, v_order_id, v_winner.buyer_id,
    v_winner.payment_deadline_at::DATE,
    v_winner.total_award_amount, 0, 0, v_winner.total_award_amount,
    'issued',
    format('Auction Invoice: %s', v_auction.auction_number),
    p_awarded_by
  ) RETURNING id INTO v_invoice_id;

  -- Link order and invoice to winner record
  UPDATE public.auction_winners SET
    purchase_order_id = v_order_id,
    invoice_id        = v_invoice_id,
    payment_status    = 'pending',
    updated_at        = NOW()
  WHERE id = p_winner_id;

  -- Update lot status to awarded
  UPDATE public.auction_lots SET lot_status = 'awarded', updated_at = NOW()
  WHERE id = v_winner.auction_lot_id;

  -- Update auction status
  UPDATE public.auctions SET status = 'payment_pending', updated_at = NOW()
  WHERE id = v_winner.auction_id
    AND status IN ('awaiting_award', 'awarded');

  INSERT INTO public.auction_events (auction_id, auction_lot_id, event_type, event_data, actor_id)
  VALUES (
    v_winner.auction_id, v_winner.auction_lot_id, 'award_created',
    jsonb_build_object(
      'winner_id',    p_winner_id,
      'order_id',     v_order_id,
      'invoice_id',   v_invoice_id,
      'order_no',     v_order_no,
      'invoice_no',   v_invoice_no
    ),
    p_awarded_by
  );

  -- Audit log
  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, new_values)
  VALUES (p_awarded_by, 'AWARD', 'auction_winner', p_winner_id,
    jsonb_build_object('order_id', v_order_id, 'invoice_id', v_invoice_id));

  RETURN jsonb_build_object(
    'success',    TRUE,
    'order_id',   v_order_id,
    'order_no',   v_order_no,
    'invoice_id', v_invoice_id,
    'invoice_no', v_invoice_no
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- FUNCTION: offer_to_next_bidder
-- Cancel current award, find next eligible bidder, create new winner
-- ============================================================

CREATE OR REPLACE FUNCTION public.offer_to_next_bidder(
  p_lot_id     UUID,
  p_reason     TEXT,
  p_actor_id   UUID
)
RETURNS JSONB AS $$
DECLARE
  v_current_winner  RECORD;
  v_next_bid        RECORD;
  v_new_winner_id   UUID;
  v_auction         RECORD;
BEGIN
  -- Get current winner
  SELECT * INTO v_current_winner
  FROM public.auction_winners
  WHERE auction_lot_id = p_lot_id
    AND payment_status NOT IN ('paid')
  ORDER BY offer_round DESC LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'message', 'No active winner found for this lot');
  END IF;

  -- Mark current winner as defaulted
  UPDATE public.auction_winners
  SET payment_status = 'defaulted', updated_at = NOW()
  WHERE id = v_current_winner.id;

  -- Cancel associated order and invoice
  IF v_current_winner.purchase_order_id IS NOT NULL THEN
    UPDATE public.purchase_orders
    SET status = 'cancelled', cancel_reason = p_reason, cancelled_at = NOW()
    WHERE id = v_current_winner.purchase_order_id;

    -- Release stock reservation
    UPDATE public.stock_allocations
    SET status = 'returned'
    WHERE order_id = v_current_winner.purchase_order_id;

    -- Reverse reserved_qty on batch
    UPDATE public.inventory_batches ib
    SET reserved_qty_kg  = reserved_qty_kg  - sa.allocated_qty_kg,
        available_qty_kg = available_qty_kg + sa.allocated_qty_kg
    FROM public.stock_allocations sa
    WHERE sa.order_id = v_current_winner.purchase_order_id
      AND ib.id = sa.batch_id;
  END IF;

  IF v_current_winner.invoice_id IS NOT NULL THEN
    UPDATE public.invoices SET status = 'cancelled', updated_at = NOW()
    WHERE id = v_current_winner.invoice_id;
  END IF;

  -- Find next highest bidder (excluding the defaulted buyer)
  SELECT ab.* INTO v_next_bid
  FROM public.auction_bids ab
  WHERE ab.auction_lot_id = p_lot_id
    AND ab.buyer_id <> v_current_winner.buyer_id
    AND ab.status IN ('outbid', 'accepted')
  ORDER BY ab.bid_amount_per_unit DESC, ab.bid_time ASC
  LIMIT 1;

  IF NOT FOUND THEN
    -- No next bidder
    UPDATE public.auction_lots SET lot_status = 'cancelled', updated_at = NOW()
    WHERE id = p_lot_id;

    INSERT INTO public.auction_events (auction_id, auction_lot_id, event_type, event_data, actor_id)
    VALUES (v_current_winner.auction_id, p_lot_id, 'no_next_bidder',
      jsonb_build_object('reason', p_reason, 'defaulted_winner_id', v_current_winner.id),
      p_actor_id);

    RETURN jsonb_build_object('success', TRUE, 'next_winner', FALSE,
      'message', 'No eligible next bidder found. Lot marked cancelled.');
  END IF;

  SELECT * INTO v_auction FROM public.auctions WHERE id = v_current_winner.auction_id;

  -- Create new winner record
  v_new_winner_id := uuid_generate_v4();
  INSERT INTO public.auction_winners (
    id, auction_id, auction_lot_id, winning_bid_id, buyer_id,
    winning_price_per_unit, awarded_quantity, total_award_amount,
    payment_deadline_at, offer_round
  ) VALUES (
    v_new_winner_id, v_current_winner.auction_id, p_lot_id,
    v_next_bid.id, v_next_bid.buyer_id,
    v_next_bid.bid_amount_per_unit, v_current_winner.awarded_quantity,
    v_next_bid.bid_amount_per_unit * v_current_winner.awarded_quantity,
    NOW() + (v_auction.payment_deadline_hours || ' hours')::INTERVAL,
    v_current_winner.offer_round + 1
  );

  -- Notify next buyer
  INSERT INTO public.notifications (recipient_id, type, title, message, related_entity_type, related_entity_id)
  SELECT p.id, 'auction_next_bidder',
         'You have been offered an auction lot',
         format('The previous winner did not pay. You are now the next offer for this lot at LKR %s per unit. Please complete payment within %s hours.',
                v_next_bid.bid_amount_per_unit, v_auction.payment_deadline_hours),
         'auction_lot', p_lot_id
  FROM public.buyers b
  JOIN public.profiles p ON p.id = b.profile_id
  WHERE b.id = v_next_bid.buyer_id;

  INSERT INTO public.auction_events (auction_id, auction_lot_id, event_type, event_data, actor_id)
  VALUES (v_current_winner.auction_id, p_lot_id, 'offer_to_next',
    jsonb_build_object(
      'previous_winner_id', v_current_winner.id,
      'new_winner_id',      v_new_winner_id,
      'new_buyer_id',       v_next_bid.buyer_id,
      'reason',             p_reason
    ),
    p_actor_id);

  -- Audit log
  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, new_values)
  VALUES (p_actor_id, 'OFFER_TO_NEXT', 'auction_lot', p_lot_id,
    jsonb_build_object('new_winner_id', v_new_winner_id, 'reason', p_reason));

  RETURN jsonb_build_object(
    'success',       TRUE,
    'next_winner',   TRUE,
    'new_winner_id', v_new_winner_id,
    'buyer_id',      v_next_bid.buyer_id,
    'price',         v_next_bid.bid_amount_per_unit
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- FUNCTION: confirm_auction_payment
-- Records payment confirmation, triggers dispatch workflow
-- ============================================================

CREATE OR REPLACE FUNCTION public.confirm_auction_payment(
  p_winner_id       UUID,
  p_payment_ref     TEXT,
  p_payment_method  TEXT,
  p_amount_lkr      DECIMAL,
  p_actor_id        UUID
)
RETURNS JSONB AS $$
DECLARE
  v_winner RECORD;
BEGIN
  SELECT aw.*, a.collection_centre_id
  INTO v_winner
  FROM public.auction_winners aw
  JOIN public.auctions a ON a.id = aw.auction_id
  WHERE aw.id = p_winner_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'message', 'Winner record not found');
  END IF;

  IF v_winner.payment_status = 'paid' THEN
    RETURN jsonb_build_object('success', FALSE, 'message', 'Payment already confirmed');
  END IF;

  -- Update winner
  UPDATE public.auction_winners SET
    payment_status       = 'paid',
    payment_confirmed_at = NOW(),
    payment_confirmed_by = p_actor_id,
    updated_at           = NOW()
  WHERE id = p_winner_id;

  -- Update order status
  UPDATE public.purchase_orders SET status = 'paid', updated_at = NOW()
  WHERE id = v_winner.purchase_order_id;

  -- Update invoice status
  UPDATE public.invoices SET status = 'paid', updated_at = NOW()
  WHERE id = v_winner.invoice_id;

  -- Record external payment reference
  INSERT INTO public.buyer_deposits (
    buyer_id, auction_winner_id, payment_provider, provider_reference,
    provider_status, amount_lkr, recorded_by, verified_by, verified_at,
    payment_completed_at
  ) VALUES (
    v_winner.buyer_id, p_winner_id, p_payment_method, p_payment_ref,
    'completed', p_amount_lkr, p_actor_id, p_actor_id, NOW(), NOW()
  );

  -- Update auction status → stock_allocated
  UPDATE public.auctions SET status = 'paid', updated_at = NOW()
  WHERE id = v_winner.auction_id AND status = 'payment_pending';

  -- Notify winning buyer
  INSERT INTO public.notifications (recipient_id, type, title, message, related_entity_type, related_entity_id)
  SELECT p.id, 'auction_payment_confirmed',
         'Payment Confirmed',
         format('Your payment of LKR %s for the auction lot has been confirmed. Dispatch will begin shortly.', p_amount_lkr),
         'auction', v_winner.auction_id
  FROM public.buyers b
  JOIN public.profiles p ON p.id = b.profile_id
  WHERE b.id = v_winner.buyer_id;

  INSERT INTO public.auction_events (auction_id, auction_lot_id, event_type, event_data, actor_id)
  VALUES (v_winner.auction_id, v_winner.auction_lot_id, 'payment_confirmed',
    jsonb_build_object(
      'amount_lkr',     p_amount_lkr,
      'payment_method', p_payment_method,
      'payment_ref',    p_payment_ref
    ),
    p_actor_id);

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, new_values)
  VALUES (p_actor_id, 'PAYMENT_CONFIRMED', 'auction_winner', p_winner_id,
    jsonb_build_object('amount_lkr', p_amount_lkr, 'payment_ref', p_payment_ref));

  RETURN jsonb_build_object('success', TRUE, 'payment_status', 'paid');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- FUNCTION: calculate_farmer_settlement
-- Calculates settlement for the farmer after auction is paid
-- ============================================================

CREATE OR REPLACE FUNCTION public.calculate_farmer_settlement(
  p_auction_id   UUID,
  p_lot_id       UUID,
  p_calculator   UUID
)
RETURNS JSONB AS $$
DECLARE
  v_lot             RECORD;
  v_winner          RECORD;
  v_service_charge  DECIMAL;
  v_charge_pct      DECIMAL;
  v_gross           DECIMAL;
  v_net             DECIMAL;
  v_settlement_id   UUID;
BEGIN
  SELECT al.*, ib.farmer_id INTO v_lot
  FROM public.auction_lots al
  JOIN public.inventory_batches ib ON ib.id = al.inventory_batch_id
  WHERE al.id = p_lot_id AND al.auction_id = p_auction_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'message', 'Lot not found');
  END IF;

  SELECT * INTO v_winner
  FROM public.auction_winners
  WHERE auction_lot_id = p_lot_id AND payment_status = 'paid'
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'message', 'No confirmed payment found for this lot');
  END IF;

  -- Get service charge rate from system settings
  SELECT value::DECIMAL / 100 INTO v_charge_pct
  FROM public.system_settings WHERE key = 'auction_service_charge_pct';
  v_charge_pct := COALESCE(v_charge_pct, 0.02);  -- default 2%

  v_gross          := v_winner.winning_price_per_unit * v_lot.lot_quantity;
  v_service_charge := ROUND(v_gross * v_charge_pct, 2);
  v_net            := v_gross - v_service_charge;

  -- Upsert settlement record
  INSERT INTO public.auction_settlements (
    auction_id, auction_lot_id, farmer_id,
    winning_price_per_unit, awarded_quantity, gross_amount_lkr,
    service_charge_pct, service_charge_lkr, other_deductions_lkr, net_amount_lkr,
    status, calculated_by, calculated_at
  ) VALUES (
    p_auction_id, p_lot_id, v_lot.farmer_id,
    v_winner.winning_price_per_unit, v_lot.lot_quantity, v_gross,
    v_charge_pct, v_service_charge, 0, v_net,
    'calculated', p_calculator, NOW()
  )
  ON CONFLICT (auction_lot_id, farmer_id) DO UPDATE SET
    gross_amount_lkr    = EXCLUDED.gross_amount_lkr,
    service_charge_pct  = EXCLUDED.service_charge_pct,
    service_charge_lkr  = EXCLUDED.service_charge_lkr,
    net_amount_lkr      = EXCLUDED.net_amount_lkr,
    status              = 'calculated',
    calculated_by       = EXCLUDED.calculated_by,
    calculated_at       = EXCLUDED.calculated_at,
    updated_at          = NOW()
  RETURNING id INTO v_settlement_id;

  -- Notify farmer
  INSERT INTO public.notifications (recipient_id, type, title, message, related_entity_type, related_entity_id)
  SELECT p.id, 'auction_settlement',
         'Auction Settlement Calculated',
         format('Your settlement for the auction has been calculated: LKR %s (after %s%% service charge).',
                v_net, v_charge_pct * 100),
         'auction_settlement', v_settlement_id
  FROM public.farmers f
  JOIN public.profiles p ON p.id = f.profile_id
  WHERE f.id = v_lot.farmer_id;

  INSERT INTO public.auction_events (auction_id, auction_lot_id, event_type, event_data, actor_id)
  VALUES (p_auction_id, p_lot_id, 'settlement_generated',
    jsonb_build_object(
      'settlement_id',    v_settlement_id,
      'gross_amount',     v_gross,
      'service_charge',   v_service_charge,
      'net_amount',       v_net
    ),
    p_calculator);

  RETURN jsonb_build_object(
    'success',          TRUE,
    'settlement_id',    v_settlement_id,
    'gross_amount_lkr', v_gross,
    'service_charge_lkr', v_service_charge,
    'net_amount_lkr',   v_net,
    'service_charge_pct', v_charge_pct * 100
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- FUNCTION: Auction status change → notifications
-- ============================================================

CREATE OR REPLACE FUNCTION public.notify_auction_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    -- Record event
    INSERT INTO public.auction_events (auction_id, event_type, event_data)
    VALUES (NEW.id, 'status_change',
      jsonb_build_object('from', OLD.status, 'to', NEW.status));

    -- Notify watchlist when auction opens
    IF NEW.status = 'open' THEN
      INSERT INTO public.notifications (recipient_id, type, title, message, related_entity_type, related_entity_id)
      SELECT b_p.id, 'auction_opening_soon',
             'Auction Now Open',
             format('"%s" is now open for bidding. Starting price: LKR %s per unit.',
                    NEW.title, NEW.starting_price),
             'auction', NEW.id
      FROM public.auction_watchlists aw
      JOIN public.buyers b ON b.id = aw.buyer_id
      JOIN public.profiles b_p ON b_p.id = b.profile_id
      WHERE aw.auction_id = NEW.id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_notify_auction_status
  AFTER UPDATE OF status ON public.auctions
  FOR EACH ROW EXECUTE FUNCTION public.notify_auction_status_change();

-- ============================================================
-- AUDIT TRIGGERS on auction tables
-- ============================================================

CREATE TRIGGER audit_auctions
  AFTER INSERT OR UPDATE OR DELETE ON public.auctions
  FOR EACH ROW EXECUTE FUNCTION public.create_audit_log();

CREATE TRIGGER audit_auction_winners
  AFTER INSERT OR UPDATE OR DELETE ON public.auction_winners
  FOR EACH ROW EXECUTE FUNCTION public.create_audit_log();

CREATE TRIGGER audit_auction_disputes
  AFTER INSERT OR UPDATE OR DELETE ON public.auction_disputes
  FOR EACH ROW EXECUTE FUNCTION public.create_audit_log();

CREATE TRIGGER audit_auction_settlements
  AFTER INSERT OR UPDATE OR DELETE ON public.auction_settlements
  FOR EACH ROW EXECUTE FUNCTION public.create_audit_log();

CREATE TRIGGER audit_buyer_credit_limits
  AFTER INSERT OR UPDATE OR DELETE ON public.buyer_credit_limits
  FOR EACH ROW EXECUTE FUNCTION public.create_audit_log();

-- NOTE: auction_bids are NOT audited via trigger because they are immutable.
-- They serve as their own audit trail.

-- ============================================================
-- VIEW: v_auction_summary (for marketplace listing)
-- Returns no raw buyer PII; winning bidder info is anonymous
-- ============================================================

CREATE OR REPLACE VIEW public.v_auction_summary AS
SELECT
  a.id,
  a.auction_number,
  a.title,
  a.title_sinhala,
  a.title_tamil,
  a.description,
  a.status,
  a.auction_type,
  a.start_at,
  a.end_at,
  a.currency,
  a.starting_price,
  a.reserve_price IS NOT NULL AS has_reserve,
  a.minimum_increment,
  a.auto_extension_enabled,
  a.extension_minutes,
  a.payment_deadline_hours,
  cc.name             AS centre_name,
  cc.district         AS centre_district,
  -- Aggregate lot info
  (SELECT COUNT(*) FROM public.auction_lots al WHERE al.auction_id = a.id) AS total_lots,
  (SELECT COUNT(*) FROM public.auction_lots al WHERE al.auction_id = a.id AND al.lot_status = 'open') AS open_lots,
  -- Total bid count
  (SELECT COUNT(*) FROM public.auction_bids ab WHERE ab.auction_id = a.id AND ab.status IN ('accepted','winning','outbid')) AS total_bids,
  a.created_at,
  a.updated_at
FROM public.auctions a
JOIN public.collection_centres cc ON cc.id = a.collection_centre_id;

-- ============================================================
-- VIEW: v_lot_with_current_bid (for auction detail page)
-- Does NOT expose winning buyer identity to other buyers
-- ============================================================

CREATE OR REPLACE VIEW public.v_lot_with_current_bid AS
SELECT
  al.id,
  al.auction_id,
  al.lot_number,
  al.inventory_batch_id,
  al.crop_category_id,
  al.crop_variety_id,
  al.quality_grade,
  al.lot_quantity,
  al.unit,
  al.starting_price_per_unit,
  al.reserve_price_per_unit IS NOT NULL AS has_reserve,
  al.current_price_per_unit,
  al.warehouse_id,
  al.expiry_date,
  al.harvest_season,
  al.farming_method,
  al.origin_district,
  al.lot_status,
  -- Winning bid info (no buyer identity)
  al.winning_price_per_unit,
  al.total_winning_amount,
  -- Bid count for this lot
  (SELECT COUNT(*) FROM public.auction_bids ab
   WHERE ab.auction_lot_id = al.id AND ab.status IN ('accepted','winning','outbid')) AS bid_count,
  -- Crop names
  cc.name  AS crop_category_name,
  cc.name_sinhala AS crop_category_sinhala,
  cc.name_tamil   AS crop_category_tamil,
  cv.name  AS crop_variety_name,
  -- Warehouse
  w.name   AS warehouse_name,
  al.created_at,
  al.updated_at
FROM public.auction_lots al
JOIN public.crop_categories cc ON cc.id = al.crop_category_id
LEFT JOIN public.crop_varieties cv ON cv.id = al.crop_variety_id
LEFT JOIN public.warehouses w ON w.id = al.warehouse_id;

-- ============================================================
-- GRANT SELECT on views to authenticated
-- ============================================================

GRANT SELECT ON public.v_auction_summary TO authenticated;
GRANT SELECT ON public.v_lot_with_current_bid TO authenticated;
