import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { supabaseAdmin } from '../config/supabase';
import { AppError } from '../utils/AppError';
import { sendSuccess } from '../utils/response';
import crypto from 'crypto';
import {
  CreateAuctionSchema,
  UpdateAuctionSchema,
  CreateLotSchema,
  UpdateLotSchema,
  PlaceBidSchema,
  ConfirmPaymentSchema,
  PaymentDefaultSchema,
  SubmitDisputeSchema,
  ResolveDisputeSchema,
  CreditLimitSchema,
  CancelAuctionSchema,
  AuctionListQuerySchema,
} from '../schemas/auctionSchemas';

// ─── Helper: write an audit log entry ────────────────────────────────────────

async function auditLog(
  actorId: string,
  action: string,
  entityType: string,
  entityId: string | undefined,
  data?: object
) {
  await supabaseAdmin.from('audit_logs').insert({
    actor_id:    actorId,
    action,
    entity_type: entityType,
    entity_id:   entityId,
    new_values:  data ?? null,
  });
}

// ─── Helper: hash IP address for privacy ─────────────────────────────────────

function hashIp(ip: string): string {
  return crypto.createHash('sha256').update(ip + process.env.IP_SALT || 'hh-salt').digest('hex');
}

// ─── Helper: get buyer_id for authenticated buyer ─────────────────────────────

async function getBuyerIdForUser(userId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from('buyers')
    .select('id')
    .eq('profile_id', userId)
    .single();
  return data?.id ?? null;
}

// ─── Helper: get farmer_id for authenticated farmer ───────────────────────────

async function getFarmerIdForUser(userId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from('farmers')
    .select('id')
    .eq('profile_id', userId)
    .single();
  return data?.id ?? null;
}

// ============================================================
// PUBLIC / BUYER CONTROLLERS
// ============================================================

/**
 * GET /api/auctions
 * List auctions – paginated, filterable. Hides draft auctions unless manager/admin.
 */
export const listAuctions = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const query = AuctionListQuerySchema.parse(req.query);
    const isStaff = req.user && ['inventory_manager', 'administrator', 'finance_officer'].includes(req.user.role);

    let dbQuery = supabaseAdmin
      .from('v_auction_summary')
      .select('*')
      .order('start_at', { ascending: false })
      .range((query.page - 1) * query.limit, query.page * query.limit - 1);

    // Non-staff: exclude drafts
    if (!isStaff) {
      dbQuery = dbQuery.neq('status', 'draft');
    }
    if (query.status)    dbQuery = dbQuery.eq('status', query.status);
    if (query.centre_id) dbQuery = dbQuery.eq('collection_centre_id', query.centre_id);

    const { data, error, count } = await dbQuery;
    if (error) throw new AppError(error.message, 500);

    sendSuccess(res, {
      data: data ?? [],
      meta: { page: query.page, limit: query.limit, total: count ?? 0 },
    });
  } catch (e) { next(e); }
};

/**
 * GET /api/auctions/:id
 * Single auction with lots (masks winning buyer identity).
 */
export const getAuction = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { data: auction, error } = await supabaseAdmin
      .from('auctions')
      .select(`
        *,
        collection_centres!collection_centre_id(id, name, district, address, phone),
        auction_lots(
          id, lot_number, lot_status, quality_grade, lot_quantity, unit,
          starting_price_per_unit, current_price_per_unit, expiry_date,
          harvest_season, farming_method, origin_district,
          winning_price_per_unit, total_winning_amount,
          crop_categories!crop_category_id(name, name_sinhala, name_tamil),
          crop_varieties!crop_variety_id(name),
          warehouses!warehouse_id(name, code),
          auction_lot_images(id, storage_path, file_name, sort_order)
        )
      `)
      .eq('id', req.params.id)
      .single();

    if (error || !auction) throw new AppError('Auction not found', 404);

    // Non-staff cannot see draft auctions
    const isStaff = req.user && ['inventory_manager', 'administrator', 'finance_officer', 'collection_centre_officer'].includes(req.user.role);
    if (auction.status === 'draft' && !isStaff) {
      throw new AppError('Auction not found', 404);
    }

    // Strip sensitive winner identity for non-staff (winning_buyer_id is not returned in v_lot view)
    sendSuccess(res, { data: auction });
  } catch (e) { next(e); }
};

