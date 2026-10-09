import { Response, NextFunction } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { sendSuccess, paginatedResponse } from '../utils/response';
import { AppError } from '../utils/AppError';
import { AuthenticatedRequest } from '../middleware/auth';
import { rpcToAppError } from '../utils/rpcError';
import { notifyUser, notifyRole } from '../services/notify';

/**
 * POST /api/orders
 * Create a purchase order with items.
 */

const BUYER_CANCELLABLE = ['submitted', 'under_review', 'approved', 'stock_reserved', 'payment_pending'];
const ROLE_STATUS_RULES: Record<string, string[]> = {
  inventory_manager: ['under_review', 'approved', 'stock_reserved', 'rejected', 'preparing', 'dispatched', 'cancelled'],
  finance_officer: ['under_review', 'payment_pending', 'paid', 'rejected', 'cancelled'],
  manager: [],
};

/** Loads the order and enforces that buyers can only touch their own orders. */
async function loadOrderForUser(req: AuthenticatedRequest, orderId: string) {
  const { data: order } = await supabaseAdmin
    .from('purchase_orders')
    .select('id, status, order_no, buyer_id, created_by, buyers!buyer_id(profile_id)')
    .eq('id', orderId).maybeSingle();
  if (!order) throw new AppError('Order not found', 404);
  if (req.user?.role === 'buyer') {
    const b: any = Array.isArray((order as any).buyers) ? (order as any).buyers[0] : (order as any).buyers;
    const owns = b?.profile_id === req.user.id || (order as any).created_by === req.user.id;
    if (!owns) throw new AppError('You can only access your own orders', 403);
  }
  return order as any;
}

