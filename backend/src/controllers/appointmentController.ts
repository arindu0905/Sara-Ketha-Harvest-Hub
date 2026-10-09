import { Response, NextFunction } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { sendSuccess } from '../utils/response';
import { AppError } from '../utils/AppError';
import { AuthenticatedRequest } from '../middleware/auth';
import { getFarmerIdForUser } from '../services/access';
import { notifyUser, notifyRole } from '../services/notify';

const TRANSITIONS: Record<string, string[]> = {
  scheduled: ['confirmed', 'cancelled', 'no_show'],
  confirmed: ['arrived', 'cancelled', 'no_show'],
  arrived: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
  no_show: [],
};

const iso = (d: Date) => d.toISOString().split('T')[0];

async function getSetting(key: string, fallback: number): Promise<number> {
  const { data } = await supabaseAdmin.from('system_settings').select('value').eq('key', key).maybeSingle();
  const n = Number(data?.value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** Throws unless the farmer is verified and in good standing (E1-US4). */
export async function assertFarmerVerified(farmerId: string): Promise<{ id: string; profile_id: string | null; full_name: string }> {
  const { data: f } = await supabaseAdmin
    .from('farmers').select('id, profile_id, full_name, verification_status, account_status').eq('id', farmerId).maybeSingle();
  if (!f) throw new AppError('Farmer not found', 404);
  if (f.verification_status !== 'verified') {
    throw new AppError('This farmer registration has not been verified yet. Verification is required before using collection services.', 403);
  }
  if (['suspended', 'inactive'].includes(f.account_status)) {
    throw new AppError(`This farmer account is ${f.account_status}`, 403);
  }
  return f as any;
}

/** GET /api/appointments */
export const listAppointments = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { status, centre_id, farmer_id, date, from, to } = req.query as Record<string, string>;
    let query = supabaseAdmin
      .from('delivery_appointments')
      .select(`
        *, farmers!farmer_id(full_name, farmer_code, phone),
        crop_categories!category_id(name, name_sinhala, name_tamil),
        crop_varieties!variety_id(name),
        collection_centres!centre_id(name)
      `);

    if (req.user?.role === 'farmer') {
      const own = await getFarmerIdForUser(req.user.id);
      if (!own) { sendSuccess(res, { data: [] }); return; }
      query = query.eq('farmer_id', own);
    } else if (farmer_id) query = query.eq('farmer_id', farmer_id);

    if (status) query = query.eq('status', status);
    if (centre_id) query = query.eq('centre_id', centre_id);
    if (date) query = query.eq('scheduled_date', date);
    if (from) query = query.gte('scheduled_date', from);
    if (to) query = query.lte('scheduled_date', to);

    const { data, error } = await query.order('scheduled_date', { ascending: true });
    if (error) throw new AppError(error.message, 500);
    sendSuccess(res, { data: data || [] });
  } catch (e) { next(e); }
};

