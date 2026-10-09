import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import { supabaseAdmin } from '../config/supabase';
import { sendSuccess } from '../utils/response';
import { AppError } from '../utils/AppError';
import { assertDriverAndVehicleFree, findBusyResources, ACTIVE_DELIVERY_STATUSES } from '../services/deliveryAvailability';
import { getBuyerIdForProfile } from '../services/access';
import { notifyUser } from '../services/notify';

const DELIVERY_VIEWERS = ['administrator','manager','transport_coordinator','inventory_manager','finance_officer','buyer'];
const DELIVERY_STATUSES = ['scheduled','in_transit','arrived','delivered','failed','cancelled'];



const router = Router();
router.use(authenticate);

// ─── Auxiliary: Get Orders Available for Delivery ─────────────────────────────
router.get('/orders', requireRole('administrator','manager','transport_coordinator','inventory_manager'), async (_req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('purchase_orders')
      .select('id, order_no, total_amount_lkr, status, delivery_address, created_at, buyers!buyer_id(company_name, contact_person, phone)')
      .in('status', ['approved', 'stock_reserved', 'payment_pending', 'paid', 'preparing'])
      .order('created_at', { ascending: false });

    if (error) throw new AppError(error.message, 500);
    sendSuccess(res, { data: data || [] });
  } catch (e) { next(e); }
});

// ─── Fleet Vehicles CRUD ───────────────────────────────────────────────────────
router.get('/vehicles', requireRole('administrator','manager','transport_coordinator'), async (_req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('transport_vehicles')
      .select('*, collection_centres!centre_id(name, district)')
      .order('plate_number');

    if (error) throw new AppError(error.message, 500);
    sendSuccess(res, { data: data || [] });
  } catch (e) { next(e); }
});

router.post('/vehicles', requireRole('transport_coordinator', 'administrator'), async (req: any, res, next) => {
  try {
    const { plate_number, vehicle_type, capacity_kg, centre_id, is_active = true } = req.body;
    if (!plate_number || !vehicle_type) {
      throw new AppError('Plate number and vehicle type are required', 400);
    }

    const { data, error } = await supabaseAdmin
      .from('transport_vehicles')
      .insert({
        plate_number,
        vehicle_type,
        capacity_kg: capacity_kg ? parseFloat(capacity_kg) : null,
        centre_id: centre_id || null,
        is_active,
        created_by: req.user.id,
      })
      .select('*, collection_centres!centre_id(name, district)')
      .single();

    if (error) throw new AppError(error.message, 400);
    sendSuccess(res, { data, statusCode: 201, message: 'Vehicle added successfully' });
  } catch (e) { next(e); }
});

router.put('/vehicles/:id', requireRole('transport_coordinator', 'administrator'), async (req: any, res, next) => {
  try {
    const { plate_number, vehicle_type, capacity_kg, centre_id, is_active } = req.body;
    const { data, error } = await supabaseAdmin
      .from('transport_vehicles')
      .update({
        ...(plate_number && { plate_number }),
        ...(vehicle_type && { vehicle_type }),
        ...(capacity_kg !== undefined && { capacity_kg: capacity_kg ? parseFloat(capacity_kg) : null }),
        ...(centre_id !== undefined && { centre_id: centre_id || null }),
        ...(is_active !== undefined && { is_active }),
      })
      .eq('id', req.params.id)
      .select('*, collection_centres!centre_id(name, district)')
      .single();

    if (error) throw new AppError(error.message, 500);
    sendSuccess(res, { data, message: 'Vehicle updated successfully' });
  } catch (e) { next(e); }
});

router.delete('/vehicles/:id', requireRole('transport_coordinator', 'administrator'), async (req: any, res, next) => {
  try {
    const { error } = await supabaseAdmin
      .from('transport_vehicles')
      .delete()
      .eq('id', req.params.id);

    if (error) throw new AppError('Cannot delete vehicle assigned to deliveries. Consider setting inactive instead.', 400);
    sendSuccess(res, { message: 'Vehicle deleted successfully' });
  } catch (e) { next(e); }
});

// ─── Drivers CRUD ─────────────────────────────────────────────────────────────
router.get('/drivers', requireRole('administrator','manager','transport_coordinator'), async (_req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('drivers')
      .select('*, collection_centres!centre_id(name, district)')
      .order('full_name');

    if (error) throw new AppError(error.message, 500);
    sendSuccess(res, { data: data || [] });
  } catch (e) { next(e); }
});

