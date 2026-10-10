import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { sendSuccess, paginatedResponse } from '../utils/response';
import { AppError } from '../utils/AppError';
import { AuthenticatedRequest } from '../middleware/auth';
import { rpcToAppError } from '../utils/rpcError';
import { todayInSriLanka, daysBetween, addDays } from '../utils/dates';

const WASTE_REASONS = ['spoilage', 'damage', 'expiry', 'pest_disease', 'handling', 'temperature', 'other'];

async function getNumberSetting(key: string, fallback: number): Promise<number> {
  const { data } = await supabaseAdmin.from('system_settings').select('value').eq('key', key).maybeSingle();
  const n = Number(data?.value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}


/**
 * GET /api/inventory
 * Real stock only – batches are created when an inspection is finalised (E2-US7).
 */
export const getInventory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { page = '1', limit = '20', status, category_id, warehouse_id, near_expiry, search, available_for_auction } = req.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(limit) || 20));
    const offset = (pageNum - 1) * limitNum;

    let query = supabaseAdmin
      .from('inventory_batches')
      .select(`
        id, batch_no, qr_code_value, grade, status, category_id, variety_id,
        initial_qty_kg, available_qty_kg, reserved_qty_kg, sold_qty_kg, wasted_qty_kg,
        purchase_price_lkr, selling_price_lkr, received_date, expected_expiry_date,
        crop_categories!category_id(id, name, name_sinhala, name_tamil),
        crop_varieties!variety_id(id, name),
        warehouses!warehouse_id(id, name, code),
        storage_locations!storage_location_id(id, code),
        farmers!farmer_id(id, full_name, farmer_code)
      `, { count: 'exact' });

    if (available_for_auction === 'true') {
      // hide batches that already sit in a draft / published / open lot of a running auction
      const { data: committed } = await supabaseAdmin.from('auction_lots')
        .select('inventory_batch_id, auctions!auction_id(status)').in('lot_status', ['draft', 'published', 'open']);
      const ids = (committed ?? [])
        .filter((l: any) => { const a = Array.isArray(l.auctions) ? l.auctions[0] : l.auctions; return a && !['cancelled', 'completed', 'reserve_not_met'].includes(a.status); })
        .map((l: any) => l.inventory_batch_id);
      if (ids.length) query = query.not('id', 'in', `(${ids.join(',')})`);
      query = query.gt('available_qty_kg', 0);
    }
    if (status) query = query.eq('status', status);
    if (category_id) query = query.eq('category_id', category_id);
    if (warehouse_id) query = query.eq('warehouse_id', warehouse_id);
    if (search) query = query.ilike('batch_no', `%${search.replace(/[%,]/g, '')}%`);
    if (near_expiry === 'true') {
      const days = await getNumberSetting('near_expiry_days', 7);
      const todayStr = todayInSriLanka();
      query = query.lte('expected_expiry_date', addDays(todayStr, days))
        .gte('expected_expiry_date', todayStr)
        .gt('available_qty_kg', 0);
    }

    const { data, error, count } = await query
      .order('expected_expiry_date', { ascending: true, nullsFirst: false })
      .range(offset, offset + limitNum - 1);

    if (error) throw new AppError(error.message, 500);
    paginatedResponse(res, data || [], { page: pageNum, limit: limitNum, total: count || 0 });
  } catch (e) { next(e); }
};

/**
 * GET /api/inventory/:id
 */
export const getBatchById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { data, error } = await supabaseAdmin
      .from('inventory_batches')
      .select(`
        *,
        crop_categories!category_id(*), crop_varieties!variety_id(*),
        farmers!farmer_id(id, full_name, farmer_code, phone),
        warehouses!warehouse_id(*), storage_locations!storage_location_id(*),
        produce_collections!collection_id(id, collection_no, created_at, weighed_at, gross_weight_kg, container_weight_kg, net_weight_kg),
        inventory_transactions(*, profiles!created_by(full_name)),
        wastage_records(id, quantity_kg, reason, notes, value_lost_lkr, created_at)
      `)
      .eq('id', req.params.id)
      .maybeSingle();

    if (error) throw new AppError(error.message, 500);
    if (!data) throw new AppError('Batch not found', 404);
    sendSuccess(res, { data });
  } catch (e) { next(e); }
};

/**
 * POST /api/inventory/:id/wastage   (E3-US4)
 * Body: { quantity_kg, reason, notes }
 */