/**
 * GET /api/auctions/:id/bids
 * Bid history. Buyers see only their own bids.
 * Staff see all bids but still with masked buyer display name.
 */
export const getAuctionBids = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const isStaff = req.user && ['inventory_manager', 'administrator', 'finance_officer'].includes(req.user.role);
    const buyerId = req.user?.role === 'buyer' ? await getBuyerIdForUser(req.user.id) : null;

    let dbQuery = supabaseAdmin
      .from('auction_bids')
      .select('id, bid_amount_per_unit, bid_quantity, total_bid_amount, bid_sequence, bid_time, status')
      .eq('auction_id', req.params.id)
      .order('bid_sequence', { ascending: false });

    if (!isStaff && buyerId) {
      dbQuery = dbQuery.eq('buyer_id', buyerId);
    }

    const { data, error } = await dbQuery;
    if (error) throw new AppError(error.message, 500);

    sendSuccess(res, { data: data ?? [] });
  } catch (e) { next(e); }
};

/**
 * POST /api/auctions/:auctionId/lots/:lotId/bids
 * Place a bid – calls atomic DB function.
 */
export const placeBid = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const body = PlaceBidSchema.parse(req.body);

    if (!req.user) throw new AppError('Authentication required', 401);
    if (req.user.role !== 'buyer') throw new AppError('Only buyers can place bids', 403);

    const buyerId = await getBuyerIdForUser(req.user.id);
    if (!buyerId) throw new AppError('Buyer account not found', 403);

    const ipHash = hashIp(req.ip ?? 'unknown');

    const { data, error } = await supabaseAdmin.rpc('place_auction_bid', {
      p_auction_id:           req.params.auctionId,
      p_lot_id:               req.params.lotId,
      p_buyer_id:             buyerId,
      p_bid_amount_per_unit:  body.bid_amount_per_unit,
      p_bid_quantity:         body.bid_quantity,
      p_ip_hash:              ipHash,
      p_device_ref:           body.device_reference
        ? crypto.createHash('sha256').update(body.device_reference).digest('hex')
        : null,
    });

    if (error) throw new AppError(error.message, 500);

    const result = data as {
      success: boolean;
      code?: string;
      message?: string;
      bid_id?: string;
      bid_sequence?: number;
      minimum_bid?: number;
    };

    if (!result.success) {
      const statusMap: Record<string, number> = {
        AUCTION_NOT_OPEN: 409,
        LOT_NOT_OPEN:     409,
        AUCTION_ENDED:    409,
        BATCH_EXPIRED:    422,
        BID_TOO_LOW:      422,
        BUYER_NOT_VERIFIED: 403,
        BUYER_SUSPENDED:  403,
        CREDIT_LIMIT_EXCEEDED: 422,
        INSUFFICIENT_QUANTITY: 422,
        LOT_NOT_FOUND:    404,
        BUYER_NOT_FOUND:  404,
      };
      const status = statusMap[result.code ?? ''] ?? 400;
      throw new AppError(result.message ?? 'Bid could not be placed', status);
    }

    // Audit (no PII – just bid ID)
    await auditLog(req.user.id, 'BID_PLACED', 'auction_bid', result.bid_id, {
      auction_id: req.params.auctionId,
      lot_id:     req.params.lotId,
      bid_id:     result.bid_id,
    });

    sendSuccess(res, { data: result, statusCode: 201, message: 'Bid placed successfully' });
  } catch (e) { next(e); }
};

/**
 * GET /api/auctions/my-bids  (buyer)
 */
export const getMyBids = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Authentication required', 401);
    const buyerId = await getBuyerIdForUser(req.user.id);
    if (!buyerId) throw new AppError('Buyer account not found', 403);

    const { data, error } = await supabaseAdmin
      .from('auction_bids')
      .select(`
        id, bid_amount_per_unit, bid_quantity, total_bid_amount, bid_sequence, bid_time, status,
        auctions!auction_id(id, auction_number, title, status, end_at),
        auction_lots!auction_lot_id(id, lot_number, quality_grade, lot_status, current_price_per_unit)
      `)
      .eq('buyer_id', buyerId)
      .order('bid_time', { ascending: false });

    if (error) throw new AppError(error.message, 500);
    sendSuccess(res, { data: data ?? [] });
  } catch (e) { next(e); }
};

/**
 * GET /api/auctions/won  (buyer)
 */