router.post('/drivers', requireRole('transport_coordinator', 'administrator'), async (req: any, res, next) => {
  try {
    const { full_name, nic_number, phone, license_no, centre_id, is_active = true } = req.body;
    if (!full_name || !nic_number || !phone || !license_no) {
      throw new AppError('Full name, NIC, phone, and license number are required', 400);
    }

    const { data, error } = await supabaseAdmin
      .from('drivers')
      .insert({
        full_name,
        nic_number,
        phone,
        license_no,
        centre_id: centre_id || null,
        is_active,
        created_by: req.user.id,
      })
      .select('*, collection_centres!centre_id(name, district)')
      .single();

    if (error) throw new AppError(error.message, 400);
    sendSuccess(res, { data, statusCode: 201, message: 'Driver registered successfully' });
  } catch (e) { next(e); }
});

router.put('/drivers/:id', requireRole('transport_coordinator', 'administrator'), async (req: any, res, next) => {
  try {
    const { full_name, nic_number, phone, license_no, centre_id, is_active } = req.body;
    const { data, error } = await supabaseAdmin
      .from('drivers')
      .update({
        ...(full_name && { full_name }),
        ...(nic_number && { nic_number }),
        ...(phone && { phone }),
        ...(license_no && { license_no }),
        ...(centre_id !== undefined && { centre_id: centre_id || null }),
        ...(is_active !== undefined && { is_active }),
      })
      .eq('id', req.params.id)
      .select('*, collection_centres!centre_id(name, district)')
      .single();

    if (error) throw new AppError(error.message, 500);
    sendSuccess(res, { data, message: 'Driver updated successfully' });
  } catch (e) { next(e); }
});

router.delete('/drivers/:id', requireRole('transport_coordinator', 'administrator'), async (req: any, res, next) => {
  try {
    const { error } = await supabaseAdmin
      .from('drivers')
      .delete()
      .eq('id', req.params.id);

    if (error) throw new AppError('Cannot delete driver assigned to deliveries. Consider setting inactive instead.', 400);
    sendSuccess(res, { message: 'Driver deleted successfully' });
  } catch (e) { next(e); }
});

// ─── Delivery Schedules CRUD ──────────────────────────────────────────────────
router.get('/', requireRole(...DELIVERY_VIEWERS), async (req: any, res, next) => {
  try {
    const { status, search } = req.query as Record<string, string>;
    let query = supabaseAdmin
      .from('delivery_schedules')
      .select(`
        *,
        transport_vehicles!vehicle_id(id, plate_number, vehicle_type, capacity_kg),
        drivers!driver_id(id, full_name, phone, license_no),
        purchase_orders!order_id(id, order_no, buyer_id, total_amount_lkr, delivery_address, buyers!buyer_id(company_name, contact_person, phone))
      `);

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }
    if (search) {
      query = query.or(`schedule_no.ilike.%${search}%,delivery_address.ilike.%${search}%,pickup_address.ilike.%${search}%`);
    }

    const { data, error } = await query.order('scheduled_date', { ascending: false });
    if (error) throw new AppError(error.message, 500);
    let rows: any[] = data || [];
    if (req.user.role === 'buyer') {
      const buyerId = await getBuyerIdForProfile(req.user.id);
      rows = rows.filter(r => {
        const po = Array.isArray(r.purchase_orders) ? r.purchase_orders[0] : r.purchase_orders;
        return buyerId && po?.buyer_id === buyerId;
      });
    }
    sendSuccess(res, { data: rows });
  } catch (e) { next(e); }
});