export const createOrder = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    let { buyer_id, centre_id, requested_date, delivery_address, notes, items } = req.body;

    // Resolve buyer_id if missing or if user is logged in as buyer
    if ((!buyer_id || req.user?.role === 'buyer') && req.user?.id) {
      const { data: existingBuyer } = await supabaseAdmin
        .from('buyers')
        .select('id')
        .eq('profile_id', req.user.id)
        .maybeSingle();

      if (existingBuyer) {
        buyer_id = existingBuyer.id;
      } else {
        // Auto-provision buyer record if missing for this profile
        const codeSuffix = req.user.id.replace(/-/g, '').substring(0, 8).toUpperCase();
        const { data: newBuyer, error: buyerErr } = await supabaseAdmin
          .from('buyers')
          .insert({
            profile_id: req.user.id,
            buyer_code: `BUY-${codeSuffix}`,
            company_name: req.user.email?.split('@')[0] || 'Buyer',
            contact_person: req.user.email?.split('@')[0] || null,
            email: req.user.email,
            phone: null,
            address: delivery_address || null,
            district: null,
            verification_status: 'verified',
            account_status: 'active',
          })
          .select('id')
          .single();

        if (buyerErr) {
          // If insert fails (e.g. duplicate key or constraint), try fetching again
          const { data: retryBuyer } = await supabaseAdmin
            .from('buyers')
            .select('id')
            .eq('profile_id', req.user.id)
            .maybeSingle();
          if (retryBuyer) buyer_id = retryBuyer.id;
        } else if (newBuyer) {
          buyer_id = newBuyer.id;
        }
      }
    }

    if (!buyer_id) {
      throw new AppError('Buyer record could not be found or created. Please contact support.', 400);
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new AppError('At least one crop item is required to place an order', 400);
    }

    for (const it of items) {
      const q = parseFloat(String(it?.requested_qty_kg));
      if (!it?.category_id || !Number.isFinite(q) || q <= 0) {
        throw new AppError('Each order item needs a crop category and a quantity greater than zero', 400);
      }
    }

    if (!centre_id) {
      throw new AppError('Preferred collection centre is required to place an order', 400);
    }

    if (!delivery_address || !String(delivery_address).trim()) {
      throw new AppError('Delivery address / destination is required to place an order', 400);
    }

    // Generate collision-proof unique order number
    let orderNo: string | null = null;
    try {
      const { data: rpcOrderNo } = await supabaseAdmin.rpc('generate_order_no');
      if (rpcOrderNo) {
        // Verify uniqueness against database
        const { data: existing } = await supabaseAdmin
          .from('purchase_orders')
          .select('id')
          .eq('order_no', rpcOrderNo)
          .maybeSingle();

        if (!existing) {
          orderNo = rpcOrderNo;
        }
      }
    } catch (_e) {
      // Fall through to JS generator fallback
    }

    const year = new Date().getFullYear();

    if (!orderNo) {
      // Fetch all existing order numbers for current year to calculate actual integer max sequence
      const { data: existingOrders } = await supabaseAdmin
        .from('purchase_orders')
        .select('order_no')
        .like('order_no', `ORD-${year}-%`);

      const existingSet = new Set((existingOrders || []).map((o: any) => o.order_no));
      let maxSeq = 0;
      (existingOrders || []).forEach((o: any) => {
        const match = o.order_no ? o.order_no.match(/ORD-\d{4}-(\d+)/) : null;
        if (match && match[1]) {
          const num = parseInt(match[1], 10);
          if (!isNaN(num) && num > maxSeq) maxSeq = num;
        }
      });

      let candidateSeq = maxSeq + 1;
      while (existingSet.has(`ORD-${year}-${String(candidateSeq).padStart(6, '0')}`)) {
        candidateSeq++;
      }
      orderNo = `ORD-${year}-${String(candidateSeq).padStart(6, '0')}`;
    }

    // Calculate total order amount
    let totalOrderAmount = 0;
    items.forEach((item: any) => {
      const qty = parseFloat(item.requested_qty_kg) || 0;
      const unitPrice = item.unit_price_lkr ? parseFloat(item.unit_price_lkr) : 0;
      if (qty > 0 && unitPrice > 0) {
        totalOrderAmount += qty * unitPrice;
      }
    });

    // Insert purchase order with retry mechanism against duplicate order_no key
    let order: any = null;
    let insertError: any = null;
    let attempts = 0;
    let currentOrderNo = orderNo;

    while (!order && attempts < 5) {
      attempts++;
      const { data: insertedOrder, error: err } = await supabaseAdmin
        .from('purchase_orders')
        .insert({
          order_no: currentOrderNo,
          buyer_id,
          centre_id: centre_id || null,
          requested_date: requested_date || null,
          delivery_address: delivery_address || null,
          notes: notes || null,
          total_amount_lkr: totalOrderAmount > 0 ? totalOrderAmount : null,
          status: 'submitted',
          created_by: req.user?.id,
        })
        .select()
        .single();

      if (!err && insertedOrder) {
        order = insertedOrder;
      } else if (err && (err.code === '23505' || err.message?.includes('duplicate key') || err.message?.includes('purchase_orders_order_no_key'))) {
        insertError = err;
        const randSuffix = Math.floor(1000 + Math.random() * 9000);
        currentOrderNo = `ORD-${year}-${Date.now().toString().slice(-6)}${randSuffix}`;
      } else {
        insertError = err;
        break;
      }
    }

    if (!order) throw new AppError(insertError?.message || 'Failed to create purchase order', 500);

    // Insert order items
    // Buyers never set the price: it is the centre's current selling price for that crop and grade.
    // (Administrators may still supply one explicitly.)
    const priceFor = async (item: { category_id: string; variety_id?: string; grade?: string; unit_price_lkr?: number | string }): Promise<number | null> => {
      if (req.user?.role !== 'buyer' && item.unit_price_lkr) return parseFloat(String(item.unit_price_lkr)) || null;
      // Use the grade the buyer asked for; if none was chosen (or that grade has no price) take the best available grade.
      const grades = [item.grade, 'grade_a', 'grade_b', 'grade_c'].filter((g, i, arr): g is string => !!g && arr.indexOf(g) === i);
      for (const grade of grades.length ? grades : [null]) {
        const { data: rows } = await supabaseAdmin.rpc('get_current_price', {
          p_category_id: item.category_id, p_grade: grade, p_centre_id: centre_id || null, p_variety_id: item.variety_id || null,
        });
        const p = Number(rows?.[0]?.selling_price);
        if (Number.isFinite(p) && p > 0) return p;
      }
      return null;
    };
    const itemPrices = await Promise.all(items.map((i: any) => priceFor(i)));

    const orderItems = items.map((item: { category_id: string; variety_id?: string; grade?: string; requested_qty_kg: number | string; unit_price_lkr?: number | string; notes?: string }, idx: number) => {
      const qty = parseFloat(String(item.requested_qty_kg)) || 0;
      const unitPrice = itemPrices[idx];
      return {
        order_id: order.id,
        category_id: item.category_id,
        variety_id: item.variety_id || null,
        grade: item.grade || null,
        requested_qty_kg: qty,
        unit_price_lkr: unitPrice,
        total_price_lkr: unitPrice ? qty * unitPrice : null,
        notes: item.notes || null,
      };
    });

    const { error: itemsError } = await supabaseAdmin.from('purchase_order_items').insert(orderItems);
    if (itemsError) throw new AppError(itemsError.message, 500);

    // Auto-create and save invoice in invoices and buyer_invoices database tables
    let invoiceNo = `INV-${Date.now()}`;
    try {
      const { data: genInvNo } = await supabaseAdmin.rpc('generate_invoice_no');
      if (genInvNo) invoiceNo = genInvNo;
    } catch (_e) {
      invoiceNo = `INV-2026-${Math.floor(100000 + Math.random() * 900000)}`;
    }

    const due = new Date(); due.setDate(due.getDate() + 30);
    const dueDateStr = due.toISOString().split('T')[0];

    try {
      await supabaseAdmin
        .from('invoices')
        .insert({
          invoice_no: invoiceNo,
          order_id: order.id,
          buyer_id,
          subtotal_lkr: totalOrderAmount,
          tax_amount_lkr: 0,
          discount_lkr: 0,
          total_amount_lkr: totalOrderAmount,
          due_date: dueDateStr,
          status: 'issued',
          notes: notes || null,
          created_by: req.user?.id || null,
        });

      await supabaseAdmin
        .from('buyer_invoices')
        .insert({
          invoice_no: invoiceNo,
          order_id: order.id,
          buyer_id,
          subtotal_lkr: totalOrderAmount,
          tax_amount_lkr: 0,
          discount_lkr: 0,
          total_amount_lkr: totalOrderAmount,
          due_date: dueDateStr,
          status: 'issued',
          notes: notes || null,
          created_by: req.user?.id || null,
        });
    } catch (_invErr) {
      // Non-blocking fallback if invoice triggers exist
    }

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
        id, order_no, status, total_amount_lkr, requested_date, delivery_address, notes, created_at,
        approved_at, reviewed_at,
        approver:profiles!approved_by(full_name, role), reviewer:profiles!reviewed_by(full_name, role),
        buyers!buyer_id(id, company_name, buyer_code, contact_person, phone, email),
        purchase_order_items(
          id, category_id, requested_qty_kg, unit_price_lkr, total_price_lkr, grade,
          crop_categories!category_id(id, name, name_sinhala, name_tamil)
        )
      `, { count: 'exact' });

    // If buyer role, restrict to their own orders (by buyer profile_id or created_by)
    if (req.user?.role === 'buyer') {
      const { data: buyerRecord } = await supabaseAdmin
        .from('buyers').select('id').eq('profile_id', req.user.id).maybeSingle();
      if (buyerRecord) {
        query = query.or(`buyer_id.eq.${buyerRecord.id},created_by.eq.${req.user.id}`);
      } else {
        query = query.eq('created_by', req.user.id);
      }
    } else if (buyer_id) {
      query = query.eq('buyer_id', buyer_id);
    }

    if (status && status !== 'all') query = query.eq('status', status);
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
export const getOrderById = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const orderId = req.params.id;
    await loadOrderForUser(req, orderId);

    // Direct query for order record with buyer
    const { data: order, error: orderError } = await supabaseAdmin
      .from('purchase_orders')
      .select('*, buyers(*)')
      .eq('id', orderId)
      .maybeSingle();

    if (orderError || !order) {
      throw new AppError('Order not found', 404);
    }

    // Fetch order items with category & variety details
    const { data: items } = await supabaseAdmin
      .from('purchase_order_items')
      .select('*, crop_categories(*), crop_varieties(*)')
      .eq('order_id', orderId);

    // Fetch invoices
    const { data: invoices } = await supabaseAdmin
      .from('invoices')
      .select('id, invoice_no, status, total_amount_lkr, due_date')
      .eq('order_id', orderId);

    // Fetch delivery schedules
    const { data: deliverySchedules } = await supabaseAdmin
      .from('delivery_schedules')
      .select('id, schedule_no, status, scheduled_date')
      .eq('order_id', orderId);

    const fullOrder = {
      ...order,
      purchase_order_items: items || [],
      invoices: invoices || [],
      delivery_schedules: deliverySchedules || [],
    };

    sendSuccess(res, { data: fullOrder });
  } catch (e) { next(e); }
};

/**
 * PATCH /api/orders/:id/status
 */
export const updateOrderStatus = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { status, notes, cancel_reason } = req.body;

    const ALLOWED = ['submitted','under_review','approved','rejected','stock_reserved','payment_pending','paid','preparing','dispatched','delivered','completed','cancelled'];
    if (!ALLOWED.includes(status)) throw new AppError(`Invalid order status '${status}'`, 400);

    const current = await loadOrderForUser(req, id);
    const role = req.user?.role as string;
    if (role === 'buyer') {
      if (status !== 'cancelled') throw new AppError('Buyers can only cancel their own orders', 403);
      if (!BUYER_CANCELLABLE.includes(current.status)) {
        throw new AppError(`An order that is ${current.status} can no longer be cancelled by the buyer`, 409);
      }
    } else if (role !== 'administrator') {
      const allowed = ROLE_STATUS_RULES[role] ?? [];
      if (!allowed.includes(status)) throw new AppError(`Your role cannot set an order to '${status}'`, 403);
    }
    const TERMINAL = ['completed','cancelled','rejected'];
    if (TERMINAL.includes((current as any).status)) {
      throw new AppError(`Order is already ${(current as any).status} and can no longer change`, 409);
    }

    if (status === 'approved' || status === 'stock_reserved') {
      const results = await performOrderStockReservation(id, req.user?.id);
      sendSuccess(res, { data: results, message: 'Order approved and stock reserved (FEFO)' });
      return;
    }

    if (status === 'cancelled' || status === 'rejected') {
      await releaseOrderStock(id, req.user?.id);
    }

    const updates: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
    if (cancel_reason) updates.cancel_reason = cancel_reason;
    if (status === 'cancelled') updates.cancelled_at = new Date().toISOString();
    if (notes) updates.notes = notes;

    const { data, error } = await supabaseAdmin
      .from('purchase_orders')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new AppError(error.message, 500);
    if (status === 'rejected') {
      const b: any = Array.isArray((current as any).buyers) ? (current as any).buyers[0] : (current as any).buyers;
      await notifyUser(b?.profile_id, 'order_approval', 'Order rejected',
        `Your order ${(current as any).order_no} was rejected${cancel_reason || notes ? ': ' + (cancel_reason || notes) : '.'}`, 'purchase_order', id);
    }
    sendSuccess(res, { data, message: `Order status updated to ${status}` });
  } catch (e) { next(e); }
};

/**
 * POST /api/orders/:id/allocate
 * FIFO/FEFO allocation of stock to order items.
 */
export const allocateStock = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const allocationResults = await performOrderStockReservation(id, req.user?.id);
    sendSuccess(res, { data: allocationResults, message: 'Stock allocated and reserved successfully (FEFO)' });
  } catch (e) { next(e); }
};

/**
 * POST /api/orders/:id/cancel
 */
export const cancelOrder = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.slice(0, 500) : undefined;

    const current = await loadOrderForUser(req, id);
    if (['completed', 'cancelled', 'rejected', 'delivered'].includes(current.status)) {
      throw new AppError(`Order is already ${current.status} and cannot be cancelled`, 409);
    }
    if (req.user?.role === 'buyer' && !BUYER_CANCELLABLE.includes(current.status)) {
      throw new AppError(`An order that is ${current.status} can no longer be cancelled by the buyer`, 409);
    }

    await releaseOrderStock(id, req.user?.id);

    await supabaseAdmin
      .from('purchase_orders')
      .update({ status: 'cancelled', cancel_reason: reason, cancelled_at: new Date().toISOString() })
      .eq('id', id);

    sendSuccess(res, { message: 'Order cancelled and stock released back to inventory' });
  } catch (e) { next(e); }
};

/**
 * Atomic FEFO reservation (see migration 024 reserve_order_stock).
 * Never oversells, never allocates expired stock, rejects excessive reservations,
 * and rolls back completely if any line cannot be satisfied.
 */
export const performOrderStockReservation = async (orderId: string, userId?: string) => {
  const { data, error } = await supabaseAdmin.rpc('reserve_order_stock', { p_order_id: orderId, p_user: userId ?? null });
  if (error) throw rpcToAppError(error);

  // Tell the buyer their order was approved
  const { data: order } = await supabaseAdmin
    .from('purchase_orders').select('id, order_no, buyers!buyer_id(profile_id)').eq('id', orderId).maybeSingle();
  const buyer: any = Array.isArray((order as any)?.buyers) ? (order as any).buyers[0] : (order as any)?.buyers;
  await notifyUser(buyer?.profile_id, 'order_approval', 'Order approved',
    `Your order ${(order as any)?.order_no ?? ''} was approved and stock has been reserved.`, 'purchase_order', orderId);
  return data;
};

/** Release reserved stock for an order back to inventory (cancellation / rejection). */
export const releaseOrderStock = async (orderId: string, userId?: string) => {
  const { error } = await supabaseAdmin.rpc('release_order_stock', { p_order_id: orderId, p_user: userId ?? null });
  if (error) throw rpcToAppError(error);
};

// ─── Buyer feedback (Epic 3: order completion & buyer feedback) ─────────────────

const rating = (v: unknown, required = false): number | null => {
  if (v === undefined || v === null || v === '') {
    if (required) throw new AppError('A rating from 1 to 5 is required', 400);
    return null;
  }
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1 || n > 5) throw new AppError('Ratings must be whole numbers from 1 to 5', 400);
  return n;
};

/** GET /api/orders/:id/feedback */
export const getOrderFeedback = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    await loadOrderForUser(req, req.params.id);
    const { data } = await supabaseAdmin.from('order_feedback').select('*').eq('order_id', req.params.id).maybeSingle();
    sendSuccess(res, { data: data ?? null });
  } catch (e) { next(e); }
};

/** POST /api/orders/:id/feedback – buyer rates a delivered / completed order (once). */
export const submitOrderFeedback = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const order = await loadOrderForUser(req, req.params.id);
    if (!['delivered', 'completed'].includes(order.status)) {
      throw new AppError('Feedback can only be given after the order is delivered', 400);
    }
    const overall = rating(req.body.rating, true) as number;
    const row = {
      order_id: order.id,
      buyer_id: order.buyer_id,
      rating: overall,
      quality_rating: rating(req.body.quality_rating),
      delivery_rating: rating(req.body.delivery_rating),
      comment: typeof req.body.comment === 'string' ? req.body.comment.trim().slice(0, 1000) || null : null,
    };
    const { data, error } = await supabaseAdmin.from('order_feedback').insert(row).select().single();
    if (error) {
      if (error.code === '23505') throw new AppError('Feedback has already been submitted for this order', 409);
      throw new AppError(error.message, 500);
    }
    await notifyRole('inventory_manager', 'general', 'New buyer feedback', `Order ${order.order_no} was rated ${overall}/5.`, 'purchase_order', order.id);
    sendSuccess(res, { data, statusCode: 201, message: 'Thank you for your feedback' });
  } catch (e) { next(e); }
};