export const getWonAuctions = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Authentication required', 401);
    const buyerId = await getBuyerIdForUser(req.user.id);
    if (!buyerId) throw new AppError('Buyer account not found', 403);

    const { data, error } = await supabaseAdmin
      .from('auction_winners')
      .select(`
        *,
        auctions!auction_id(id, auction_number, title, status, end_at),
        auction_lots!auction_lot_id(id, lot_number, quality_grade, lot_quantity, unit),
        invoices!invoice_id(id, invoice_no, status, due_date, total_amount_lkr),
        purchase_orders!purchase_order_id(id, order_no, status)
      `)
      .eq('buyer_id', buyerId)
      .order('awarded_at', { ascending: false });

    if (error) throw new AppError(error.message, 500);
    sendSuccess(res, { data: data ?? [] });
  } catch (e) { next(e); }
};

// ─── Watchlist ────────────────────────────────────────────────────────────────

export const addToWatchlist = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Authentication required', 401);
    const buyerId = await getBuyerIdForUser(req.user.id);
    if (!buyerId) throw new AppError('Buyer account not found', 403);

    const { error } = await supabaseAdmin.from('auction_watchlists').upsert({
      auction_id: req.params.id,
      buyer_id:   buyerId,
    }, { onConflict: 'auction_id,buyer_id' });

    if (error) throw new AppError(error.message, 500);
    sendSuccess(res, { message: 'Added to watchlist', statusCode: 201 });
  } catch (e) { next(e); }
};

export const removeFromWatchlist = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Authentication required', 401);
    const buyerId = await getBuyerIdForUser(req.user.id);
    if (!buyerId) throw new AppError('Buyer account not found', 403);

    const { error } = await supabaseAdmin.from('auction_watchlists')
      .delete()
      .eq('auction_id', req.params.id)
      .eq('buyer_id', buyerId);

    if (error) throw new AppError(error.message, 500);
    sendSuccess(res, { message: 'Removed from watchlist' });
  } catch (e) { next(e); }
};

export const getWatchlist = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Authentication required', 401);
    const buyerId = await getBuyerIdForUser(req.user.id);
    if (!buyerId) throw new AppError('Buyer account not found', 403);

    const { data, error } = await supabaseAdmin
      .from('auction_watchlists')
      .select('*, auctions!auction_id(id, auction_number, title, status, start_at, end_at, starting_price)')
      .eq('buyer_id', buyerId);

    if (error) throw new AppError(error.message, 500);
    sendSuccess(res, { data: data ?? [] });
  } catch (e) { next(e); }
};

// ============================================================
// INVENTORY MANAGER CONTROLLERS
// ============================================================

export const createAuction = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Authentication required', 401);
    const body = CreateAuctionSchema.parse(req.body);

    // Generate auction number
    const { data: auctionNo } = await supabaseAdmin.rpc('generate_auction_number');

    const { data, error } = await supabaseAdmin
      .from('auctions')
      .insert({
        ...body,
        auction_number:  auctionNo ?? `AUC-${Date.now()}`,
        original_end_at: body.end_at,
        status:          'draft',
        created_by:      req.user.id,
        updated_by:      req.user.id,
      })
      .select()
      .single();

    if (error) throw new AppError(error.message, 500);

    await auditLog(req.user.id, 'CREATE', 'auction', data.id, { auction_number: data.auction_number });
    sendSuccess(res, { data, statusCode: 201, message: 'Auction created as draft' });
  } catch (e) { next(e); }
};

export const updateAuction = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) throw new AppError('Authentication required', 401);
    const body = UpdateAuctionSchema.parse(req.body);

    // Prevent editing after bidding has started
    const { data: existing } = await supabaseAdmin
      .from('auctions')
      .select('status')
      .eq('id', req.params.id)
      .single();

    if (!existing) throw new AppError('Auction not found', 404);
    if (!['draft', 'scheduled'].includes(existing.status)) {
      // Only title/description can change after open
      const { title, description, title_sinhala, title_tamil,
              description_sinhala, description_tamil } = body;
      const safeUpdate = { title, description, title_sinhala, title_tamil,
                           description_sinhala, description_tamil };
      const { data, error: updateErr } = await supabaseAdmin
        .from('auctions')
        .update({ ...safeUpdate, updated_by: req.user.id })
        .eq('id', req.params.id)
        .select()
        .single();
      if (updateErr) throw new AppError(updateErr.message, 500);
      sendSuccess(res, { data, message: 'Auction metadata updated' });
      return;
    }

    const { data, error } = await supabaseAdmin
      .from('auctions')
      .update({ ...body, updated_by: req.user.id })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw new AppError(error.message, 500);
    await auditLog(req.user.id, 'UPDATE', 'auction', req.params.id, body);
    sendSuccess(res, { data, message: 'Auction updated' });
  } catch (e) { next(e); }
};

