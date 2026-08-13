import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { supabaseAdmin } from '../config/supabase';
import { sendSuccess } from '../utils/response';
import { AppError } from '../utils/AppError';

const router = Router();
router.use(authenticate);

// GET buyers
router.get('/', async (req: any, res, next) => {
  try {
    let query = supabaseAdmin.from('buyers').select('*, profiles!profile_id(email, avatar_url)');
    if (req.user.role === 'buyer') query = query.eq('profile_id', req.user.id);
    const { data, error } = await query.order('company_name');
    if (error) throw new AppError(error.message, 500);
    sendSuccess(res, { data: data || [] });
  } catch (e) { next(e); }
});

// POST create buyer
router.post('/', async (req: any, res, next) => {
  try {
    const { data: buyerCode } = await supabaseAdmin.rpc('generate_buyer_code');
    const { data, error } = await supabaseAdmin
      .from('buyers')
      .insert({ ...req.body, buyer_code: buyerCode || `BUY-${Date.now()}`, created_by: req.user.id })
      .select().single();
    if (error) throw new AppError(error.message, 500);
    sendSuccess(res, { data, statusCode: 201, message: 'Buyer registered' });
  } catch (e) { next(e); }
});

// GET buyer by id
router.get('/:id', async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('buyers')
      .select('*, profiles!profile_id(*), buyer_documents(*)')
      .eq('id', req.params.id).single();
    if (error || !data) throw new AppError('Buyer not found', 404);
    sendSuccess(res, { data });
  } catch (e) { next(e); }
});

// PUT update buyer
router.put('/:id', async (req: any, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('buyers').update(req.body).eq('id', req.params.id).select().single();
    if (error) throw new AppError(error.message, 500);
    sendSuccess(res, { data, message: 'Buyer updated' });
  } catch (e) { next(e); }
});

export default router;
