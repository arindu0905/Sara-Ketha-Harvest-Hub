import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import { supabaseAdmin } from '../config/supabase';
import { sendSuccess } from '../utils/response';
import { AppError } from '../utils/AppError';

const router = Router();
router.use(authenticate);

// GET warehouses
router.get('/', async (_req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('warehouses')
      .select('*, storage_locations(*), collection_centres!centre_id(name)')
      .eq('is_active', true).order('name');
    if (error) throw new AppError(error.message, 500);
    sendSuccess(res, { data: data || [] });
  } catch (e) { next(e); }
});

// POST create warehouse
router.post('/', requireRole('inventory_manager', 'administrator'), async (req: any, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('warehouses')
      .insert({ ...req.body, created_by: req.user.id })
      .select().single();
    if (error) throw new AppError(error.message, 500);
    sendSuccess(res, { data, statusCode: 201, message: 'Warehouse created' });
  } catch (e) { next(e); }
});

// GET deliveries
router.get('/deliveries', async (_req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('delivery_schedules')
      .select(`*, transport_vehicles!vehicle_id(plate_number, vehicle_type), drivers!driver_id(full_name), purchase_orders!order_id(order_no, buyers!buyer_id(company_name))`)
      .order('scheduled_date', { ascending: false });
    if (error) throw new AppError(error.message, 500);
    sendSuccess(res, { data: data || [] });
  } catch (e) { next(e); }
});

// POST create delivery schedule
router.post('/deliveries', requireRole('transport_coordinator', 'administrator'), async (req: any, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('delivery_schedules')
      .insert({ ...req.body, schedule_no: `SCH-${Date.now()}`, created_by: req.user.id })
      .select().single();
    if (error) throw new AppError(error.message, 500);
    sendSuccess(res, { data, statusCode: 201, message: 'Delivery scheduled' });
  } catch (e) { next(e); }
});

export default router;