// ─── Lots ─────────────────────────────────────────────────────────────────────

export const createLot = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Authentication required', 401);
    const body = CreateLotSchema.parse({ ...req.body, auction_id: req.params.id });

    // Assign lot number
    const { count } = await supabaseAdmin
      .from('auction_lots')
      .select('*', { count: 'exact', head: true })
      .eq('auction_id', req.params.id);

    const { data, error } = await supabaseAdmin
      .from('auction_lots')
      .insert({
        ...body,
        lot_number:          (count ?? 0) + 1,
        current_price_per_unit: body.starting_price_per_unit,
        lot_status:          'draft',
        created_by:          req.user.id,
      })
      .select()
      .single();

    if (error) throw new AppError(error.message, 500);
    await auditLog(req.user.id, 'CREATE_LOT', 'auction_lot', data.id);
    sendSuccess(res, { data, statusCode: 201, message: 'Lot added to auction' });
  } catch (e) { next(e); }
};

export const updateLot = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Authentication required', 401);
    const body = UpdateLotSchema.parse(req.body);

    const { data, error } = await supabaseAdmin
      .from('auction_lots')
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq('id', req.params.lotId)
      .eq('auction_id', req.params.id)
      .select()
      .single();

    if (error) throw new AppError(error.message, 500); // DB trigger will reject if bidding started
    await auditLog(req.user.id, 'UPDATE_LOT', 'auction_lot', req.params.lotId, body);
    sendSuccess(res, { data, message: 'Lot updated' });
  } catch (e) { next(e); }
};

export const deleteLot = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Authentication required', 401);

    // Only deletable in draft
    const { data: lot } = await supabaseAdmin
      .from('auction_lots')
      .select('lot_status')
      .eq('id', req.params.lotId)
      .single();

    if (!lot || lot.lot_status !== 'draft') {
      throw new AppError('Only draft lots can be removed', 409);
    }

    const { error } = await supabaseAdmin
      .from('auction_lots')
      .delete()
      .eq('id', req.params.lotId)
      .eq('auction_id', req.params.id);

    if (error) throw new AppError(error.message, 500);
    sendSuccess(res, { message: 'Lot removed' });
  } catch (e) { next(e); }
};

// ============================================================
// WORKFLOW CONTROLLERS (Approval / Status Changes)
// ============================================================