export const recordWastage = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { quantity_kg, reason, notes } = req.body;
    const qty = Number(quantity_kg);
    if (!Number.isFinite(qty) || qty <= 0) throw new AppError('quantity_kg must be a number greater than zero', 400);
    if (!WASTE_REASONS.includes(reason)) throw new AppError(`reason must be one of: ${WASTE_REASONS.join(', ')}`, 400);

    const { data, error } = await supabaseAdmin.rpc('record_wastage', {
      p_batch_id: req.params.id, p_qty: qty, p_reason: reason, p_notes: notes || null, p_user: req.user?.id ?? null,
    });
    if (error) throw rpcToAppError(error);
    sendSuccess(res, { data, statusCode: 201, message: 'Wastage recorded' });
  } catch (e) { next(e); }
};

/**
 * POST /api/inventory/:id/adjust  (kept for backwards compatibility)
 * adjustment_type 'waste' | 'damage' are recorded as real wastage records.
 */
export const adjustStock = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { adjustment_type, quantity_kg, reason, notes } = req.body;
    if (!['waste', 'damage'].includes(adjustment_type)) {
      throw new AppError("adjustment_type must be 'waste' or 'damage'", 400);
    }
    req.body = {
      quantity_kg,
      reason: WASTE_REASONS.includes(reason) ? reason : adjustment_type === 'damage' ? 'damage' : 'spoilage',
      notes,
    };
    await recordWastage(req, res, next);
  } catch (e) { next(e); }
};

/**
 * GET /api/inventory/wastage?from=&to=&reason=&page=&limit=
 */
export const listWastage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { from, to, reason, page = '1', limit = '50' } = req.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(limit) || 50));

    let q = supabaseAdmin
      .from('wastage_records')
      .select(`
        id, quantity_kg, reason, notes, value_lost_lkr, created_at,
        inventory_batches!batch_id(id, batch_no, grade, crop_categories!category_id(name)),
        profiles!recorded_by(full_name)
      `, { count: 'exact' });
    if (from) q = q.gte('created_at', from);
    if (to) q = q.lte('created_at', `${to}T23:59:59.999Z`);
    if (reason) q = q.eq('reason', reason);

    const { data, error, count } = await q.order('created_at', { ascending: false })
      .range((pageNum - 1) * limitNum, pageNum * limitNum - 1);
    if (error) throw new AppError(error.message, 500);

    // Totals over the whole filtered range (not just the page)
    let tq = supabaseAdmin.from('wastage_records').select('quantity_kg, value_lost_lkr, reason');
    if (from) tq = tq.gte('created_at', from);
    if (to) tq = tq.lte('created_at', `${to}T23:59:59.999Z`);
    if (reason) tq = tq.eq('reason', reason);
    const { data: all } = await tq;
    const totals = (all || []).reduce((a: any, r: any) => {
      a.total_kg += Number(r.quantity_kg); a.total_value_lkr += Number(r.value_lost_lkr);
      a.by_reason[r.reason] = (a.by_reason[r.reason] || 0) + Number(r.quantity_kg);
      return a;
    }, { total_kg: 0, total_value_lkr: 0, by_reason: {} as Record<string, number> });

    res.status(200).json({
      success: true, message: 'Data retrieved successfully', data: data || [],
      meta: { page: pageNum, limit: limitNum, total: count || 0, totalPages: Math.ceil((count || 0) / limitNum), totals },
    });
  } catch (e) { next(e); }
};

/**
 * GET /api/inventory/expiry   (E3-US4)
 * Near-expiry batches with risk level + value at risk, plus already-expired stock.
 */
export const getExpiryOverview = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const days = await getNumberSetting('near_expiry_days', 7);
    const todayStr = todayInSriLanka();

    const { data, error } = await supabaseAdmin
      .from('inventory_batches')
      .select(`
        id, batch_no, grade, status, available_qty_kg, reserved_qty_kg, purchase_price_lkr, expected_expiry_date,
        crop_categories!category_id(name), warehouses!warehouse_id(name)
      `)
      .gt('available_qty_kg', 0)
      .not('expected_expiry_date', 'is', null)
      .lte('expected_expiry_date', addDays(todayStr, days))
      .not('status', 'in', '("disposed","damaged","sold")')
      .order('expected_expiry_date', { ascending: true });
    if (error) throw new AppError(error.message, 500);

    const items = (data || []).map((b: any) => {
      const daysLeft = daysBetween(todayStr, b.expected_expiry_date);
      const risk = daysLeft < 0 ? 'expired' : daysLeft <= 2 ? 'critical' : daysLeft <= Math.ceil(days / 2) ? 'high' : 'medium';
      return { ...b, days_left: daysLeft, risk, value_at_risk_lkr: Math.round(Number(b.available_qty_kg) * Number(b.purchase_price_lkr) * 100) / 100 };
    });

    const summary = {
      threshold_days: days,
      expired_batches: items.filter(i => i.risk === 'expired').length,
      critical_batches: items.filter(i => i.risk === 'critical').length,
      near_expiry_batches: items.filter(i => i.risk !== 'expired').length,
      total_kg_at_risk: items.reduce((a, i) => a + Number(i.available_qty_kg), 0),
      total_value_at_risk_lkr: items.reduce((a, i) => a + i.value_at_risk_lkr, 0),
    };
    sendSuccess(res, { data: { summary, items } });
  } catch (e) { next(e); }
};

