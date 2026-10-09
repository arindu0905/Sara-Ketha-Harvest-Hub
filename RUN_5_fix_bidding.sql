-- Migration 028: make bidding work
--
-- 1. The rule "bids are immutable" blocked EVERY update of auction_bids, but placing a bid has to change bid
--    statuses (previous leader -> 'outbid', new bid -> 'winning'; closing an auction -> 'rejected').
--    Result: every bid failed with "Auction bids are immutable records. They cannot be updated or deleted."
--    The rule now protects what matters (who bid, how much, how many, when, in which order) and still forbids
--    deleting a bid; only the status / rejection reason may change.
-- 2. place_auction_bid: the anti-sniping "auction extended" notification used buyers.id where a profile id is needed.
--
-- Safe to re-run.

CREATE OR REPLACE FUNCTION public.prevent_bid_mutation()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Auction bids are immutable records and cannot be deleted. Bid ID: %', OLD.id;
  END IF;

  IF NEW.auction_id          IS DISTINCT FROM OLD.auction_id
     OR NEW.auction_lot_id   IS DISTINCT FROM OLD.auction_lot_id
     OR NEW.buyer_id         IS DISTINCT FROM OLD.buyer_id
     OR NEW.bid_amount_per_unit IS DISTINCT FROM OLD.bid_amount_per_unit
     OR NEW.bid_quantity     IS DISTINCT FROM OLD.bid_quantity
     OR NEW.bid_sequence     IS DISTINCT FROM OLD.bid_sequence
     OR NEW.bid_time         IS DISTINCT FROM OLD.bid_time THEN
    RAISE EXCEPTION 'The amount, quantity, bidder and time of a bid cannot be changed. Bid ID: %', OLD.id;
  END IF;

  RETURN NEW;   -- only status / rejection_reason changes get here
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_bids_no_update ON public.auction_bids;
CREATE TRIGGER trg_bids_no_update
  BEFORE UPDATE ON public.auction_bids
  FOR EACH ROW EXECUTE FUNCTION public.prevent_bid_mutation();

DROP TRIGGER IF EXISTS trg_bids_no_delete ON public.auction_bids;
CREATE TRIGGER trg_bids_no_delete
  BEFORE DELETE ON public.auction_bids
  FOR EACH ROW EXECUTE FUNCTION public.prevent_bid_mutation();

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
      SELECT p.id,  -- the recipient is the buyer's PROFILE id (aw.buyer_id is a buyers.id and violates the FK)
             'auction_extended'::notification_type,
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

NOTIFY pgrst, 'reload schema';