/** Generic auction status transition */
async function transitionAuction(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
  targetStatus: string,
  allowedFrom: string[],
  extraFields?: object
) {
  try {
    if (!req.user) throw new AppError('Authentication required', 401);

    const { data: current } = await supabaseAdmin
      .from('auctions')
      .select('status')
      .eq('id', req.params.id)
      .single();

    if (!current) throw new AppError('Auction not found', 404);
    if (!allowedFrom.includes(current.status)) {
      throw new AppError(
        `Cannot transition to '${targetStatus}' from '${current.status}'`, 409
      );
    }

    const { data, error } = await supabaseAdmin
      .from('auctions')
      .update({
        status:     targetStatus,
        updated_by: req.user.id,
        updated_at: new Date().toISOString(),
        ...extraFields,
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw new AppError(error.message, 500);

    await auditLog(req.user.id, `AUCTION_${targetStatus.toUpperCase()}`, 'auction', req.params.id, {
      from: current.status,
      to:   targetStatus,
    });

    sendSuccess(res, { data, message: `Auction ${targetStatus}` });
  } catch (e) { next(e); }
}

export const submitAuction = (req: AuthenticatedRequest, res: Response, next: NextFunction) =>
  transitionAuction(req, res, next, 'scheduled', ['draft'], {
    submitted_by: req.user?.id,
    submitted_at: new Date().toISOString(),
  });

export const approveAuction = (req: AuthenticatedRequest, res: Response, next: NextFunction) =>
  transitionAuction(req, res, next, 'scheduled', ['draft', 'scheduled'], {
    approved_by: req.user?.id,
    approved_at: new Date().toISOString(),
  });

export const publishAuction = (req: AuthenticatedRequest, res: Response, next: NextFunction) =>
  transitionAuction(req, res, next, 'scheduled', ['draft', 'scheduled']);

export const openAuction = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  // When opening, also set all lots to 'open'
  try {
    if (!req.user) throw new AppError('Authentication required', 401);

    const { data: auction } = await supabaseAdmin.from('auctions')
      .select('status').eq('id', req.params.id).single();
    if (!auction) throw new AppError('Auction not found', 404);
    if (!['scheduled', 'paused'].includes(auction.status)) {
      throw new AppError(`Cannot open from status: ${auction.status}`, 409);
    }

    await supabaseAdmin.from('auctions')
      .update({ status: 'open', updated_by: req.user.id })
      .eq('id', req.params.id);

    await supabaseAdmin.from('auction_lots')
      .update({ lot_status: 'open' })
      .eq('auction_id', req.params.id)
      .in('lot_status', ['draft', 'published']);

    await auditLog(req.user.id, 'AUCTION_OPEN', 'auction', req.params.id);
    sendSuccess(res, { message: 'Auction is now open for bidding' });
  } catch (e) { next(e); }
};

export const pauseAuction = (req: AuthenticatedRequest, res: Response, next: NextFunction) =>
  transitionAuction(req, res, next, 'paused', ['open']);

export const resumeAuction = (req: AuthenticatedRequest, res: Response, next: NextFunction) =>
  transitionAuction(req, res, next, 'open', ['paused']);

export const closeAuction = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Authentication required', 401);
    const { data, error } = await supabaseAdmin.rpc('close_auction', { p_auction_id: req.params.id });
    if (error) throw new AppError(error.message, 500);
    await auditLog(req.user.id, 'AUCTION_CLOSE', 'auction', req.params.id, data);
    sendSuccess(res, { data, message: 'Auction closed' });
  } catch (e) { next(e); }
};

export const cancelAuction = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Authentication required', 401);
    const body = CancelAuctionSchema.parse(req.body);

    const { data, error } = await supabaseAdmin
      .from('auctions')
      .update({
        status:              'cancelled',
        cancellation_reason: body.cancellation_reason,
        cancelled_by:        req.user.id,
        cancelled_at:        new Date().toISOString(),
        updated_by:          req.user.id,
      })
      .eq('id', req.params.id)
      .not('status', 'in', '("completed","delivered","paid")')
      .select()
      .single();

    if (error) throw new AppError(error.message, 500);
    if (!data) throw new AppError('Auction not found or cannot be cancelled', 409);

    await auditLog(req.user.id, 'AUCTION_CANCEL', 'auction', req.params.id, body);
    sendSuccess(res, { data, message: 'Auction cancelled' });
  } catch (e) { next(e); }
};

// ─── Award ────────────────────────────────────────────────────────────────────

export const awardLot = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Authentication required', 401);

    // Find winner record for this lot
    const { data: winner } = await supabaseAdmin
      .from('auction_winners')
      .select('id')
      .eq('auction_lot_id', req.params.lotId)
      .eq('payment_status', 'pending')
      .order('offer_round', { ascending: false })
      .limit(1)
      .single();

    if (!winner) throw new AppError('No pending winner found for this lot', 404);

    const { data, error } = await supabaseAdmin.rpc('award_auction_lot', {
      p_winner_id:  winner.id,
      p_awarded_by: req.user.id,
    });

    if (error) throw new AppError(error.message, 500);
    const result = data as { success: boolean; message?: string };
    if (!result.success) throw new AppError(result.message ?? 'Award failed', 500);

    sendSuccess(res, { data, message: 'Lot awarded and invoice generated' });
  } catch (e) { next(e); }
};

export const offerToNextBidder = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Authentication required', 401);
    const { reason } = req.body;
    if (!reason || reason.length < 10) {
      throw new AppError('A reason of at least 10 characters is required', 422);
    }

    const { data, error } = await supabaseAdmin.rpc('offer_to_next_bidder', {
      p_lot_id:   req.params.lotId,
      p_reason:   reason,
      p_actor_id: req.user.id,
    });

    if (error) throw new AppError(error.message, 500);
    sendSuccess(res, { data, message: 'Lot offered to next bidder' });
  } catch (e) { next(e); }
};