router.post('/', requireRole('transport_coordinator', 'administrator'), async (req: any, res, next) => {
  try {
    const {
      order_id,
      vehicle_id,
      driver_id,
      pickup_address,
      delivery_address,
      scheduled_date,
      scheduled_time,
      notes,
    } = req.body;

    if (!delivery_address || !scheduled_date) {
      throw new AppError('Delivery address and scheduled date are required', 400);
    }

    // one driver / one vehicle can only be on one delivery at a time
    await assertDriverAndVehicleFree({ vehicle_id: vehicle_id || null, driver_id: driver_id || null, scheduled_date, scheduled_time: scheduled_time || null });

    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const randSuffix = Math.floor(1000 + Math.random() * 9000);
    const schedule_no = `SCH-${dateStr}-${randSuffix}`;

    const { data, error } = await supabaseAdmin
      .from('delivery_schedules')
      .insert({
        schedule_no,
        order_id: order_id || null,
        vehicle_id: vehicle_id || null,
        driver_id: driver_id || null,
        coordinator_id: req.user.id,
        pickup_address: pickup_address || 'Central Storage Hub, Colombo',
        delivery_address,
        scheduled_date,
        scheduled_time: scheduled_time || null,
        status: 'scheduled',
        notes: notes || null,
        created_by: req.user.id,
      })
      .select(`
        *,
        transport_vehicles!vehicle_id(id, plate_number, vehicle_type, capacity_kg),
        drivers!driver_id(id, full_name, phone, license_no),
        purchase_orders!order_id(id, order_no, total_amount_lkr, delivery_address, buyers!buyer_id(company_name, contact_person, phone))
      `)
      .single();

    if (error) throw new AppError(error.message, 500);

    // Add initial tracking entry
    await supabaseAdmin.from('delivery_tracking').insert({
      schedule_id: data.id,
      status: 'scheduled',
      location: pickup_address || 'Central Storage Hub',
      notes: 'Delivery dispatch scheduled',
      recorded_by: req.user.id,
    });

    sendSuccess(res, { data, statusCode: 201, message: 'Delivery schedule created successfully' });
  } catch (e) { next(e); }
});

// GET /api/deliveries/availability?date=YYYY-MM-DD&time=HH:MM&exclude=<scheduleId>
// Which vehicles and drivers are already busy at that date and time (used to grey them out in the form).
router.get('/availability', requireRole('transport_coordinator', 'administrator', 'manager'), async (req: any, res, next) => {
  try {
    const { date, time, exclude } = req.query as Record<string, string>;
    if (!date || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(date)) throw new AppError('A valid date (YYYY-MM-DD) is required', 400);
    const busy = await findBusyResources(date, time || null, exclude || undefined);
    sendSuccess(res, { data: busy });
  } catch (e) { next(e); }
});

router.get('/:id', requireRole(...DELIVERY_VIEWERS), async (req: any, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('delivery_schedules')
      .select(`
        *,
        transport_vehicles!vehicle_id(*),
        drivers!driver_id(*),
        purchase_orders!order_id(*, buyers!buyer_id(*)),
        delivery_tracking(*)
      `)
      .eq('id', req.params.id)
      .single();

    if (error || !data) throw new AppError('Delivery schedule not found', 404);
    if (req.user.role === 'buyer') {
      const buyerId = await getBuyerIdForProfile(req.user.id);
      const po: any = Array.isArray((data as any).purchase_orders) ? (data as any).purchase_orders[0] : (data as any).purchase_orders;
      if (!buyerId || po?.buyer_id !== buyerId) throw new AppError('You can only track your own deliveries', 403);
      // buyers do not need driver identity documents / vehicle internals
      delete (data as any).drivers;
    }
    sendSuccess(res, { data });
  } catch (e) { next(e); }
});

router.put('/:id', requireRole('transport_coordinator', 'administrator'), async (req: any, res, next) => {
  try {
    const {
      order_id,
      vehicle_id,
      driver_id,
      pickup_address,
      delivery_address,
      scheduled_date,
      scheduled_time,
      status,
      notes,
    } = req.body;

    if (status && !DELIVERY_STATUSES.includes(status)) throw new AppError('Invalid delivery status', 400);

    const { data: current } = await supabaseAdmin.from('delivery_schedules')
      .select('vehicle_id, driver_id, scheduled_date, scheduled_time, status').eq('id', req.params.id).maybeSingle();
    if (!current) throw new AppError('Delivery schedule not found', 404);
    const finalState = {
      vehicle_id: vehicle_id !== undefined ? (vehicle_id || null) : current.vehicle_id,
      driver_id: driver_id !== undefined ? (driver_id || null) : current.driver_id,
      scheduled_date: scheduled_date || current.scheduled_date,
      scheduled_time: scheduled_time !== undefined ? (scheduled_time || null) : current.scheduled_time,
      status: status || current.status,
    };
    if (ACTIVE_DELIVERY_STATUSES.includes(finalState.status)) {
      await assertDriverAndVehicleFree({ ...finalState, excludeScheduleId: req.params.id });
    }

    const { data, error } = await supabaseAdmin
      .from('delivery_schedules')
      .update({
        ...(order_id !== undefined && { order_id: order_id || null }),
        ...(vehicle_id !== undefined && { vehicle_id: vehicle_id || null }),
        ...(driver_id !== undefined && { driver_id: driver_id || null }),
        ...(pickup_address && { pickup_address }),
        ...(delivery_address && { delivery_address }),
        ...(scheduled_date && { scheduled_date }),
        ...(scheduled_time !== undefined && { scheduled_time: scheduled_time || null }),
        ...(status && { status }),
        ...(notes !== undefined && { notes }),
        updated_at: new Date().toISOString(),
      })
      .eq('id', req.params.id)
      .select(`
        *,
        transport_vehicles!vehicle_id(id, plate_number, vehicle_type, capacity_kg),
        drivers!driver_id(id, full_name, phone, license_no),
        purchase_orders!order_id(id, order_no, total_amount_lkr, delivery_address, buyers!buyer_id(company_name, contact_person, phone))
      `)
      .single();

    if (error) throw new AppError(error.message, 500);
    sendSuccess(res, { data, message: 'Delivery schedule updated successfully' });
  } catch (e) { next(e); }
});

