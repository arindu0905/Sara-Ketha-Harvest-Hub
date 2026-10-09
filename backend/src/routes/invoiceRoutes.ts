import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import { supabaseAdmin } from '../config/supabase';
import { sendSuccess } from '../utils/response';
import { AppError } from '../utils/AppError';
import { rpcToAppError } from '../utils/rpcError';
import { getBuyerIdForProfile } from '../services/access';

const router = Router();
router.use(authenticate);

const VIEW = ['buyer', 'finance_officer', 'manager', 'inventory_manager'] as const;

// GET invoices (buyers see only their own)
router.get('/', requireRole(...VIEW), async (req: any, res, next) => {
  try {
    let query = supabaseAdmin
      .from('invoices')
      .select(`
        *, buyers!buyer_id(company_name, buyer_code),
        purchase_orders!order_id(order_no, status),
        invoice_items(*), buyer_payments(*)
      `);

    if (req.user?.role === 'buyer') {
      const own = await getBuyerIdForProfile(req.user.id);
      if (!own) { sendSuccess(res, { data: [] }); return; }
      query = query.eq('buyer_id', own);
    }

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw new AppError(error.message, 500);
    sendSuccess(res, { data: data || [] });
  } catch (e) { next(e); }
});

// GET outstanding payments (receivables + payables)  (E4-US5)
router.get('/outstanding', requireRole('finance_officer', 'manager'), async (_req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin.from('outstanding_payments').select('*').order('days_overdue', { ascending: false });
    if (error) throw new AppError(error.message, 500);
    const rows = data || [];
    const sum = (k: string) => rows.filter((r: any) => r.kind === k).reduce((a: number, r: any) => a + Number(r.outstanding_lkr), 0);
    sendSuccess(res, {
      data: {
        items: rows,
        totals: {
          receivable_lkr: sum('buyer_invoice'), payable_lkr: sum('farmer_payout'),
          overdue_count: rows.filter((r: any) => Number(r.days_overdue) > 0).length,
        },
      },
    });
  } catch (e) { next(e); }
});

// GET payment receipts (buyer: own; finance/manager: all)
router.get('/receipts', requireRole('buyer', 'finance_officer', 'manager'), async (req: any, res, next) => {
  try {
    let q = supabaseAdmin.from('payment_receipts')
      .select('*, invoices!invoice_id(invoice_no, buyer_id, total_amount_lkr, purchase_orders!order_id(order_no))')
      .eq('receipt_type', 'buyer_payment').order('issued_at', { ascending: false }).limit(200);
    const { data, error } = await q;
    if (error) throw new AppError(error.message, 500);
    let rows = data || [];
    if (req.user.role === 'buyer') {
      const own = await getBuyerIdForProfile(req.user.id);
      rows = rows.filter((r: any) => (Array.isArray(r.invoices) ? r.invoices[0] : r.invoices)?.buyer_id === own);
    }
    sendSuccess(res, { data: rows });
  } catch (e) { next(e); }
});