// ─── Payment ──────────────────────────────────────────────────────────────────

export const confirmPayment = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Authentication required', 401);
    const body = ConfirmPaymentSchema.parse(req.body);

    const { data, error } = await supabaseAdmin.rpc('confirm_auction_payment', {
      p_winner_id:      body.winner_id,
      p_payment_ref:    body.payment_ref,
      p_payment_method: body.payment_method,
      p_amount_lkr:     body.amount_lkr,
      p_actor_id:       req.user.id,
    });

    if (error) throw new AppError(error.message, 500);
    const result = data as { success: boolean; message?: string };
    if (!result.success) throw new AppError(result.message ?? 'Payment confirmation failed', 500);

    sendSuccess(res, { data, message: 'Payment confirmed successfully' });
  } catch (e) { next(e); }
};

export const markPaymentDefault = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Authentication required', 401);
    const body = PaymentDefaultSchema.parse(req.body);

    // Mark as defaulted
    const { data, error } = await supabaseAdmin
      .from('auction_winners')
      .update({ payment_status: 'defaulted', updated_at: new Date().toISOString() })
      .eq('id', body.winner_id)
      .eq('payment_status', 'pending')
      .select()
      .single();

    if (error || !data) throw new AppError('Winner record not found or already resolved', 404);

    await supabaseAdmin.from('auction_events').insert({
      auction_id:     data.auction_id,
      auction_lot_id: data.auction_lot_id,
      event_type:     'payment_default',
      event_data:     { winner_id: body.winner_id, reason: body.reason },
      actor_id:       req.user.id,
    });

    await auditLog(req.user.id, 'PAYMENT_DEFAULT', 'auction_winner', body.winner_id, { reason: body.reason });
    sendSuccess(res, { data, message: 'Payment marked as defaulted' });
  } catch (e) { next(e); }
};

// ─── Farmer Settlement ────────────────────────────────────────────────────────

export const getMyProduceAuctions = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Authentication required', 401);
    const farmerId = await getFarmerIdForUser(req.user.id);
    if (!farmerId) throw new AppError('Farmer account not found', 403);

    const { data, error } = await supabaseAdmin
      .from('auction_lots')
      .select(`
        id, lot_number, lot_status, quality_grade, lot_quantity, unit,
        winning_price_per_unit, total_winning_amount,
        auctions!auction_id(id, auction_number, title, status, start_at, end_at),
        auction_settlements(status, net_amount_lkr, payment_date)
      `)
      .eq('inventory_batches.farmer_id', farmerId)
      .order('created_at', { ascending: false });

    if (error) throw new AppError(error.message, 500);
    sendSuccess(res, { data: data ?? [] });
  } catch (e) { next(e); }
};

export const getFarmerSettlement = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Authentication required', 401);

    const { data, error } = await supabaseAdmin
      .from('auction_settlements')
      .select(`
        *,
        auctions!auction_id(id, auction_number, title, end_at),
        auction_lots!auction_lot_id(
          id, lot_number, lot_quantity, unit, quality_grade,
          crop_categories!crop_category_id(name)
        )
      `)
      .eq('id', req.params.settlementId)
      .single();

    if (error || !data) throw new AppError('Settlement not found', 404);
    sendSuccess(res, { data });
  } catch (e) { next(e); }
};

export const calculateSettlement = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Authentication required', 401);
    const { auction_id, lot_id } = req.body;
    if (!auction_id || !lot_id) throw new AppError('auction_id and lot_id are required', 422);

    const { data, error } = await supabaseAdmin.rpc('calculate_farmer_settlement', {
      p_auction_id: auction_id,
      p_lot_id:     lot_id,
      p_calculator: req.user.id,
    });

    if (error) throw new AppError(error.message, 500);
    const result = data as { success: boolean; message?: string };
    if (!result.success) throw new AppError(result.message ?? 'Settlement calculation failed', 500);

    sendSuccess(res, { data, message: 'Settlement calculated' });
  } catch (e) { next(e); }
};

// ─── Disputes ─────────────────────────────────────────────────────────────────

