import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import { notifyUser, notifyRole } from '../services/notify';
import { supabaseAdmin } from '../config/supabase';
import { sendSuccess, paginatedResponse } from '../utils/response';
import { AppError } from '../utils/AppError';

const router = Router();

const CATEGORIES = ['incorrect_weight','incorrect_grade','incorrect_payment','delayed_payment','delivery_issue','product_quality_issue','system_issue','other'];
const STATUSES = ['submitted','under_review','assigned','in_progress','resolved','rejected','closed'];
const STAFF = ['administrator','manager','finance_officer','inventory_manager','quality_inspector','field_officer','transport_coordinator'];
const isStaff = (role: string) => STAFF.includes(role);

async function loadComplaint(req: any, id: string) {
  const { data } = await supabaseAdmin.from('complaints').select('id, complaint_no, submitted_by, status').eq('id', id).maybeSingle();
  if (!data) throw new AppError('Complaint not found', 404);
  if (!isStaff(req.user.role) && data.submitted_by !== req.user.id) throw new AppError('You can only access your own complaints', 403);
  return data as any;
}

router.use(authenticate);

// The buyer complaints feature has been removed: buyers can no longer use this API.
router.use((req: any, _res, next) => (req.user?.role === 'buyer' ? next(new AppError('Complaints are not available for buyer accounts', 403)) : next()));

// GET complaints
router.get('/', async (req: any, res, next) => {
  try {
    const { status, page = '1', limit = '20' } = req.query as Record<string, string>;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;

    let query = supabaseAdmin
      .from('complaints')
      .select(`*, submitter:profiles!submitted_by(full_name, email, role), assignee:profiles!assigned_to(full_name)`, { count: 'exact' });

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
    const { category, subject, description, evidence_url } = req.body || {};
    if (!CATEGORIES.includes(category)) throw new AppError('Invalid complaint category', 400);
    if (typeof subject !== 'string' || subject.trim().length < 3) throw new AppError('Subject is required', 400);
    if (typeof description !== 'string' || description.trim().length < 10) throw new AppError('Please describe the issue (at least 10 characters)', 400);
    const { data: cmpNo } = await supabaseAdmin.rpc('generate_complaint_no');
    const { data, error } = await supabaseAdmin
      .from('complaints')
      .insert({
        complaint_no: cmpNo || `CMP-${Date.now()}`,
        submitted_by: req.user.id,
        category, subject: subject.trim().slice(0, 200), description: description.trim().slice(0, 4000),
        evidence_url: typeof evidence_url === 'string' ? evidence_url : null,
        status: 'submitted',
      })
      .select().single();
    if (error) throw new AppError(error.message, 400);
    await notifyRole('administrator', 'complaint_update', 'New complaint', `${data.complaint_no}: ${data.subject}`, 'complaint', data.id).catch(() => {});
    sendSuccess(res, { data, statusCode: 201, message: 'Complaint submitted' });
  } catch (e) { next(e); }
});

// GET complaint by id
router.get('/:id', async (req: any, res, next) => {
  try {
    await loadComplaint(req, req.params.id);
    const { data, error } = await supabaseAdmin
      .from('complaints')
      .select(`*, complaint_comments(*, profiles!author_id(full_name, role))`)
      .eq('id', req.params.id).single();
    if (error || !data) throw new AppError('Complaint not found', 404);
    if (!isStaff(req.user.role)) {
      (data as any).complaint_comments = ((data as any).complaint_comments || []).filter((c: any) => !c.is_internal);
    }
    sendSuccess(res, { data });
  } catch (e) { next(e); }
});

// PATCH update status (staff only)
router.patch('/:id/status', requireRole(...STAFF), async (req: any, res, next) => {
  try {
    const { status, resolution, assigned_to } = req.body || {};
    if (!STATUSES.includes(status)) throw new AppError('Invalid complaint status', 400);
    const current = await loadComplaint(req, req.params.id);
    if (['closed'].includes(current.status)) throw new AppError('Closed complaints cannot be changed', 409);
    if (['resolved', 'rejected'].includes(status) && !(typeof resolution === 'string' && resolution.trim())) {
      throw new AppError('A resolution note is required to resolve or reject a complaint', 400);
    }
    const updates: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
    if (resolution) updates.resolution = String(resolution).slice(0, 4000);
    if (assigned_to) updates.assigned_to = assigned_to;
    else updates.assigned_to = req.user.id; // whoever works on the complaint is recorded as its handler
    if (status === 'resolved') updates.resolved_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from('complaints').update(updates).eq('id', req.params.id).select().single();
    if (error) throw new AppError(error.message, 400);
    await notifyUser(current.submitted_by, 'complaint_update', 'Complaint update',
      `Your complaint ${current.complaint_no} is now ${status.replace('_', ' ')}.`, 'complaint', current.id).catch(() => {});
    sendSuccess(res, { data, message: 'Complaint updated' });
  } catch (e) { next(e); }
});

// POST add comment (submitter or staff; only staff may mark internal)
router.post('/:id/comments', async (req: any, res, next) => {
  try {
    const current = await loadComplaint(req, req.params.id);
    const { comment } = req.body || {};
    if (typeof comment !== 'string' || !comment.trim()) throw new AppError('Comment text is required', 400);
    const is_internal = isStaff(req.user.role) && req.body.is_internal === true;
    const { data, error } = await supabaseAdmin
      .from('complaint_comments')
      .insert({ complaint_id: req.params.id, author_id: req.user.id, comment: comment.trim().slice(0, 2000), is_internal })
      .select().single();
    if (error) throw new AppError(error.message, 400);
    if (!is_internal && isStaff(req.user.role) && current.submitted_by !== req.user.id) {
      await notifyUser(current.submitted_by, 'complaint_update', 'New reply on your complaint',
        `${current.complaint_no}: staff added a comment.`, 'complaint', current.id).catch(() => {});
    }
    sendSuccess(res, { data, statusCode: 201, message: 'Comment added' });
  } catch (e) { next(e); }
});

export default router;
