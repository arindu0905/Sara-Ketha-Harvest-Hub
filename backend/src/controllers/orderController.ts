import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { sendSuccess, paginatedResponse } from '../utils/response';
import { AppError } from '../utils/AppError';
import { AuthenticatedRequest } from '../middleware/auth';

/**
 * POST /api/orders
 * Create a purchase order with items.
 */
export const createOrder = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { buyer_id, centre_id, requested_date, delivery_address, notes, items } = req.body;

    // Generate order number
    const { data: orderNo } = await supabaseAdmin.rpc('generate_order_no');

    const { data: order, error } = await supabaseAdmin
      .from('purchase_orders')
      .insert({
        order_no: orderNo || `ORD-${Date.now()}`,
        buyer_id,
        centre_id,
        requested_date,
        delivery_address,
        notes,
        status: 'submitted',
        created_by: req.user?.id,
      })
      .select()
      .single();

    if (error) throw new AppError(error.message, 500);

    // Insert order items
    const orderItems = items.map((item: { category_id: string; variety_id?: string; grade?: string; requested_qty_kg: number; unit_price_lkr?: number }) => ({
      order_id: order.id,
      category_id: item.category_id,
      variety_id: item.variety_id,
      grade: item.grade,
      requested_qty_kg: item.requested_qty_kg,
      unit_price_lkr: item.unit_price_lkr,
      total_price_lkr: item.unit_price_lkr ? item.requested_qty_kg * item.unit_price_lkr : null,
    }));

    await supabaseAdmin.from('purchase_order_items').insert(orderItems);

    sendSuccess(res, { data: order, statusCode: 201, message: 'Order submitted successfully' });
  } catch (e) { next(e); }
};

/**
 * GET /api/orders
 */
export const getOrders = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { page = '1', limit = '20', status, buyer_id, centre_id } = req.query as Record<string, string>;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;

    let query = supabaseAdmin
      .from('purchase_orders')
      .select(`
        id, order_no, status, total_amount_lkr, requested_date, created_at,
        buyers!buyer_id(id, company_name, buyer_code, contact_person),
        purchase_order_items(
          id, requested_qty_kg, unit_price_lkr,
          crop_categories!category_id(name)
        )
      `, { count: 'exact' });

    // If buyer role, restrict to their own orders
    if (req.user?.role === 'buyer') {
      const { data: buyerRecord } = await supabaseAdmin
        .from('buyers').select('id').eq('profile_id', req.user.id).single();
      if (buyerRecord) query = query.eq('buyer_id', buyerRecord.id);
    }

    if (status) query = query.eq('status', status);
    if (buyer_id) query = query.eq('buyer_id', buyer_id);
    if (centre_id) query = query.eq('centre_id', centre_id);

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limitNum - 1);

    if (error) throw new AppError(error.message, 500);
    paginatedResponse(res, data || [], { page: pageNum, limit: limitNum, total: count || 0 });
  } catch (e) { next(e); }
};

/**
 * GET /api/orders/:id
 */
export const getOrderById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { data, error } = await supabaseAdmin
      .from('purchase_orders')
      .select(`
        *,
        buyers!buyer_id(*, profiles!profile_id(email, avatar_url)),
        purchase_order_items(*, crop_categories!category_id(*), crop_varieties!variety_id(*)),
        stock_allocations(*, inventory_batches!batch_id(batch_no, grade, available_qty_kg)),
        invoices(id, invoice_no, status, total_amount_lkr, due_date),
        delivery_schedules(id, schedule_no, status, scheduled_date)
      `)
      .eq('id', req.params.id)
      .single();

    if (error || !data) throw new AppError('Order not found', 404);
    sendSuccess(res, { data });
  } catch (e) { next(e); }
};

/**
 * PATCH /api/orders/:id/status
 */