/** POST /api/appointments  (farmer for self, officer for any verified farmer) */
export const createAppointment = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { centre_id, category_id, variety_id, scheduled_date, scheduled_time, notes } = req.body;
    const qty = Number(req.body.estimated_qty_kg);

    let farmerId: string | null = req.body.farmer_id || null;
    if (req.user?.role === 'farmer') {
      farmerId = await getFarmerIdForUser(req.user.id);
      if (!farmerId) throw new AppError('Your farmer profile was not found', 404);
    }
    if (!farmerId) throw new AppError('farmer_id is required', 400);
    if (!centre_id || !category_id || !scheduled_date) throw new AppError('Centre, crop category and delivery date are required', 400);
    if (!Number.isFinite(qty) || qty <= 0) throw new AppError('Estimated quantity must be greater than zero', 400);
    if (qty > 100000) throw new AppError('Estimated quantity looks too large – please check the value', 400);

    const farmer = await assertFarmerVerified(farmerId);

    const earliest = new Date(); earliest.setHours(0, 0, 0, 0);
    if (req.user?.role === 'farmer') earliest.setDate(earliest.getDate() + 1);
    if (new Date(`${scheduled_date}T00:00:00`) < earliest) {
      throw new AppError(req.user?.role === 'farmer' ? 'Deliveries must be scheduled at least one day in advance' : 'Delivery date cannot be in the past', 400);
    }
    const latest = new Date(); latest.setDate(latest.getDate() + 90);
    if (new Date(`${scheduled_date}T00:00:00`) > latest) throw new AppError('Deliveries can be scheduled at most 90 days ahead', 400);

    const { data: centre } = await supabaseAdmin.from('collection_centres').select('id, is_active').eq('id', centre_id).maybeSingle();
    if (!centre || centre.is_active === false) throw new AppError('Collection centre not found or inactive', 400);

    const { data: dup } = await supabaseAdmin.from('delivery_appointments').select('id')
      .eq('farmer_id', farmerId).eq('centre_id', centre_id).eq('category_id', category_id).eq('scheduled_date', scheduled_date)
      .in('status', ['scheduled', 'confirmed']).maybeSingle();
    if (dup) throw new AppError('You already have an appointment for this crop, centre and date', 409);

    const cap = await getSetting('max_appointments_per_centre_per_day', 60);
    const { count } = await supabaseAdmin.from('delivery_appointments').select('id', { count: 'exact', head: true })
      .eq('centre_id', centre_id).eq('scheduled_date', scheduled_date).in('status', ['scheduled', 'confirmed']);
    if ((count || 0) >= cap) throw new AppError('This centre is fully booked on that date. Please choose another day.', 409);

    let data: any = null; let lastErr: any = null;
    for (let attempt = 0; attempt < 5 && !data; attempt++) {
      const ref = `APT-${iso(new Date()).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;
      const { data: row, error } = await supabaseAdmin.from('delivery_appointments').insert({
        reference_no: ref, farmer_id: farmerId, centre_id, category_id, variety_id: variety_id || null,
        scheduled_date, scheduled_time: scheduled_time || null, estimated_qty_kg: qty, notes: notes || null,
        status: 'scheduled', created_by: req.user?.id,
      }).select().single();
      if (!error) data = row; else if (error.code === '23505') lastErr = error; else throw new AppError(error.message, 500);
    }
    if (!data) throw new AppError(lastErr?.message || 'Could not allocate a reference number', 500);

    await notifyRole('collection_centre_officer', 'appointment_confirmation', 'New delivery appointment',
      `${farmer.full_name} booked ${qty} kg for ${scheduled_date} (${data.reference_no}).`, 'delivery_appointment', data.id);
    if (req.user?.role !== 'farmer') {
      await notifyUser(farmer.profile_id, 'appointment_confirmation', 'Delivery appointment booked',
        `An appointment ${data.reference_no} was booked for you on ${scheduled_date}.`, 'delivery_appointment', data.id);
    }
    sendSuccess(res, { data, statusCode: 201, message: 'Appointment scheduled' });
  } catch (e) { next(e); }
};

/** GET /api/appointments/:id */
export const getAppointment = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { data, error } = await supabaseAdmin
      .from('delivery_appointments')
      .select(`*, farmers!farmer_id(id, full_name, farmer_code, phone), crop_categories!category_id(*), collection_centres!centre_id(*)`)
      .eq('id', req.params.id).single();
    if (error || !data) throw new AppError('Appointment not found', 404);
    if (req.user?.role === 'farmer') {
      const own = await getFarmerIdForUser(req.user.id);
      if (own !== (data as any).farmer_id) throw new AppError('You can only view your own appointments', 403);
    }
    sendSuccess(res, { data });
  } catch (e) { next(e); }
};

/** PATCH /api/appointments/:id/status */
export const updateAppointmentStatus = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { status } = req.body;
    if (!status || !(status in TRANSITIONS)) throw new AppError('Invalid appointment status', 400);

    const { data: appt } = await supabaseAdmin.from('delivery_appointments')
      .select('id, status, farmer_id, reference_no, scheduled_date, farmers!farmer_id(profile_id)').eq('id', req.params.id).maybeSingle();
    if (!appt) throw new AppError('Appointment not found', 404);

    if (req.user?.role === 'farmer') {
      const own = await getFarmerIdForUser(req.user.id);
      if (own !== appt.farmer_id) throw new AppError('You can only change your own appointments', 403);
      if (status !== 'cancelled') throw new AppError('Farmers can only cancel appointments', 403);
    }
    if (!TRANSITIONS[appt.status]?.includes(status)) {
      throw new AppError(`Appointment is ${appt.status} and cannot be changed to ${status}`, 409);
    }

    const { data, error } = await supabaseAdmin.from('delivery_appointments')
      .update({ status, updated_at: new Date().toISOString() }).eq('id', req.params.id).select().single();
    if (error) throw new AppError(error.message, 500);

    const farmerProfile = (Array.isArray((appt as any).farmers) ? (appt as any).farmers[0] : (appt as any).farmers)?.profile_id;
    if (req.user?.role !== 'farmer' && ['confirmed', 'cancelled', 'no_show'].includes(status)) {
      await notifyUser(farmerProfile, 'appointment_confirmation', `Appointment ${status.replace('_', ' ')}`,
        `Your delivery appointment ${appt.reference_no} for ${appt.scheduled_date} was ${status.replace('_', ' ')}.`, 'delivery_appointment', appt.id);
    }
    sendSuccess(res, { data, message: 'Appointment updated' });
  } catch (e) { next(e); }
};
