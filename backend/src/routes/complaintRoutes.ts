import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { supabaseAdmin } from '../config/supabase';
import { sendSuccess, paginatedResponse } from '../utils/response';
import { AppError } from '../utils/AppError';

const router = Router();
router.use(authenticate);

// GET complaints
router.get('/', async (req: any, res, next) => {
  try {
    const { status, page = '1', limit = '20' } = req.query as Record<string, string>;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;

    let query = supabaseAdmin
      .from('complaints')
      .select(`*, profiles!submitted_by(full_name, email, role), profiles!assigned_to(full_name)`, { count: 'exact' });

    // Farmers/buyers see only their own
    if (['farmer', 'buyer'].includes(req.user.role)) {
      query = query.eq('submitted_by', req.user.id);
    }
    if (status) query = query.eq('status', status);

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limitNum - 1);
    if (error) throw new AppError(error.message, 500);
    paginatedResponse(res, data || [], { page: pageNum, limit: limitNum, total: count || 0 });
  } catch (e) { next(e); }
});

// POST create complaint
router.post('/', async (req: any, res, next) => {
  try {
    const { data: cmpNo } = await supabaseAdmin.rpc('generate_complaint_no');
    const { data, error } = await supabaseAdmin
      .from('complaints')
      .insert({
        complaint_no: cmpNo || `CMP-${Date.now()}`,
        submitted_by: req.user.id,
        ...req.body,
        status: 'submitted',
      })
      .select().single();
    if (error) throw new AppError(error.message, 500);
    sendSuccess(res, { data, statusCode: 201, message: 'Complaint submitted' });
  } catch (e) { next(e); }
});

// GET complaint by id
router.get('/:id', async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('complaints')
      .select(`*, complaint_comments(*, profiles!author_id(full_name, role))`)
      .eq('id', req.params.id).single();
    if (error || !data) throw new AppError('Complaint not found', 404);
    sendSuccess(res, { data });
  } catch (e) { next(e); }
});

// PATCH update status
router.patch('/:id/status', async (req: any, res, next) => {
  try {
    const { status, resolution } = req.body;
    const updates: Record<string, unknown> = { status };
    if (resolution) updates.resolution = resolution;
    if (status === 'resolved') updates.resolved_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from('complaints')
      .update(updates)
      .eq('id', req.params.id).select().single();
    if (error) throw new AppError(error.message, 500);
    sendSuccess(res, { data, message: 'Complaint updated' });
  } catch (e) { next(e); }
});

// POST add comment
router.post('/:id/comments', async (req: any, res, next) => {
  try {
    const { comment, is_internal = false } = req.body;
    const { data, error } = await supabaseAdmin
      .from('complaint_comments')
      .insert({ complaint_id: req.params.id, author_id: req.user.id, comment, is_internal })
      .select().single();
    if (error) throw new AppError(error.message, 500);
    sendSuccess(res, { data, statusCode: 201, message: 'Comment added' });
  } catch (e) { next(e); }
});

export default router;