export const updateOrderStatus = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { status, notes, cancel_reason } = req.body;

    const updates: Record<string, unknown> = { status };
    if (cancel_reason) updates.cancel_reason = cancel_reason;
    if (status === 'cancelled') updates.cancelled_at = new Date().toISOString();
    if (status === 'approved') {
      updates.approved_by = req.user?.id;
      updates.approved_at = new Date().toISOString();
    }
    if (status === 'under_review') {
      updates.reviewed_by = req.user?.id;
      updates.reviewed_at = new Date().toISOString();
    }
    if (notes) updates.notes = notes;

    const { data, error } = await supabaseAdmin
      .from('purchase_orders')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new AppError(error.message, 500);
    sendSuccess(res, { data, message: `Order ${status}` });
  } catch (e) { next(e); }
};

/**
 * POST /api/orders/:id/allocate
 * FIFO allocation of stock to order items.
 */
export const allocateStock = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;

    const { data: order } = await supabaseAdmin
      .from('purchase_orders')
      .select('*, purchase_order_items(*, crop_categories!category_id(id))')
      .eq('id', id)
      .single();

    if (!order) throw new AppError('Order not found', 404);
    if (!['approved'].includes(order.status)) {
      throw new AppError('Order must be approved before stock allocation', 400);
    }

    const allocationResults = [];

    for (const item of order.purchase_order_items) {
      let remainingQty = item.requested_qty_kg;

      // FEFO: earliest expiry first, then FIFO
      const { data: batches } = await supabaseAdmin
        .from('inventory_batches')
        .select('id, available_qty_kg, expected_expiry_date')
        .eq('category_id', item.category_id)
        .eq('status', 'available')
        .gt('available_qty_kg', 0)
        .is('expected_expiry_date', 'not.null')
        .order('expected_expiry_date', { ascending: true });

      const { data: batchesNoExpiry } = await supabaseAdmin
        .from('inventory_batches')
        .select('id, available_qty_kg')
        .eq('category_id', item.category_id)
        .eq('status', 'available')
        .gt('available_qty_kg', 0)
        .is('expected_expiry_date', null)
        .order('received_date', { ascending: true });

      const allBatches = [...(batches || []), ...(batchesNoExpiry || [])];

      for (const batch of allBatches) {
        if (remainingQty <= 0) break;
        const allocQty = Math.min(remainingQty, batch.available_qty_kg);

        await supabaseAdmin.from('stock_allocations').insert({
          order_id: id,
          order_item_id: item.id,
          batch_id: batch.id,
          allocated_qty_kg: allocQty,
          allocated_by: req.user?.id,
        });

        allocationResults.push({ batch_id: batch.id, qty: allocQty });
        remainingQty -= allocQty;
      }

      if (remainingQty > 0) {
        throw new AppError(`Insufficient stock for ${item.category_id}: ${remainingQty}kg short`, 409);
      }
    }

    await supabaseAdmin
      .from('purchase_orders')
      .update({ status: 'stock_reserved' })
      .eq('id', id);

    sendSuccess(res, { data: allocationResults, message: 'Stock allocated successfully (FEFO)' });
  } catch (e) { next(e); }
};

/**
 * POST /api/orders/:id/cancel
 */
export const cancelOrder = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    // Release any reserved stock allocations
    const { data: allocations } = await supabaseAdmin
      .from('stock_allocations')
      .select('batch_id, allocated_qty_kg')
      .eq('order_id', id)
      .eq('status', 'reserved');

    if (allocations && allocations.length > 0) {
      await supabaseAdmin
        .from('stock_allocations')
        .update({ status: 'returned' })
        .eq('order_id', id);
    }

    await supabaseAdmin
      .from('stock_allocations')
      .update({ status: 'returned' })
      .eq('order_id', id);

    await supabaseAdmin
      .from('purchase_orders')
      .update({ status: 'cancelled', cancel_reason: reason, cancelled_at: new Date().toISOString() })
      .eq('id', id);

    sendSuccess(res, { message: 'Order cancelled and stock released' });
  } catch (e) { next(e); }
};