export const submitDispute = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Authentication required', 401);
    const body = SubmitDisputeSchema.parse(req.body);

    const { data, error } = await supabaseAdmin
      .from('auction_disputes')
      .insert({ ...body, submitted_by: req.user.id, status: 'submitted' })
      .select()
      .single();

    if (error) throw new AppError(error.message, 500);

    await supabaseAdmin.from('auction_events').insert({
      auction_id:     body.auction_id,
      auction_lot_id: body.auction_lot_id,
      event_type:     'dispute_submitted',
      event_data:     { dispute_id: data.id, type: body.dispute_type },
      actor_id:       req.user.id,
    });

    await auditLog(req.user.id, 'DISPUTE_SUBMITTED', 'auction_dispute', data.id);
    sendSuccess(res, { data, statusCode: 201, message: 'Dispute submitted' });
  } catch (e) { next(e); }
};

export const resolveDispute = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Authentication required', 401);
    const body = ResolveDisputeSchema.parse(req.body);

    const { data, error } = await supabaseAdmin
      .from('auction_disputes')
      .update({
        status:      body.status,
        resolution:  body.resolution,
        resolved_by: req.user.id,
        resolved_at: body.status === 'resolved' ? new Date().toISOString() : null,
        updated_at:  new Date().toISOString(),
      })
      .eq('id', req.params.disputeId)
      .select()
      .single();

    if (error) throw new AppError(error.message, 500);
    await auditLog(req.user.id, 'DISPUTE_RESOLVED', 'auction_dispute', req.params.disputeId, body);
    sendSuccess(res, { data, message: `Dispute ${body.status}` });
  } catch (e) { next(e); }
};

export const getAllDisputes = async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('auction_disputes')
      .select(`
        *,
        auctions!auction_id(auction_number, title),
        profiles!submitted_by(full_name, email)
      `)
      .order('created_at', { ascending: false });

    if (error) throw new AppError(error.message, 500);
    sendSuccess(res, { data: data ?? [] });
  } catch (e) { next(e); }
};

// ─── Credit Limits ────────────────────────────────────────────────────────────

export const getCreditLimits = async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('buyer_credit_limits')
      .select('*, buyers!buyer_id(buyer_code, company_name, verification_status)')
      .order('credit_limit_lkr', { ascending: false });

    if (error) throw new AppError(error.message, 500);
    sendSuccess(res, { data: data ?? [] });
  } catch (e) { next(e); }
};

export const setCreditLimit = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Authentication required', 401);
    const body = CreditLimitSchema.parse(req.body);

    const { data, error } = await supabaseAdmin
      .from('buyer_credit_limits')
      .upsert({
        buyer_id:         req.params.buyerId,
        credit_limit_lkr: body.credit_limit_lkr,
        notes:            body.notes,
        set_by:           req.user.id,
        updated_at:       new Date().toISOString(),
      }, { onConflict: 'buyer_id' })
      .select()
      .single();

    if (error) throw new AppError(error.message, 500);
    await auditLog(req.user.id, 'SET_CREDIT_LIMIT', 'buyer_credit_limit', data.id, body);
    sendSuccess(res, { data, message: 'Credit limit updated' });
  } catch (e) { next(e); }
};

// ─── Auction Reports ──────────────────────────────────────────────────────────

export const getAuctionReports = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { from, to } = req.query as { from?: string; to?: string };
    const fromDate = from ?? new Date(Date.now() - 30 * 86400000).toISOString();
    const toDate   = to   ?? new Date().toISOString();

    // Total auctions
    const { count: totalAuctions } = await supabaseAdmin
      .from('auctions')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', fromDate).lte('created_at', toDate);

    // Successful auctions (have at least one winner)
    const { count: successful } = await supabaseAdmin
      .from('auction_winners')
      .select('auction_id', { count: 'exact', head: true })
      .eq('payment_status', 'paid')
      .gte('awarded_at', fromDate).lte('awarded_at', toDate);

    // Total revenue
    const { data: revenueData } = await supabaseAdmin
      .from('auction_winners')
      .select('total_award_amount')
      .eq('payment_status', 'paid')
      .gte('payment_confirmed_at', fromDate).lte('payment_confirmed_at', toDate);

    const totalRevenue = (revenueData ?? []).reduce((sum, r) => sum + (r.total_award_amount ?? 0), 0);

    // Average bids per auction
    const { count: totalBids } = await supabaseAdmin
      .from('auction_bids')
      .select('*', { count: 'exact', head: true })
      .gte('bid_time', fromDate).lte('bid_time', toDate);

    // Default rate
    const { count: defaults } = await supabaseAdmin
      .from('auction_winners')
      .select('*', { count: 'exact', head: true })
      .eq('payment_status', 'defaulted')
      .gte('awarded_at', fromDate).lte('awarded_at', toDate);

    sendSuccess(res, {
      data: {
        period: { from: fromDate, to: toDate },
        total_auctions:         totalAuctions ?? 0,
        successful_auctions:    successful ?? 0,
        success_rate_pct:       totalAuctions ? Math.round(((successful ?? 0) / totalAuctions) * 100) : 0,
        total_revenue_lkr:      totalRevenue,
        total_bids:             totalBids ?? 0,
        avg_bids_per_auction:   totalAuctions ? Math.round((totalBids ?? 0) / totalAuctions) : 0,
        payment_defaults:       defaults ?? 0,
        default_rate_pct:       successful ? Math.round(((defaults ?? 0) / (successful ?? 1)) * 100) : 0,
      },
    });
  } catch (e) { next(e); }
};

