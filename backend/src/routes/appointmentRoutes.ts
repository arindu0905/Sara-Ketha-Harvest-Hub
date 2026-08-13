import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { supabaseAdmin } from '../config/supabase';
import { sendSuccess } from '../utils/response';
import { AppError } from '../utils/AppError';

const router = Router();
router.use(authenticate);

// GET all appointments
router.get('/', async (req, res, next) => {
  try {
    const { status, centre_id, farmer_id, date } = req.query as Record<string, string>;
    let query = supabaseAdmin
      .from('delivery_appointments')
      .select(`
        *, farmers!farmer_id(full_name, farmer_code, phone),
        crop_categories!category_id(name),
        collection_centres!centre_id(name)
      `);

    if (status) query = query.eq('status', status);
    if (centre_id) query = query.eq('centre_id', centre_id);
    if (farmer_id) query = query.eq('farmer_id', farmer_id);
    if (date) query = query.eq('scheduled_date', date);

    const { data, error } = await query.order('scheduled_date', { ascending: true });
    if (error) throw new AppError(error.message, 500);
    sendSuccess(res, { data: data || [] });
  } catch (e) { next(e); }
});

// POST create appointment
router.post('/', async (req: any, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('delivery_appointments')
      .insert({
        ...req.body,
        reference_no: `APT-${Date.now()}`,
        status: 'scheduled',
        created_by: req.user?.id,
      })
      .select()
      .single();
    if (error) throw new AppError(error.message, 500);
    sendSuccess(res, { data, statusCode: 201, message: 'Appointment scheduled' });
  } catch (e) { next(e); }
});

// GET appointment by id
router.get('/:id', async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('delivery_appointments')
      .select(`*, farmers!farmer_id(*), crop_categories!category_id(*), collection_centres!centre_id(*)`)
      .eq('id', req.params.id).single();
    if (error || !data) throw new AppError('Appointment not found', 404);
    sendSuccess(res, { data });
  } catch (e) { next(e); }
});

// PATCH update appointment status
router.patch('/:id/status', async (req: any, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('delivery_appointments')
      .update({ status: req.body.status })
      .eq('id', req.params.id).select().single();
    if (error) throw new AppError(error.message, 500);
    sendSuccess(res, { data, message: 'Appointment updated' });
  } catch (e) { next(e); }
});

export default router;