// POST create invoice (finance)
router.post('/', requireRole('finance_officer'), async (req: any, res, next) => {
  try {
    const { order_id, buyer_id, items, tax_amount_lkr = 0, discount_lkr = 0, notes, due_days = 30 } = req.body;
    if (!order_id || !buyer_id) throw new AppError('order_id and buyer_id are required', 400);
    if (!Array.isArray(items) || items.length === 0) throw new AppError('At least one invoice line is required', 400);

    const { data: order } = await supabaseAdmin.from('purchase_orders').select('id, status, buyer_id').eq('id', order_id).maybeSingle();
    if (!order) throw new AppError('Order not found', 404);
    if (order.buyer_id !== buyer_id) throw new AppError('Order does not belong to that buyer', 400);
    if (['cancelled', 'rejected'].includes(order.status)) throw new AppError(`Cannot invoice a ${order.status} order`, 409);

    const lines = items.map((i: any) => {
      const t = Number(i.total_lkr);
      if (!String(i.description || '').trim() || !Number.isFinite(t) || t <= 0) throw new AppError('Each invoice line needs a description and a positive total', 400);
      return { ...i, total_lkr: t };
    });
    const subtotal = lines.reduce((s: number, i: { total_lkr: number }) => s + i.total_lkr, 0);
    const tax = Number(tax_amount_lkr) || 0, disc = Number(discount_lkr) || 0;
    const total = subtotal + tax - disc;
    if (total <= 0) throw new AppError('Invoice total must be greater than zero', 400);

    const { data: invNo } = await supabaseAdmin.rpc('generate_invoice_no');
    const due = new Date(); due.setDate(due.getDate() + (Number(due_days) || 30));
    const invoiceNum = invNo || `INV-${Date.now()}`;
    const dueDateStr = due.toISOString().split('T')[0];

    const { data, error } = await supabaseAdmin.from('invoices').insert({
      invoice_no: invoiceNum, order_id, buyer_id, subtotal_lkr: subtotal, tax_amount_lkr: tax, discount_lkr: disc,
      total_amount_lkr: total, due_date: dueDateStr, notes, created_by: req.user?.id,
    }).select().single();
    if (error) throw new AppError(error.message, 500);

    await supabaseAdmin.from('buyer_invoices').insert({
      invoice_no: invoiceNum, order_id, buyer_id, subtotal_lkr: subtotal, tax_amount_lkr: tax, discount_lkr: disc,
      total_amount_lkr: total, due_date: dueDateStr, status: 'issued', notes, created_by: req.user?.id,
    });
    await supabaseAdmin.from('invoice_items').insert(lines.map((i: any) => ({ invoice_id: data.id, ...i })));
    await supabaseAdmin.from('purchase_orders').update({ status: 'payment_pending' }).eq('id', order_id).in('status', ['approved', 'stock_reserved']);

    sendSuccess(res, { data, statusCode: 201, message: 'Invoice generated' });
  } catch (e) { next(e); }
});

// GET invoice by id
router.get('/:id', requireRole(...VIEW), async (req: any, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('invoices')
      .select(`*, invoice_items(*), buyers!buyer_id(*), purchase_orders!order_id(*), buyer_payments(*), payment_receipts(*)`)
      .eq('id', req.params.id).single();
    if (error || !data) throw new AppError('Invoice not found', 404);
    if (req.user.role === 'buyer') {
      const own = await getBuyerIdForProfile(req.user.id);
      if (own !== (data as any).buyer_id) throw new AppError('You can only view your own invoices', 403);
    }
    sendSuccess(res, { data });
  } catch (e) { next(e); }
});

// POST record buyer payment – full or partial; issues a receipt (E4-US4/E4-US5)
router.post('/:id/payment', requireRole('finance_officer'), async (req: any, res, next) => {
  try {
    const { amount_lkr, payment_method, payment_date, reference_no, notes } = req.body;
    const amount = Number(amount_lkr);
    if (!Number.isFinite(amount) || amount <= 0) throw new AppError('Payment amount must be greater than zero', 400);
    if (payment_method && !['bank_transfer', 'cash', 'cheque', 'card', 'online'].includes(payment_method)) {
      throw new AppError('Invalid payment method', 400);
    }
    const { data, error } = await supabaseAdmin.rpc('record_buyer_payment', {
      p_invoice_id: req.params.id, p_amount: amount, p_method: payment_method || 'bank_transfer',
      p_date: payment_date || null, p_reference: reference_no || null, p_notes: notes || null, p_user: req.user?.id ?? null,
    });
    if (error) throw rpcToAppError(error);
    const r = data as any;
    sendSuccess(res, { data: r, message: r.invoice_status === 'paid' ? `Invoice fully paid – receipt ${r.receipt_no}` : `Partial payment recorded – receipt ${r.receipt_no}, balance LKR ${r.balance_lkr}` });
  } catch (e) { next(e); }
});

export default router;