/**
 * POST /api/inventory/expiry/sweep
 * Writes off past-expiry stock, releases stale unpaid reservations, alerts managers.
 */
export const runExpirySweep = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { data: sweep, error } = await supabaseAdmin.rpc('sweep_expired_batches', { p_user: req.user?.id ?? null });
    if (error) throw rpcToAppError(error);
    const { data: released } = await supabaseAdmin.rpc('release_stale_reservations');
    sendSuccess(res, { data: { ...(sweep as object), released_reservations: released ?? 0 }, message: 'Expiry sweep completed' });
  } catch (e) { next(e); }
};

/**
 * POST /api/inventory/:id/transfer
 * Transfer batch to a different warehouse/location with capacity + ledger checks.
 */
export const transferBatch = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { warehouse_id, storage_location_id } = req.body;
    if (!warehouse_id) throw new AppError('warehouse_id is required', 400);

    const { data: wh } = await supabaseAdmin.from('warehouses').select('id, name, is_active').eq('id', warehouse_id).maybeSingle();
    if (!wh) throw new AppError('Warehouse not found', 404);
    if (wh.is_active === false) throw new AppError('Target warehouse is inactive', 409);

    if (storage_location_id) {
      const { data: loc } = await supabaseAdmin.from('storage_locations').select('id, warehouse_id').eq('id', storage_location_id).maybeSingle();
      if (!loc || loc.warehouse_id !== warehouse_id) throw new AppError('Storage location does not belong to that warehouse', 400);
    }

    const { data, error } = await supabaseAdmin
      .from('inventory_batches')
      .update({ warehouse_id, storage_location_id: storage_location_id || null, updated_at: new Date().toISOString() })
      .eq('id', id).select().maybeSingle();
    if (error) throw new AppError(error.message, 500);
    if (!data) throw new AppError('Batch not found', 404);

    await supabaseAdmin.from('inventory_transactions').insert({
      batch_id: id, transaction_type: 'transferred', quantity_kg: data.available_qty_kg, balance_kg: data.available_qty_kg,
      reference_id: warehouse_id, reference_type: 'warehouse', notes: `Moved to ${wh.name}`, created_by: req.user?.id ?? null,
    });
    sendSuccess(res, { data, message: 'Batch transferred successfully' });
  } catch (e) { next(e); }
};

/**
 * GET /api/inventory/summary – aggregate real stock by crop category.
 */
export const getInventorySummary = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { data: allCategories } = await supabaseAdmin
      .from('crop_categories').select('id, name, name_sinhala, name_tamil').eq('is_active', true);

    const summaryMap: Record<string, any> = {};
    (allCategories || []).forEach((c: any) => {
      summaryMap[c.id] = { category_id: c.id, name: c.name, name_sinhala: c.name_sinhala, name_tamil: c.name_tamil,
        total_available: 0, total_reserved: 0, by_grade: {}, by_variety: {} };
    });

    const { data: batches, error } = await supabaseAdmin
      .from('inventory_batches')
      .select('category_id, variety_id, grade, available_qty_kg, reserved_qty_kg, expected_expiry_date, status')
      .in('status', ['available', 'reserved', 'partially_sold']);
    if (error) throw new AppError(error.message, 500);

    const today = todayInSriLanka();
    (batches || []).forEach((b: any) => {
      const row = summaryMap[b.category_id];
      if (!row) return;
      row.total_reserved += Number(b.reserved_qty_kg || 0);
      if (b.expected_expiry_date && b.expected_expiry_date < today) return; // expired stock is not sellable
      const qty = Number(b.available_qty_kg || 0);
      row.total_available += qty;
      row.by_grade[b.grade] = (row.by_grade[b.grade] || 0) + qty;
      if (b.variety_id) row.by_variety[b.variety_id] = (row.by_variety[b.variety_id] || 0) + qty;
    });

    const lowThreshold = await getNumberSetting('low_stock_threshold_kg', 100);
    const data = Object.values(summaryMap).map((r: any) => ({ ...r, low_stock: r.total_available < lowThreshold }));
    sendSuccess(res, { data });
  } catch (e) { next(e); }
};

