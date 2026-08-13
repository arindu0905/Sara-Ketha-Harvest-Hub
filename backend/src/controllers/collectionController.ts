import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { sendSuccess, paginatedResponse } from '../utils/response';
import { AppError } from '../utils/AppError';
import { AuthenticatedRequest } from '../middleware/auth';

/**
 * POST /api/collections
 * Create a new collection record.
 */
export const createCollection = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { appointment_id, farmer_id, centre_id, category_id, variety_id, vehicle_number, driver_name, notes } = req.body;

    // Generate collection number
    const { data: collNo } = await supabaseAdmin.rpc('generate_collection_no');

    const { data, error } = await supabaseAdmin
      .from('produce_collections')
      .insert({
        collection_no: collNo || `COL-${Date.now()}`,
        appointment_id,
        farmer_id,
        centre_id,
        category_id,
        variety_id,
        vehicle_number,
        driver_name,
        notes,
        status: 'arrived',
        arrived_at: new Date().toISOString(),
        officer_id: req.user?.id,
        created_by: req.user?.id,
      })
      .select(`
        *, farmers!farmer_id(full_name, farmer_code, phone),
        crop_categories!category_id(name),
        collection_centres!centre_id(name)
      `)
      .single();

    if (error) throw new AppError(error.message, 500);
    sendSuccess(res, { data, statusCode: 201, message: 'Collection record created' });
  } catch (e) { next(e); }
};

/**
 * GET /api/collections
 */
export const getCollections = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { page = '1', limit = '20', status, centre_id, farmer_id, from_date, to_date } = req.query as Record<string, string>;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;

    let query = supabaseAdmin
      .from('produce_collections')
      .select(`
        id, collection_no, status, gross_weight_kg, net_weight_kg, created_at,
        farmers!farmer_id(id, full_name, farmer_code),
        crop_categories!category_id(id, name),
        collection_centres!centre_id(id, name),
        quality_inspections(grade, accepted_qty_kg, rejected_qty_kg)
      `, { count: 'exact' });

    if (status) query = query.eq('status', status);
    if (centre_id) query = query.eq('centre_id', centre_id);
    if (farmer_id) query = query.eq('farmer_id', farmer_id);
    if (from_date) query = query.gte('created_at', from_date);
    if (to_date) query = query.lte('created_at', to_date);

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limitNum - 1);

    if (error) throw new AppError(error.message, 500);
    paginatedResponse(res, data || [], { page: pageNum, limit: limitNum, total: count || 0 });
  } catch (e) { next(e); }
};

/**
 * GET /api/collections/:id
 */
export const getCollectionById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { data, error } = await supabaseAdmin
      .from('produce_collections')
      .select(`
        *,
        farmers!farmer_id(id, full_name, farmer_code, phone, district, bank_name),
        crop_categories!category_id(*),
        crop_varieties!variety_id(*),
        collection_centres!centre_id(id, name, address),
        delivery_appointments!appointment_id(id, reference_no, scheduled_date),
        quality_inspections(*, collection_rejections(*)),
        inventory_batches(id, batch_no, status, available_qty_kg),
        farmer_payments(id, payment_no, status, net_amount_lkr)
      `)
      .eq('id', req.params.id)
      .single();

    if (error || !data) throw new AppError('Collection not found', 404);
    sendSuccess(res, { data });
  } catch (e) { next(e); }
};

/**
 * POST /api/collections/:id/weigh
 * Record weighing data.
 */
export const weighCollection = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { gross_weight_kg, container_weight_kg = 0 } = req.body;

    if (gross_weight_kg <= container_weight_kg) {
      throw new AppError('Gross weight must be greater than container weight', 400);
    }

    const { data, error } = await supabaseAdmin
      .from('produce_collections')
      .update({
        gross_weight_kg,
        container_weight_kg,
        status: 'weighed',
        weighed_at: new Date().toISOString(),
        updated_by: req.user?.id,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw new AppError(error.message, 500);
    if (!data) throw new AppError('Collection not found', 404);

    sendSuccess(res, { data, message: `Weighing recorded. Net weight: ${data.net_weight_kg} kg` });
  } catch (e) { next(e); }
};

/**
 * PATCH /api/collections/:id/status
 */
export const updateCollectionStatus = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    const { data, error } = await supabaseAdmin
      .from('produce_collections')
      .update({ status, notes, updated_by: req.user?.id })
      .eq('id', id)
      .select()
      .single();

    if (error) throw new AppError(error.message, 500);
    sendSuccess(res, { data, message: 'Collection status updated' });
  } catch (e) { next(e); }
};

/**
 * POST /api/collections/:id/complete
 * Mark collection as complete and trigger batch creation.
 */
export const completeCollection = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;

    // Verify inspection exists and is approved
    const { data: inspection } = await supabaseAdmin
      .from('quality_inspections')
      .select('*, produce_collections!collection_id(*)')
      .eq('collection_id', id)
      .single();

    if (!inspection) {
      throw new AppError('Quality inspection must be completed before collection can be marked complete', 400);
    }

    if (!inspection.approved_at) {
      throw new AppError('Quality inspection has not been approved yet', 400);
    }

    // Mark collection as added to inventory
    await supabaseAdmin
      .from('produce_collections')
      .update({ status: 'added_to_inventory', updated_by: req.user?.id })
      .eq('id', id);

    sendSuccess(res, { message: 'Collection completed and moved to inventory' });
  } catch (e) { next(e); }
};
