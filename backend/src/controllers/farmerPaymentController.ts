import { Response, NextFunction } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { sendSuccess } from '../utils/response';
import { AppError } from '../utils/AppError';
import { AuthenticatedRequest } from '../middleware/auth';
import { getFarmerIdForUser, assertFarmerAccess } from '../services/access';
import { rpcToAppError } from '../utils/rpcError';
import { notifyUser } from '../services/notify';

/**
 * POST /api/farmer-payments/calculate   (E4-US1, E4-US2)
 * Gross is ALWAYS computed server-side: accepted quantity (from the approved inspection) x current
 * purchase price for the inspected grade. The finance officer may only supply authorised deductions
 * (and optionally a price override, which must be justified in notes).
 * Body: { collection_id, deductions?: [{description, amount_lkr}], unit_price_lkr?, notes? }
 */
export const calculatePayment = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { collection_id, deductions = [], unit_price_lkr, notes } = req.body;
    if (!collection_id) throw new AppError('collection_id is required', 400);

    const { data: collection } = await supabaseAdmin
      .from('produce_collections')
      .select(`
        id, collection_no, farmer_id, category_id, variety_id, centre_id, net_weight_kg, status,
        quality_inspections(grade, accepted_qty_kg, approved_at),
        farmer_payments(id, payment_no, status)
      `)
      .eq('id', collection_id)
      .single();
    if (!collection) throw new AppError('Collection not found', 404);

    const inspection: any = Array.isArray(collection.quality_inspections) ? collection.quality_inspections[0] : collection.quality_inspections;
    if (!inspection || !inspection.approved_at) {
      throw new AppError('A completed quality inspection is required before a payment can be calculated', 409);
    }
    if (inspection.grade === 'rejected' || Number(inspection.accepted_qty_kg) <= 0) {
      throw new AppError('Nothing was accepted for this collection, so there is no payment to calculate', 409);
    }

    const existingPayment: any = Array.isArray(collection.farmer_payments) ? collection.farmer_payments[0] : collection.farmer_payments;
    if (existingPayment && !['pending_calculation', 'calculated', 'pending_approval'].includes(existingPayment.status)) {
      throw new AppError(`Payment ${existingPayment.payment_no} is already ${existingPayment.status} and can no longer be recalculated`, 409);
    }

    const acceptedQty = Number(inspection.accepted_qty_kg);
    const grade = inspection.grade as string;

    // Price: explicit override (finance) else the active price list for this crop/grade/centre
    let pricePerKg = Number(unit_price_lkr);
    let priceSource = 'override';
    if (!Number.isFinite(pricePerKg) || pricePerKg <= 0) {
      const { data: priceRows, error: priceErr } = await supabaseAdmin.rpc('get_current_price', {
        p_category_id: collection.category_id, p_grade: grade, p_centre_id: collection.centre_id, p_variety_id: collection.variety_id,
      });
      if (priceErr) throw new AppError(priceErr.message, 500);
      pricePerKg = Number(priceRows?.[0]?.purchase_price) || 0;
      priceSource = 'price_list';
    } else if (!String(notes || '').trim()) {
      throw new AppError('A note explaining the price override is required', 400);
    }
    if (!pricePerKg || pricePerKg <= 0) {
      throw new AppError('No active purchase price is configured for this crop and grade. Ask an administrator to set one in Price Management.', 409);
    }

    if (!Array.isArray(deductions)) throw new AppError('deductions must be a list', 400);
    const cleanDeductions = deductions.map((d: { description?: string; amount_lkr?: number | string }) => {
      const amt = Number(d.amount_lkr);
      if (!String(d.description || '').trim()) throw new AppError('Every deduction needs a description', 400);
      if (!Number.isFinite(amt) || amt <= 0) throw new AppError(`Deduction "${d.description}" must have an amount greater than zero`, 400);
      return { description: String(d.description).trim(), amount_lkr: Math.round(amt * 100) / 100 };
    });

    const gross = Math.round(acceptedQty * pricePerKg * 100) / 100;
    const totalDeductions = Math.round(cleanDeductions.reduce((s2, d) => s2 + d.amount_lkr, 0) * 100) / 100;
    if (totalDeductions > gross) throw new AppError(`Deductions (LKR ${totalDeductions}) cannot exceed the gross amount (LKR ${gross})`, 400);
    const net = Math.round((gross - totalDeductions) * 100) / 100;

    const now = new Date().toISOString();
    let payment: any;
    if (existingPayment) {
      const { data: upd, error: updateErr } = await supabaseAdmin.from('farmer_payments').update({
        grade, accepted_qty_kg: acceptedQty, price_per_kg_lkr: pricePerKg, gross_amount_lkr: gross,
        total_deductions_lkr: totalDeductions, net_amount_lkr: net, status: 'calculated',
        calculated_by: req.user?.id, calculated_at: now, notes: notes || null, updated_at: now,
      }).eq('id', existingPayment.id).select().single();
      if (updateErr) throw new AppError(updateErr.message, 500);
      payment = upd;
      await supabaseAdmin.from('farmer_payment_deductions').delete().eq('payment_id', existingPayment.id);
    } else {
      let paymentNo = '';
      for (let i = 0; i < 5 && !payment; i++) {
        const { data: generatedNo } = await supabaseAdmin.rpc('generate_payment_no');
        paymentNo = generatedNo && i === 0 ? generatedNo : `PAY-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
        const { data: ins, error } = await supabaseAdmin.from('farmer_payments').insert({
          payment_no: paymentNo, collection_id, farmer_id: collection.farmer_id, grade, accepted_qty_kg: acceptedQty,
          price_per_kg_lkr: pricePerKg, gross_amount_lkr: gross, total_deductions_lkr: totalDeductions, net_amount_lkr: net,
          status: 'calculated', calculated_by: req.user?.id || null, calculated_at: now, notes: notes || null,
        }).select().single();
        if (!error) payment = ins;
        else if (error.code !== '23505') throw new AppError(error.message, 500);
      }
      if (!payment) throw new AppError('Could not allocate a payment number', 500);
    }

    if (cleanDeductions.length > 0) {
      await supabaseAdmin.from('farmer_payment_deductions').insert(cleanDeductions.map(d => ({ payment_id: payment.id, ...d })));
    }

    // Keep the farmer invoice in sync
    const { data: existingFinv } = await supabaseAdmin.from('farmer_invoices').select('id').eq('payment_id', payment.id).maybeSingle();
    if (existingFinv) {
      await supabaseAdmin.from('farmer_invoices').update({
        gross_amount_lkr: gross, deductions_lkr: totalDeductions, net_amount_lkr: net, status: 'calculated', updated_at: now,
      }).eq('id', existingFinv.id);
    } else {
      let invNo = `FINV-${payment.payment_no.replace(/^PAY-/, '')}`;
      const { error: finvErr } = await supabaseAdmin.from('farmer_invoices').insert({
        invoice_no: invNo, payment_id: payment.id, collection_id, farmer_id: collection.farmer_id,
        issue_date: now.split('T')[0], gross_amount_lkr: gross, deductions_lkr: totalDeductions, net_amount_lkr: net,
        status: 'calculated', created_by: req.user?.id || null,
      });
      if (finvErr) throw new AppError(finvErr.message, 500);
    }

    await supabaseAdmin.from('produce_collections').update({ status: 'payment_pending' }).eq('id', collection_id);

    sendSuccess(res, {
      data: { ...payment, deductions: cleanDeductions, price_source: priceSource },
      statusCode: existingPayment ? 200 : 201,
      message: `Payment ${existingPayment ? 'recalculated' : 'calculated'}: LKR ${net.toLocaleString()} (${acceptedQty} kg x LKR ${pricePerKg})`,
    });
  } catch (e) { next(e); }
};

/**
 * GET /api/farmer-payments/invoices
 * Get all farmer invoices stored separately in farmer_invoices table.
 */
export const getFarmerInvoices = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { status, farmer_id } = req.query as Record<string, string>;

    let query = supabaseAdmin
      .from('farmer_invoices')
      .select(`
        *,
        farmers!farmer_id(id, full_name, farmer_code, bank_name, account_number_masked, account_holder_name),
        produce_collections!collection_id(id, collection_no, created_at,
          crop_categories!category_id(name)),
        farmer_payments!payment_id(id, payment_no, grade, accepted_qty_kg, price_per_kg_lkr)
      `);

    if (status) query = query.eq('status', status);
    if (req.user?.role === 'farmer') {
      const own = await getFarmerIdForUser(req.user.id);
      if (!own) { sendSuccess(res, { data: [] }); return; }
      query = query.eq('farmer_id', own);
    } else if (farmer_id) query = query.eq('farmer_id', farmer_id);

    const { data, error: invErr } = await query.order('created_at', { ascending: false });
    if (invErr) throw new AppError(invErr.message, 500);

    sendSuccess(res, { data: data || [] });
  } catch (e) { next(e); }
};

/**
 * GET /api/farmer-payments
 */
export const getPayments = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { status, farmer_id } = req.query as Record<string, string>;

    let query = supabaseAdmin
      .from('farmer_payments')
      .select(`
        *,
        farmers!farmer_id(id, full_name, farmer_code, bank_name, account_holder_name),
        calculator:profiles!calculated_by(full_name, role), approver:profiles!approved_by(full_name, role), payer:profiles!paid_by(full_name, role),
        produce_collections!collection_id(collection_no, created_at,
          crop_categories!category_id(name, name_sinhala, name_tamil))
      `);

    if (status) query = query.eq('status', status);
    // Farmers see only their own payments
    if (req.user?.role === 'farmer') {
      const own = await getFarmerIdForUser(req.user.id);
      if (!own) { sendSuccess(res, { data: [] }); return; }
      query = query.eq('farmer_id', own);
    } else if (farmer_id) {
      query = query.eq('farmer_id', farmer_id);
    }

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw new AppError(error.message, 500);

    sendSuccess(res, { data: data || [] });
  } catch (e) { next(e); }
};

/**
 * GET /api/farmer-payments/:id
 */
export const getPaymentById = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { data, error } = await supabaseAdmin
      .from('farmer_payments')
      .select(`
        *, farmer_payment_deductions(*), payment_receipts(receipt_no, issued_at, payment_method, reference_no),
        farmers!farmer_id(id, full_name, farmer_code, bank_name, bank_branch, account_holder_name),
        produce_collections!collection_id(collection_no, net_weight_kg, created_at,
          crop_categories!category_id(name), crop_varieties!variety_id(name))
      `)
      .eq('id', req.params.id)
      .single();
    if (error || !data) throw new AppError('Payment not found', 404);
    await assertFarmerAccess(req, (data as any).farmer_id);
    sendSuccess(res, { data });
  } catch (e) { next(e); }
};

/**
 * PATCH /api/farmer-payments/:id/approve   (E4-US2)
 * Only calculated payments can be approved. When the system setting `require_payment_approval_separation`
 * is 'true', the person who calculated a payment cannot also approve it (administrators excepted).
 */
export const approvePayment = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { data: current } = await supabaseAdmin.from('farmer_payments')
      .select('id, status, calculated_by, payment_no, net_amount_lkr, farmer_id').eq('id', req.params.id).maybeSingle();
    if (!current) throw new AppError('Payment not found', 404);
    if (!['calculated', 'pending_approval'].includes(current.status)) {
      throw new AppError(`Payment is ${current.status}; only calculated payments can be approved`, 409);
    }
    const { data: sod } = await supabaseAdmin.from('system_settings').select('value').eq('key', 'require_payment_approval_separation').maybeSingle();
    if (sod?.value === 'true' && current.calculated_by && current.calculated_by === req.user?.id && req.user?.role !== 'administrator') {
      throw new AppError('A payment must be approved by someone other than the person who calculated it', 403);
    }

    const { data, error } = await supabaseAdmin.from('farmer_payments').update({
      status: 'approved', approved_by: req.user?.id, approved_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }).eq('id', req.params.id).select().single();
    if (error) throw new AppError(error.message, 500);

    await supabaseAdmin.from('farmer_invoices').update({ status: 'approved', updated_at: new Date().toISOString() }).eq('payment_id', data.id);
    const { data: f } = await supabaseAdmin.from('farmers').select('profile_id').eq('id', current.farmer_id).maybeSingle();
    await notifyUser(f?.profile_id, 'payment_approval', 'Payment approved',
      `Payment ${current.payment_no} of LKR ${Number(current.net_amount_lkr).toLocaleString()} has been approved and will be paid shortly.`, 'farmer_payment', current.id);

    sendSuccess(res, { data, message: 'Payment approved' });
  } catch (e) { next(e); }
};

/**
 * PATCH /api/farmer-payments/:id/reject  – send a calculated payment back for recalculation (needs a reason).
 */
export const rejectPayment = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const reason = String(req.body?.reason || '').trim();
    if (reason.length < 5) throw new AppError('Please give a reason (at least 5 characters)', 400);
    const { data: current } = await supabaseAdmin.from('farmer_payments').select('id, status').eq('id', req.params.id).maybeSingle();
    if (!current) throw new AppError('Payment not found', 404);
    if (!['calculated', 'pending_approval', 'approved'].includes(current.status)) {
      throw new AppError(`Payment is ${current.status} and cannot be rejected`, 409);
    }
    const { data, error } = await supabaseAdmin.from('farmer_payments').update({
      status: 'pending_calculation', notes: `Rejected: ${reason}`, approved_by: null, approved_at: null, updated_at: new Date().toISOString(),
    }).eq('id', req.params.id).select().single();
    if (error) throw new AppError(error.message, 500);
    await supabaseAdmin.from('farmer_invoices').update({ status: 'issued', updated_at: new Date().toISOString() }).eq('payment_id', data.id);
    sendSuccess(res, { data, message: 'Payment sent back for recalculation' });
  } catch (e) { next(e); }
};

/**
 * PATCH /api/farmer-payments/:id/mark-paid  – payout; payment must be approved. Issues a payout receipt.
 */
export const markPaymentPaid = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { payment_method, payment_date, reference_no } = req.body;
    const { data: rpc, error } = await supabaseAdmin.rpc('pay_farmer_payment', {
      p_payment_id: req.params.id, p_method: payment_method || 'bank_transfer', p_date: payment_date || null,
      p_reference: reference_no || null, p_user: req.user?.id ?? null,
    });
    if (error) throw rpcToAppError(error);
    const { data } = await supabaseAdmin.from('farmer_payments').select('*').eq('id', req.params.id).single();
    sendSuccess(res, { data: { ...data, receipt_no: (rpc as any)?.receipt_no }, message: `Payment marked as paid – receipt ${(rpc as any)?.receipt_no}` });
  } catch (e) { next(e); }
};

/** GET /api/farmer-payments/:id/receipt */
export const getPaymentReceipt = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { data: pay } = await supabaseAdmin.from('farmer_payments').select('id, farmer_id').eq('id', req.params.id).maybeSingle();
    if (!pay) throw new AppError('Payment not found', 404);
    await assertFarmerAccess(req, pay.farmer_id);
    const { data, error } = await supabaseAdmin.from('payment_receipts')
      .select('*, farmer_payments!farmer_payment_id(payment_no, gross_amount_lkr, total_deductions_lkr, net_amount_lkr, grade, accepted_qty_kg, price_per_kg_lkr, farmer_payment_deductions(description, amount_lkr), farmers!farmer_id(full_name, farmer_code, bank_name, account_number_masked), produce_collections!collection_id(collection_no))')
      .eq('farmer_payment_id', req.params.id).maybeSingle();
    if (error) throw new AppError(error.message, 500);
    if (!data) throw new AppError('A receipt is issued once the payment has been paid', 404);
    sendSuccess(res, { data });
  } catch (e) { next(e); }
};
