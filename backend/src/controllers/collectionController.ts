import { Response, NextFunction } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { sendSuccess, paginatedResponse } from '../utils/response';
import { AppError } from '../utils/AppError';
import { AuthenticatedRequest } from '../middleware/auth';
import { notifyRole } from '../services/notify';
import { getFarmerIdForUser, assertFarmerAccess } from '../services/access';
import { assertFarmerVerified } from './appointmentController';

/**
 * POST /api/collections
 * Create a new collection record.
 */
export const createCollection = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { appointment_id, farmer_id, centre_id, category_id, variety_id, vehicle_number, driver_name, notes } = req.body;

    // Only verified farmers may deliver produce (E1-US4)
    await assertFarmerVerified(farmer_id);

    // Scheduled delivery: appointment must exist, belong to this farmer and still be open. Walk-ins have no appointment_id.
    if (appointment_id) {
      const { data: appt } = await supabaseAdmin.from('delivery_appointments')
        .select('id, farmer_id, status, centre_id').eq('id', appointment_id).maybeSingle();
      if (!appt) throw new AppError('Appointment not found', 404);
      if (appt.farmer_id !== farmer_id) throw new AppError('This appointment belongs to a different farmer', 409);
      if (!['scheduled', 'confirmed'].includes(appt.status)) throw new AppError(`Appointment is ${appt.status} and cannot be used for a delivery`, 409);
      const { data: dupCol } = await supabaseAdmin.from('produce_collections').select('id').eq('appointment_id', appointment_id).maybeSingle();
      if (dupCol) throw new AppError('A collection has already been registered for this appointment', 409);
    }

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
    if (appointment_id) {
      await supabaseAdmin.from('delivery_appointments').update({ status: 'arrived', updated_at: new Date().toISOString() }).eq('id', appointment_id);
    }
    sendSuccess(res, { data, statusCode: 201, message: appointment_id ? 'Scheduled delivery registered' : 'Walk-in delivery registered' });
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
        officer:profiles!officer_id(full_name, role),
        quality_inspections(id, grade, accepted_qty_kg, rejected_qty_kg, approved_at, inspector:profiles!inspector_id(full_name, role)),
        inventory_batches(id, batch_no),
        collection_receipts(id, receipt_no, status),
        farmer_payments(id, payment_no, status, net_amount_lkr)
      `, { count: 'exact' });

    if (req.user?.role === 'farmer') {
      const own = await getFarmerIdForUser(req.user.id);
      if (!own) { paginatedResponse(res, [], { page: pageNum, limit: limitNum, total: 0 }); return; }
      query = query.eq('farmer_id', own);
    } else if (farmer_id) query = query.eq('farmer_id', farmer_id);
    if (status) query = query.eq('status', status);
    if (centre_id) query = query.eq('centre_id', centre_id);
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
export const getCollectionById = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
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
    await assertFarmerAccess(req, (data as any).farmer_id);
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
    const { gross_weight_kg, container_weight_kg = 0, container_count = 0, container_type } = req.body;

    const gross = Number(gross_weight_kg), tare = Number(container_weight_kg);
    if (!Number.isFinite(gross) || !Number.isFinite(tare) || gross <= 0 || tare < 0) {
      throw new AppError('Gross and container weights must be valid numbers (gross > 0, container >= 0)', 400);
    }
    if (gross <= tare) {
      throw new AppError('Gross weight must be greater than container weight', 400);
    }
    const { data: existingCol } = await supabaseAdmin.from('produce_collections').select('status').eq('id', id).maybeSingle();
    if (!existingCol) throw new AppError('Collection not found', 404);
    if (!['arrived', 'weighed', 'pending_inspection', 'scheduled'].includes(existingCol.status)) {
      throw new AppError(`Weights cannot be changed once a collection is '${existingCol.status}'`, 409);
    }

    const payload: Record<string, any> = {
      gross_weight_kg,
      container_weight_kg,
      container_count,
      container_type,
      status: 'pending_inspection',
      weighed_at: new Date().toISOString(),
      updated_by: req.user?.id,
    };

    let { data, error } = await supabaseAdmin
      .from('produce_collections')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    // Graceful fallback if container_count or container_type columns have not been added via migration yet
    if (error && (error.message.includes('container_count') || error.message.includes('container_type') || error.code === 'PGRST204')) {
      delete payload.container_count;
      delete payload.container_type;

      const retryRes = await supabaseAdmin
        .from('produce_collections')
        .update(payload)
        .eq('id', id)
        .select()
        .single();

      data = retryRes.data;
      error = retryRes.error;
    }

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

    const TRANSITIONS: Record<string, string[]> = {
      scheduled: ['arrived'],
      arrived: ['weighed', 'pending_inspection', 'rejected'],
      weighed: ['pending_inspection', 'under_inspection'],
      pending_inspection: ['under_inspection'],
      under_inspection: ['pending_inspection'],
      accepted: ['added_to_inventory', 'payment_pending'],
      partially_accepted: ['added_to_inventory', 'payment_pending'],
      added_to_inventory: ['payment_pending', 'completed'],
      payment_pending: ['completed'],
    };
    const { data: current } = await supabaseAdmin.from('produce_collections').select('status').eq('id', id).maybeSingle();
    if (!current) throw new AppError('Collection not found', 404);
    if (current.status !== status && !(TRANSITIONS[current.status] || []).includes(status)) {
      throw new AppError(`Collection cannot move from '${current.status}' to '${status}'`, 409);
    }

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

    const apptId = (inspection as any).produce_collections?.appointment_id;
    if (apptId) await supabaseAdmin.from('delivery_appointments').update({ status: 'completed' }).eq('id', apptId);

    sendSuccess(res, { message: 'Collection completed and moved to inventory' });
  } catch (e) { next(e); }
};


// ─── Collection receipts (E2-US8) ────────────────────────────────────────────

const RECEIPT_SELECT = `
  *, 
  produce_collections!collection_id(collection_no, created_at, status, vehicle_number, crop_categories!category_id(name, name_sinhala, name_tamil), crop_varieties!variety_id(name)),
  farmers!farmer_id(id, full_name, farmer_code, phone, profile_id),
  collection_centres!centre_id(name, code, address, phone)