router.patch('/:id/status', requireRole('transport_coordinator', 'administrator'), async (req: any, res, next) => {
  try {
    const { status, location, notes } = req.body;

    if (!DELIVERY_STATUSES.includes(status)) {
      throw new AppError(`Status must be one of: ${DELIVERY_STATUSES.join(', ')}`, 400);
    }
    const { data: existing } = await supabaseAdmin.from('delivery_schedules').select('status, vehicle_id, driver_id').eq('id', req.params.id).maybeSingle();
    if (!existing) throw new AppError('Delivery schedule not found', 404);
    if (['delivered', 'cancelled'].includes((existing as any).status)) {
      throw new AppError(`Delivery is already ${(existing as any).status} and cannot change`, 409);
    }
    if (ACTIVE_DELIVERY_STATUSES.includes(status) && !ACTIVE_DELIVERY_STATUSES.includes((existing as any).status)) {
      await assertDriverAndVehicleFree({ vehicle_id: (existing as any).vehicle_id, driver_id: (existing as any).driver_id, excludeScheduleId: req.params.id });
    }

    // Insert tracking event
    await supabaseAdmin.from('delivery_tracking').insert({
      schedule_id: req.params.id,
      status,
      location: location || null,
      notes: notes || `Status changed to ${status}`,
      recorded_by: req.user.id,
    });

    const { data, error } = await supabaseAdmin
      .from('delivery_schedules')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select(`
        *,
        transport_vehicles!vehicle_id(id, plate_number, vehicle_type, capacity_kg),
        drivers!driver_id(id, full_name, phone, license_no),
        purchase_orders!order_id(id, order_no, status, total_amount_lkr)
      `)
      .single();

    if (error) throw new AppError(error.message, 500);

    // Sync order status when delivered
    if (status === 'delivered' && data.order_id) {
      await supabaseAdmin.from('purchase_orders').update({ status: 'delivered' }).eq('id', data.order_id);
    }

    if (data.order_id && ['in_transit', 'delivered', 'failed'].includes(status)) {
      const { data: po } = await supabaseAdmin.from('purchase_orders')
        .select('order_no, buyers!buyer_id(profile_id)').eq('id', data.order_id).maybeSingle();
      const b: any = Array.isArray((po as any)?.buyers) ? (po as any).buyers[0] : (po as any)?.buyers;
      await notifyUser(b?.profile_id, status === 'delivered' ? 'delivery_completed' : 'delivery_dispatched',
        status === 'delivered' ? 'Order delivered' : status === 'failed' ? 'Delivery issue' : 'Order on the way',
        `Order ${(po as any)?.order_no}: delivery is now ${status.replace('_', ' ')}.`, 'delivery_schedule', data.id);
    }
    sendSuccess(res, { data, message: `Delivery status updated to ${status}` });
  } catch (e) { next(e); }
});

router.delete('/:id', requireRole('transport_coordinator', 'administrator'), async (req: any, res, next) => {
  try {
    // Delete related tracking first
    await supabaseAdmin.from('delivery_tracking').delete().eq('schedule_id', req.params.id);

    const { error } = await supabaseAdmin
      .from('delivery_schedules')
      .delete()
      .eq('id', req.params.id);

    if (error) throw new AppError(error.message, 500);
    sendSuccess(res, { message: 'Delivery schedule deleted successfully' });
  } catch (e) { next(e); }
});

export default router;

