import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import { supabaseAdmin } from '../config/supabase';
import { sendSuccess } from '../utils/response';
import { AppError } from '../utils/AppError';

const router = Router();
router.use(authenticate);

// GET invoices
router.get('/', async (req: any, res, next) => {
  try {
    let query = supabaseAdmin
      .from('invoices')
      .select(`
        *, buyers!buyer_id(company_name, buyer_code),
        purchase_orders!order_id(order_no),
        invoice_items(*), buyer_payments(*)
      `);

    if (req.user?.role === 'buyer') {
      const { data: b } = await supabaseAdmin.from('buyers').select('id').eq('profile_id', req.user.id).single();
      if (b) query = query.eq('buyer_id', b.id);
    }

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw new AppError(error.message, 500);
    sendSuccess(res, { data: data || [] });
  } catch (e) { next(e); }
});

// POST create invoice
router.post('/', requireRole('finance_officer', 'administrator'), async (req: any, res, next) => {
  try {
    const { order_id, buyer_id, items, tax_amount_lkr = 0, discount_lkr = 0, notes, due_days = 30 } = req.body;

    const { data: invNo } = await supabaseAdmin.rpc('generate_invoice_no');
    const subtotal = items.reduce((s: number, i: { total_lkr: number }) => s + i.total_lkr, 0);
    const total = subtotal + tax_amount_lkr - discount_lkr;
    const due = new Date(); due.setDate(due.getDate() + due_days);

    const { data, error } = await supabaseAdmin
      .from('invoices')
      .insert({
        invoice_no: invNo || `INV-${Date.now()}`,
        order_id, buyer_id, subtotal_lkr: subtotal,
        tax_amount_lkr, discount_lkr, total_amount_lkr: total,
        due_date: due.toISOString().split('T')[0],
        notes, created_by: req.user?.id,
      })
      .select().single();

    if (error) throw new AppError(error.message, 500);

    await supabaseAdmin.from('invoice_items').insert(
      items.map((i: { description: string; quantity_kg?: number; unit_price_lkr?: number; total_lkr: number }) => ({
        invoice_id: data.id, ...i
      }))
    );

    await supabaseAdmin.from('purchase_orders').update({ status: 'payment_pending' }).eq('id', order_id);

    sendSuccess(res, { data, statusCode: 201, message: 'Invoice generated' });
  } catch (e) { next(e); }
});

// GET invoice by id
router.get('/:id', async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('invoices')
      .select(`*, invoice_items(*), buyers!buyer_id(*), purchase_orders!order_id(*), buyer_payments(*)`)
      .eq('id', req.params.id).single();
    if (error || !data) throw new AppError('Invoice not found', 404);
    sendSuccess(res, { data });
  } catch (e) { next(e); }
});

// POST record buyer payment
router.post('/:id/payment', requireRole('finance_officer', 'administrator'), async (req: any, res, next) => {
  try {
    const { amount_lkr, payment_method, payment_date, reference_no, notes } = req.body;

    const { data: invoice } = await supabaseAdmin
      .from('invoices').select('id, buyer_id, total_amount_lkr, order_id').eq('id', req.params.id).single();
    if (!invoice) throw new AppError('Invoice not found', 404);

    await supabaseAdmin.from('buyer_payments').insert({
      invoice_id: invoice.id,
      buyer_id: invoice.buyer_id,
      amount_lkr, payment_method, payment_date, reference_no, notes,
      recorded_by: req.user?.id,
    });

    await supabaseAdmin.from('invoices').update({ status: 'paid' }).eq('id', invoice.id);
    await supabaseAdmin.from('purchase_orders').update({ status: 'paid' }).eq('id', invoice.order_id);

    sendSuccess(res, { message: 'Payment recorded successfully' });
  } catch (e) { next(e); }
});

export default router;
