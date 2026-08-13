import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { sendSuccess } from '../utils/response';
import { AppError } from '../utils/AppError';
import { AuthenticatedRequest } from '../middleware/auth';

/**
 * POST /api/farmer-payments/calculate
 * Calculate and create farmer payment record for a collection.
 */
export const calculatePayment = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { collection_id, deductions = [] } = req.body;

    // Get collection and inspection data
    const { data: collection } = await supabaseAdmin
      .from('produce_collections')
      .select(`
        id, farmer_id, category_id, centre_id,
        quality_inspections(grade, accepted_qty_kg),
        farmer_payments(id)
      `)
      .eq('id', collection_id)
      .single();

    if (!collection) throw new AppError('Collection not found', 404);
    if (!collection.quality_inspections?.[0]) throw new AppError('Quality inspection required before payment calculation', 400);
    if (collection.farmer_payments?.[0]) throw new AppError('Payment already calculated for this collection', 409);

    const inspection = collection.quality_inspections[0];
    if (!inspection.accepted_qty_kg || inspection.accepted_qty_kg <= 0) {
      throw new AppError('No accepted quantity — no payment applicable', 400);
    }

    // Get current price for grade
    const { data: priceRows } = await supabaseAdmin.rpc('get_current_price', {
      p_category_id: collection.category_id,
      p_grade: inspection.grade,
      p_centre_id: collection.centre_id,
    });

    const pricePerKg = priceRows?.[0]?.purchase_price;
    if (!pricePerKg) throw new AppError('No active price found for this crop/grade', 400);

    const grossAmount = inspection.accepted_qty_kg * pricePerKg;
    const totalDeductions = deductions.reduce((sum: number, d: { amount_lkr: number }) => sum + d.amount_lkr, 0);
    const netAmount = Math.max(0, grossAmount - totalDeductions);

    const { data: paymentNo } = await supabaseAdmin.rpc('generate_payment_no');

    const { data: payment, error } = await supabaseAdmin
      .from('farmer_payments')
      .insert({
        payment_no: paymentNo || `PAY-${Date.now()}`,
        collection_id,
        farmer_id: collection.farmer_id,
        grade: inspection.grade,
        accepted_qty_kg: inspection.accepted_qty_kg,
        price_per_kg_lkr: pricePerKg,
        gross_amount_lkr: grossAmount,
        total_deductions_lkr: totalDeductions,
        net_amount_lkr: netAmount,
        status: 'calculated',
        calculated_by: req.user?.id,
        calculated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw new AppError(error.message, 500);

    // Insert deductions
    if (deductions.length > 0 && payment) {
      await supabaseAdmin.from('farmer_payment_deductions').insert(
        deductions.map((d: { description: string; amount_lkr: number }) => ({
          payment_id: payment.id,
          description: d.description,
          amount_lkr: d.amount_lkr,
        }))
      );
    }

    // Update collection status
    await supabaseAdmin
      .from('produce_collections')
      .update({ status: 'payment_pending' })
      .eq('id', collection_id);

    sendSuccess(res, {
      data: { ...payment, deductions },
      statusCode: 201,
      message: `Payment calculated: LKR ${netAmount.toFixed(2)}`,
    });
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
        produce_collections!collection_id(collection_no, created_at,
          crop_categories!category_id(name))
      `);

    if (status) query = query.eq('status', status);
    if (farmer_id) query = query.eq('farmer_id', farmer_id);

    // Farmers see only their own
    if (req.user?.role === 'farmer') {
      const { data: farmerRec } = await supabaseAdmin.from('farmers').select('id').eq('profile_id', req.user.id).single();
      if (farmerRec) query = query.eq('farmer_id', farmerRec.id);
    }

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw new AppError(error.message, 500);
    sendSuccess(res, { data: data || [] });
  } catch (e) { next(e); }
};

/**
 * GET /api/farmer-payments/:id
 */
export const getPaymentById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { data, error } = await supabaseAdmin
      .from('farmer_payments')
      .select(`
        *, farmer_payment_deductions(*),
        farmers!farmer_id(id, full_name, farmer_code, bank_name, bank_branch, account_holder_name),
        produce_collections!collection_id(collection_no, net_weight_kg, created_at,
          crop_categories!category_id(name), crop_varieties!variety_id(name))
      `)
      .eq('id', req.params.id)
      .single();
    if (error || !data) throw new AppError('Payment not found', 404);
    sendSuccess(res, { data });
  } catch (e) { next(e); }
};

/**
 * PATCH /api/farmer-payments/:id/approve
 */
export const approvePayment = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { data, error } = await supabaseAdmin
      .from('farmer_payments')
      .update({
        status: 'approved',
        approved_by: req.user?.id,
        approved_at: new Date().toISOString(),
      })
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw new AppError(error.message, 500);
    sendSuccess(res, { data, message: 'Payment approved' });
  } catch (e) { next(e); }
};

/**
 * PATCH /api/farmer-payments/:id/mark-paid
 */
export const markPaymentPaid = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { payment_method, payment_date } = req.body;
    const { data, error } = await supabaseAdmin
      .from('farmer_payments')
      .update({
        status: 'paid',
        payment_method,
        payment_date,
        paid_by: req.user?.id,
        paid_at: new Date().toISOString(),
      })
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw new AppError(error.message, 500);

    // Update collection to completed
    if (data) {
      await supabaseAdmin
        .from('produce_collections')
        .update({ status: 'completed' })
        .eq('id', data.collection_id);
    }

    sendSuccess(res, { data, message: 'Payment marked as paid' });
  } catch (e) { next(e); }
};
