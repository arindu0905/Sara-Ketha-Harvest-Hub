import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import { assertBuyerAccess, getBuyerIdForProfile } from '../services/access';
import { notifyUser } from '../services/notify';
import { supabaseAdmin } from '../config/supabase';
import { sendSuccess } from '../utils/response';
import { AppError } from '../utils/AppError';

const router = Router();

const BUYER_EDITABLE = ['company_name','business_reg_no','contact_person','email','phone','address','district','buyer_type','notes'];
const STAFF_EDITABLE = [...BUYER_EDITABLE, 'credit_limit_lkr','payment_terms_days','verification_status','account_status'];
const pick = (src: any, keys: string[]) =>
  Object.fromEntries(keys.filter(k => src && src[k] !== undefined).map(k => [k, src[k]]));

router.use(authenticate);

// GET buyers
router.get('/', requireRole('buyer','administrator','finance_officer','inventory_manager','manager','transport_coordinator'), async (req: any, res, next) => {
  try {
    let query = supabaseAdmin.from('buyers').select('*, profiles!profile_id(email, avatar_url)');
    if (req.user.role === 'buyer') query = query.eq('profile_id', req.user.id);
    const { data, error } = await query.order('company_name');
    if (error) throw new AppError(error.message, 500);
    sendSuccess(res, { data: data || [] });
  } catch (e) { next(e); }
});

// POST create buyer (a buyer registers their own profile once; admin may register on behalf)
router.post('/', requireRole('buyer','administrator'), async (req: any, res, next) => {
  try {
    const body = pick(req.body, BUYER_EDITABLE);
    for (const f of ['company_name','contact_person','email','phone','address','district']) {
      if (!body[f] || typeof body[f] !== 'string' || !String(body[f]).trim()) {
        throw new AppError(`${f} is required`, 400);
      }
    }
    let profile_id: string | null = null;
    if (req.user.role === 'buyer') {
      if (await getBuyerIdForProfile(req.user.id)) throw new AppError('A buyer profile already exists for this account', 409);
      profile_id = req.user.id;
    }
    const { data: buyerCode } = await supabaseAdmin.rpc('generate_buyer_code');
    const { data, error } = await supabaseAdmin
      .from('buyers')
      .insert({ ...body, profile_id, buyer_code: buyerCode || `BUY-${Date.now()}`, created_by: req.user.id })
      .select().single();
    if (error) throw new AppError(error.message, error.code === '23505' ? 409 : 400);
    sendSuccess(res, { data, statusCode: 201, message: 'Buyer registered' });
  } catch (e) { next(e); }
});

// GET buyer by id
router.get('/:id', async (req: any, res, next) => {
  try {
    await assertBuyerAccess(req, req.params.id);
    const { data, error } = await supabaseAdmin
      .from('buyers')
      .select('*, profiles!profile_id(*), buyer_documents(*)')
      .eq('id', req.params.id).single();
    if (error || !data) throw new AppError('Buyer not found', 404);
    sendSuccess(res, { data });
  } catch (e) { next(e); }
});

// PUT update buyer (buyers: own profile & contact fields only; staff approve/credit)
router.put('/:id', requireRole('buyer','administrator','finance_officer'), async (req: any, res, next) => {
  try {
    await assertBuyerAccess(req, req.params.id);
    const fields = req.user.role === 'buyer' ? BUYER_EDITABLE : STAFF_EDITABLE;
    const updates: Record<string, unknown> = pick(req.body, fields);
    if (req.user.role === 'finance_officer') {
      for (const k of Object.keys(updates)) {
        if (!['credit_limit_lkr','payment_terms_days'].includes(k)) delete updates[k];
      }
    }
    if (!Object.keys(updates).length) throw new AppError('No editable fields supplied', 400);
    updates.updated_at = new Date().toISOString();
    const { data, error } = await supabaseAdmin
      .from('buyers').update(updates).eq('id', req.params.id).select().single();
    if (error) throw new AppError(error.message, 400);
    if (updates.verification_status && (data as any).profile_id) {
      await notifyUser((data as any).profile_id, 'account_approval', 'Account verification updated',
        `Your buyer account is now ${updates.verification_status}.`, 'buyer', req.params.id);
    }
    sendSuccess(res, { data, message: 'Buyer updated' });
  } catch (e) { next(e); }
});

export default router;