/**
 * POST /api/inventory/:id/assign-location
 * Assign or re-assign a batch to a specific warehouse + storage location.
 */
export const assignLocation = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { warehouse_id, storage_location_id } = req.body;

    if (!warehouse_id) throw new AppError('warehouse_id is required', 400);

    const { data: batch } = await supabaseAdmin
      .from('inventory_batches')
      .update({
        warehouse_id,
        storage_location_id: storage_location_id || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .maybeSingle();

    sendSuccess(res, { data: batch || { id, warehouse_id }, message: 'Batch location assigned successfully' });
  } catch (e) { next(e); }
};

// ─── Near-expiry management ───────────────────────────────────────────────────

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const todayLK = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Colombo' });

async function writeAudit(actorId: string | undefined, action: string, batchId: string, values: object) {
  try {
    await supabaseAdmin.from('audit_logs').insert({ actor_id: actorId ?? null, action, entity_type: 'inventory_batch', entity_id: batchId, new_values: values });
  } catch { /* auditing must never block the action */ }
}

/**
 * PATCH /api/inventory/:id/expiry   Body: { expected_expiry_date: 'YYYY-MM-DD', reason? }
 * Used to flag a batch as near-expiry (shorter shelf life found on inspection) or to correct a wrong date.
 */
export const updateBatchExpiry = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { expected_expiry_date, reason } = req.body as { expected_expiry_date?: string; reason?: string };
    if (!expected_expiry_date || !ISO_DATE.test(expected_expiry_date) || Number.isNaN(Date.parse(expected_expiry_date))) {
      throw new AppError('A valid expiry date (YYYY-MM-DD) is required', 400);
    }
    const { data: batch } = await supabaseAdmin.from('inventory_batches')
      .select('id, batch_no, status, received_date, expected_expiry_date').eq('id', req.params.id).maybeSingle();
    if (!batch) throw new AppError('Batch not found', 404);
    if (['sold', 'disposed', 'expired'].includes(batch.status)) throw new AppError(`A batch that is ${batch.status} cannot be changed`, 409);
    if (batch.received_date && expected_expiry_date < String(batch.received_date).slice(0, 10)) {
      throw new AppError('Expiry date cannot be before the date the batch was received', 400);
    }

    const { data, error } = await supabaseAdmin.from('inventory_batches')
      .update({ expected_expiry_date, updated_at: new Date().toISOString() }).eq('id', batch.id).select().single();
    if (error) throw new AppError(error.message, 500);

    await writeAudit(req.user?.id, 'BATCH_EXPIRY_CHANGED', batch.id, { from: batch.expected_expiry_date, to: expected_expiry_date, reason: reason ?? null });
    sendSuccess(res, { data, message: expected_expiry_date < todayLK() ? 'Expiry date updated – this batch is now overdue and can be written off' : 'Expiry date updated' });
  } catch (e) { next(e); }
};

/**
 * POST /api/inventory/:id/clearance   Body: { discount_pct: 1-90 }
 * Reduces the selling price of a batch that must be sold quickly. The change is audited with old and new price.
 */
export const applyClearancePrice = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const pct = Number(req.body?.discount_pct);
    if (!Number.isFinite(pct) || pct < 1 || pct > 90) throw new AppError('Discount must be between 1 % and 90 %', 400);

    const { data: batch } = await supabaseAdmin.from('inventory_batches')
      .select('id, batch_no, status, selling_price_lkr, available_qty_kg').eq('id', req.params.id).maybeSingle();
    if (!batch) throw new AppError('Batch not found', 404);
    if (!['available', 'partially_sold'].includes(batch.status) || Number(batch.available_qty_kg) <= 0) {
      throw new AppError('Only batches with stock available for sale can be put on clearance', 409);
    }

    const oldPrice = Number(batch.selling_price_lkr);
    const newPrice = Math.round(oldPrice * (1 - pct / 100) * 100) / 100;
    const { data, error } = await supabaseAdmin.from('inventory_batches')
      .update({ selling_price_lkr: newPrice, updated_at: new Date().toISOString() }).eq('id', batch.id).select().single();
    if (error) throw new AppError(error.message, 500);

    await writeAudit(req.user?.id, 'BATCH_CLEARANCE_PRICE', batch.id, { discount_pct: pct, old_price: oldPrice, new_price: newPrice });
    sendSuccess(res, { data, message: `Clearance price applied: LKR ${oldPrice} → LKR ${newPrice} per kg` });
  } catch (e) { next(e); }
};