`;

async function assertReceiptAccess(req: AuthenticatedRequest, farmerId: string) {
  if (req.user?.role === 'farmer') {
    const { data: f } = await supabaseAdmin.from('farmers').select('id').eq('profile_id', req.user.id).maybeSingle();
    if (!f || f.id !== farmerId) throw new AppError('You can only access your own receipts', 403);
  }
}

/** GET /api/collections/receipts – farmers: own; staff: all (filter by farmer_id/status) */
export const listReceipts = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { farmer_id, status } = req.query as Record<string, string>;
    let q = supabaseAdmin.from('collection_receipts').select(RECEIPT_SELECT).order('issued_at', { ascending: false }).limit(200);
    if (req.user?.role === 'farmer') {
      const { data: f } = await supabaseAdmin.from('farmers').select('id').eq('profile_id', req.user.id).maybeSingle();
      if (!f) { sendSuccess(res, { data: [] }); return; }
      q = q.eq('farmer_id', f.id);
    } else if (farmer_id) q = q.eq('farmer_id', farmer_id);
    if (status) q = q.eq('status', status);
    const { data, error } = await q;
    if (error) throw new AppError(error.message, 500);
    sendSuccess(res, { data: data || [] });
  } catch (e) { next(e); }
};

/** GET /api/collections/:id/receipt */
export const getCollectionReceipt = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { data, error } = await supabaseAdmin.from('collection_receipts').select(RECEIPT_SELECT).eq('collection_id', req.params.id).maybeSingle();
    if (error) throw new AppError(error.message, 500);
    if (!data) throw new AppError('No receipt has been issued for this collection yet', 404);
    await assertReceiptAccess(req, data.farmer_id);
    sendSuccess(res, { data });
  } catch (e) { next(e); }
};

/**
 * POST /api/collections/:id/receipt  (officer)
 * Issue (or re-issue) the receipt for an inspected collection. Idempotent.
 */
export const issueCollectionReceipt = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { data: existing } = await supabaseAdmin.from('collection_receipts').select('id').eq('collection_id', id).maybeSingle();
    if (existing) {
      const { data } = await supabaseAdmin.from('collection_receipts').select(RECEIPT_SELECT).eq('id', existing.id).single();
      sendSuccess(res, { data, message: 'Receipt already issued' });
      return;
    }

    const { data: col } = await supabaseAdmin
      .from('produce_collections')
      .select('id, farmer_id, centre_id, gross_weight_kg, container_weight_kg, net_weight_kg, status, quality_inspections(grade, accepted_qty_kg, rejected_qty_kg), inventory_batches(batch_no)')
      .eq('id', id).maybeSingle();
    if (!col) throw new AppError('Collection not found', 404);
    const insp: any = Array.isArray(col.quality_inspections) ? col.quality_inspections[0] : col.quality_inspections;
    if (!insp) throw new AppError('Quality inspection must be completed before a receipt can be issued', 409);
    const batch: any = Array.isArray((col as any).inventory_batches) ? (col as any).inventory_batches[0] : (col as any).inventory_batches;

    const { data: no } = await supabaseAdmin.rpc('next_receipt_no', { p_prefix: 'RCT', p_table: 'collection_receipts', p_col: 'receipt_no' });
    const { data: created, error } = await supabaseAdmin.from('collection_receipts').insert({
      receipt_no: no, collection_id: id, farmer_id: col.farmer_id, centre_id: col.centre_id,
      gross_weight_kg: col.gross_weight_kg, container_weight_kg: col.container_weight_kg, net_weight_kg: col.net_weight_kg,
      accepted_qty_kg: insp.accepted_qty_kg, rejected_qty_kg: insp.rejected_qty_kg, grade: insp.grade,
      batch_no: batch?.batch_no ?? null, issued_by: req.user?.id,
    }).select(RECEIPT_SELECT).single();
    if (error) throw new AppError(error.message, 500);
    sendSuccess(res, { data: created, statusCode: 201, message: `Receipt ${no} issued` });
  } catch (e) { next(e); }
};

/** POST /api/collections/:id/receipt/confirm  (farmer) body: { accept: boolean, note?: string } */
export const confirmCollectionReceipt = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { accept = true, note } = req.body || {};
    const { data: receipt } = await supabaseAdmin.from('collection_receipts').select('*').eq('collection_id', req.params.id).maybeSingle();
    if (!receipt) throw new AppError('No receipt has been issued for this collection yet', 404);
    await assertReceiptAccess(req, receipt.farmer_id);
    if (receipt.status !== 'issued') throw new AppError(`Receipt is already ${receipt.status}`, 409);
    if (accept === false && !String(note || '').trim()) throw new AppError('Please explain what is wrong with the receipt', 400);

    const { data, error } = await supabaseAdmin.from('collection_receipts').update({
      status: accept === false ? 'disputed' : 'confirmed', farmer_confirmed_at: new Date().toISOString(), farmer_note: note || null,
    }).eq('id', receipt.id).select(RECEIPT_SELECT).single();
    if (error) throw new AppError(error.message, 500);

    if (accept === false) {
      await notifyRole('collection_centre_officer', 'complaint_update', 'Receipt disputed',
        `Farmer disputed receipt ${receipt.receipt_no}: ${note}`, 'collection_receipt', receipt.id);
    }
    sendSuccess(res, { data, message: accept === false ? 'Receipt disputed – the collection centre has been notified' : 'Receipt confirmed' });
  } catch (e) { next(e); }
};

/**
 * GET /api/collections/:id/report
 * Quality inspection report: batch code, weights, quality result and farmer details in one document.
 * Available once an inspection has been finalised.
 */
export const getCollectionReport = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { data: c, error } = await supabaseAdmin
      .from('produce_collections')
      .select(`
        id, collection_no, status, gross_weight_kg, container_weight_kg, net_weight_kg, created_at, weighed_at,
        vehicle_number, driver_name, notes,
        farmers!farmer_id(id, full_name, farmer_code, nic_number, phone, district, address),
        crop_categories!category_id(name), crop_varieties!variety_id(name), collection_centres!centre_id(name),
        quality_inspections(id, grade, accepted_qty_kg, rejected_qty_kg, inspection_notes, approved_at,
          profiles!inspector_id(full_name), collection_rejections(reason, quantity_kg, notes)),
        inventory_batches(id, batch_no, qr_code_value, grade, initial_qty_kg, available_qty_kg, reserved_qty_kg, status, expected_expiry_date, received_date),
        collection_receipts(receipt_no, status, issued_at)
      `)
      .eq('id', req.params.id)
      .maybeSingle();
    if (error) throw new AppError(error.message, 500);
    if (!c) throw new AppError('Collection not found', 404);

    const first = (v: any) => (Array.isArray(v) ? v[0] : v) ?? null;
    const farmer: any = first((c as any).farmers);
    if (farmer?.id) await assertFarmerAccess(req, farmer.id);

    const insp: any = first((c as any).quality_inspections);
    if (!insp) throw new AppError('No quality inspection has been completed for this collection yet', 404);

    // Evidence photos live in a table that may not exist on older databases – never fail the report because of it.
    const { data: images } = await supabaseAdmin
      .from('inspection_evidence_images').select('id, storage_path, caption, image_type').eq('inspection_id', insp.id).order('sort_order');

    sendSuccess(res, {
      data: {
        collection: {
          id: c.id, collection_no: (c as any).collection_no, status: (c as any).status, created_at: (c as any).created_at, weighed_at: (c as any).weighed_at,
          gross_weight_kg: (c as any).gross_weight_kg, container_weight_kg: (c as any).container_weight_kg, net_weight_kg: (c as any).net_weight_kg,
          vehicle_number: (c as any).vehicle_number, driver_name: (c as any).driver_name,
          category: first((c as any).crop_categories)?.name ?? null, variety: first((c as any).crop_varieties)?.name ?? null,
          centre: first((c as any).collection_centres)?.name ?? null,
        },
        farmer,
        inspection: {
          id: insp.id, grade: insp.grade, accepted_qty_kg: insp.accepted_qty_kg, rejected_qty_kg: insp.rejected_qty_kg,
          inspection_notes: insp.inspection_notes, approved_at: insp.approved_at, inspector: first(insp.profiles)?.full_name ?? null,
        },
        rejections: insp.collection_rejections ?? [],
        batch: first((c as any).inventory_batches),
        receipt: first((c as any).collection_receipts),
        images: images ?? [],
      },
    });
  } catch (e) { next(e); }
};