// ─── Centre-specific auction lists (Inventory Manager) ───────────────────────

export const getCentreAuctions = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Authentication required', 401);

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('assigned_centre')
      .eq('id', req.user.id)
      .single();

    const centreId = profile?.assigned_centre;

    let dbQuery = supabaseAdmin
      .from('auctions')
      .select(`
        *,
        auction_lots(id, lot_status, lot_quantity, current_price_per_unit)
      `)
      .order('created_at', { ascending: false });

    if (centreId) {
      dbQuery = dbQuery.eq('collection_centre_id', centreId);
    }

    if (req.query.status) {
      dbQuery = dbQuery.eq('status', req.query.status as string);
    }

    const { data, error } = await dbQuery;
    if (error) throw new AppError(error.message, 500);
    sendSuccess(res, { data: data ?? [] });
  } catch (e) { next(e); }
};

// ─── Auction Audit Events ─────────────────────────────────────────────────────

export const getAuctionEvents = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('auction_events')
      .select('*')
      .eq('auction_id', req.params.id)
      .order('created_at', { ascending: true });

    if (error) throw new AppError(error.message, 500);
    sendSuccess(res, { data: data ?? [] });
  } catch (e) { next(e); }
};

export const getAuctionAuditLogs = async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('audit_logs')
      .select('*')
      .in('entity_type', ['auction', 'auction_lot', 'auction_bid', 'auction_winner',
                          'auction_dispute', 'auction_settlement', 'buyer_credit_limit'])
      .order('created_at', { ascending: false })
      .limit(500);

    if (error) throw new AppError(error.message, 500);
    sendSuccess(res, { data: data ?? [] });
  } catch (e) { next(e); }
};

// ─── Buyer eligibility ────────────────────────────────────────────────────────

export const getBuyerEligibility = async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('buyers')
      .select(`
        id, buyer_code, company_name, verification_status, account_status,
        buyer_type, credit_limit_lkr,
        buyer_credit_limits(credit_limit_lkr, utilised_lkr, available_lkr)
      `)
      .order('company_name');

    if (error) throw new AppError(error.message, 500);
    sendSuccess(res, { data: data ?? [] });
  } catch (e) { next(e); }
};

// ─── Auction invoice ──────────────────────────────────────────────────────────

export const getAuctionInvoice = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Authentication required', 401);
    const buyerId = req.user.role === 'buyer' ? await getBuyerIdForUser(req.user.id) : null;

    const { data: winner, error } = await supabaseAdmin
      .from('auction_winners')
      .select(`
        *,
        invoices!invoice_id(*,
          invoice_items(*),
          buyers!buyer_id(company_name, address, district, contact_person)
        ),
        auctions!auction_id(auction_number, title, collection_centre_id,
          collection_centres!collection_centre_id(name, address, phone)),
        auction_lots!auction_lot_id(
          lot_number, quality_grade, lot_quantity, unit,
          crop_categories!crop_category_id(name)
        )
      `)
      .eq('auction_id', req.params.id)
      .eq('auction_lot_id', req.params.lotId)
      .order('offer_round', { ascending: false })
      .limit(1)
      .single();

    if (error || !winner) throw new AppError('Invoice not found', 404);

    // Buyer can only see their own invoice
    if (buyerId && winner.buyer_id !== buyerId) {
      throw new AppError('Access denied', 403);
    }

    sendSuccess(res, { data: winner });
  } catch (e) { next(e); }
};
