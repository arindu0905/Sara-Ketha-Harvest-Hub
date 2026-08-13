import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import { supabaseAdmin } from '../config/supabase';
import { sendSuccess } from '../utils/response';
import { AppError } from '../utils/AppError';

const router = Router();
router.use(authenticate);

// Delivery schedules
router.get('/', async (_req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('delivery_schedules')
      .select(`*, transport_vehicles!vehicle_id(*), drivers!driver_id(*), purchase_orders!order_id(order_no, buyers!buyer_id(company_name))`)
      .order('scheduled_date');
    if (error) throw new AppError(error.message, 500);
    sendSuccess(res, { data: data || [] });
  } catch (e) { next(e); }
});

router.post('/', requireRole('transport_coordinator', 'administrator'), async (req: any, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('delivery_schedules')
      .insert({ ...req.body, schedule_no: `SCH-${Date.now()}`, created_by: req.user.id })
      .select().single();
    if (error) throw new AppError(error.message, 500);
    sendSuccess(res, { data, statusCode: 201 });
  } catch (e) { next(e); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('delivery_schedules')
      .select(`*, transport_vehicles!vehicle_id(*), drivers!driver_id(*), delivery_tracking(*)`)
      .eq('id', req.params.id).single();
    if (error || !data) throw new AppError('Delivery not found', 404);
    sendSuccess(res, { data });
  } catch (e) { next(e); }
});

router.patch('/:id/status', requireRole('transport_coordinator', 'administrator'), async (req: any, res, next) => {
  try {
    const { status, location, notes } = req.body;

    await supabaseAdmin.from('delivery_tracking').insert({
      schedule_id: req.params.id, status, location, notes, recorded_by: req.user.id
    });

    const { data, error } = await supabaseAdmin
      .from('delivery_schedules')
      .update({ status })
      .eq('id', req.params.id).select().single();
    if (error) throw new AppError(error.message, 500);

    // Update order status when delivered
    if (status === 'delivered' && data.order_id) {
      await supabaseAdmin.from('purchase_orders').update({ status: 'delivered' }).eq('id', data.order_id);
    }

    sendSuccess(res, { data, message: 'Delivery status updated' });
  } catch (e) { next(e); }
});

export default router;
