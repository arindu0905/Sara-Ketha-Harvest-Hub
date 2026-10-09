import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { supabaseAdmin } from '../config/supabase';
import { sendSuccess } from '../utils/response';
import { AppError } from '../utils/AppError';

const router = Router();
router.use(authenticate);

// GET notifications for current user
router.get('/', async (req: any, res, next) => {
  try {
    const { page = '1', limit = '20', unread_only } = req.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const offset = (pageNum - 1) * limitNum;

    let query = supabaseAdmin
      .from('notifications')
      .select('*', { count: 'exact' })
      .eq('recipient_id', req.user.id);

    if (unread_only === 'true') query = query.eq('is_read', false);

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limitNum - 1);

    if (error) throw new AppError(error.message, 500);

    const { count: unreadTotal } = await supabaseAdmin
      .from('notifications').select('id', { count: 'exact', head: true })
      .eq('recipient_id', req.user.id).eq('is_read', false);

    res.json({
      success: true, data: data || [],
      meta: { page: pageNum, limit: limitNum, total: count || 0,
        unread_count: unreadTotal || 0 }
    });
  } catch (e) { next(e); }
});

// PATCH mark notification as read
router.patch('/:id/read', async (req: any, res, next) => {
  try {
    const { error } = await supabaseAdmin
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .eq('recipient_id', req.user.id);
    if (error) throw new AppError(error.message, 500);
    sendSuccess(res, { message: 'Notification marked as read' });
  } catch (e) { next(e); }
});

// PATCH mark all as read
router.patch('/read-all', async (req: any, res, next) => {
  try {
    const { error } = await supabaseAdmin
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('recipient_id', req.user.id)
      .eq('is_read', false);
    if (error) throw new AppError(error.message, 500);
    sendSuccess(res, { message: 'All notifications marked as read' });
  } catch (e) { next(e); }
});

export default router;
