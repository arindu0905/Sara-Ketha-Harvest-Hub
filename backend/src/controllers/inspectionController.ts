import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { sendSuccess } from '../utils/response';
import { AppError } from '../utils/AppError';
import { AuthenticatedRequest } from '../middleware/auth';

/**
 * POST /api/inspections
 * Create quality inspection for a collection.
 */
export const createInspection = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { collection_id, grade, accepted_qty_kg, rejected_qty_kg = 0, inspection_notes, rejection_reasons = [] } = req.body;

    // Get net weight to validate
    const { data: collection } = await supabaseAdmin
      .from('produce_collections')
      .select('id, net_weight_kg, status, farmer_id, category_id, variety_id, centre_id')
      .eq('id', collection_id)
      .single();

    if (!collection) throw new AppError('Collection not found', 404);
    if (collection.status !== 'weighed') {
      throw new AppError('Collection must be weighed before inspection', 400);
    }
    if (!collection.net_weight_kg) throw new AppError('Net weight not recorded', 400);
    if (accepted_qty_kg + rejected_qty_kg > collection.net_weight_kg) {
      throw new AppError(`Accepted + rejected (${accepted_qty_kg + rejected_qty_kg}kg) cannot exceed net weight (${collection.net_weight_kg}kg)`, 400);
    }

    // Check for existing inspection
    const { data: existing } = await supabaseAdmin
      .from('quality_inspections')
      .select('id')
      .eq('collection_id', collection_id)
      .single();
    if (existing) throw new AppError('Inspection already exists for this collection', 409);

    // Create inspection
    const { data: inspection, error } = await supabaseAdmin
      .from('quality_inspections')
      .insert({
        collection_id,
        inspector_id: req.user?.id,
        grade,
        accepted_qty_kg,
        rejected_qty_kg,
        inspection_notes,
      })
      .select()
      .single();

    if (error) throw new AppError(error.message, 500);

    // Insert rejection reasons if any
    if (rejection_reasons.length > 0 && inspection) {
      await supabaseAdmin.from('collection_rejections').insert(
        rejection_reasons.map((r: { reason: string; quantity_kg?: number; notes?: string }) => ({
          inspection_id: inspection.id,
          reason: r.reason,
          quantity_kg: r.quantity_kg,
          notes: r.notes,
        }))
      );
    }

    // Update collection status
    const collectionStatus = grade === 'rejected' ? 'rejected'
      : rejected_qty_kg > 0 ? 'partially_accepted' : 'accepted';

    await supabaseAdmin
      .from('produce_collections')
      .update({ status: collectionStatus })
      .eq('id', collection_id);

    // Auto-create inventory batch if accepted
    if (grade !== 'rejected' && accepted_qty_kg > 0) {
      // Get current price for grade
      const { data: priceData } = await supabaseAdmin.rpc('get_current_price', {
        p_category_id: collection.category_id,
        p_grade: grade,
        p_centre_id: collection.centre_id,
      });

      const purchasePrice = priceData?.[0]?.purchase_price || 0;
      const sellingPrice = priceData?.[0]?.selling_price || 0;

      const { data: batchNo } = await supabaseAdmin.rpc('generate_batch_no');
      const qrValue = `HH-BAT-${Date.now()}`;

      await supabaseAdmin.from('inventory_batches').insert({
        batch_no: batchNo || `BAT-${Date.now()}`,
        qr_code_value: qrValue,
        collection_id,
        farmer_id: collection.farmer_id,
        category_id: collection.category_id,
        variety_id: collection.variety_id,
        grade,
        initial_qty_kg: accepted_qty_kg,
        available_qty_kg: accepted_qty_kg,
        purchase_price_lkr: purchasePrice,
        selling_price_lkr: sellingPrice,
        created_by: req.user?.id,
      });
    }

    sendSuccess(res, {
      data: inspection,
      statusCode: 201,
      message: 'Inspection recorded successfully',
    });
  } catch (e) { next(e); }
};

/**
 * GET /api/inspections/:id
 */
export const getInspectionById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { data, error } = await supabaseAdmin
      .from('quality_inspections')
      .select(`
        *, collection_rejections(*),
        produce_collections!collection_id(
          collection_no, net_weight_kg, farmer_id,
          farmers!farmer_id(full_name, farmer_code),
          crop_categories!category_id(name),
          crop_varieties!variety_id(name)
        ),
        profiles!inspector_id(full_name)
      `)
      .eq('id', req.params.id)
      .single();

    if (error || !data) throw new AppError('Inspection not found', 404);
    sendSuccess(res, { data });
  } catch (e) { next(e); }
};

/**
 * POST /api/inspections/:id/approve
 */
export const approveInspection = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { data, error } = await supabaseAdmin
      .from('quality_inspections')
      .update({ approved_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw new AppError(error.message, 500);
    sendSuccess(res, { data, message: 'Inspection approved' });
  } catch (e) { next(e); }
};

/**
 * GET /api/inspections — pending inspections
 */
export const getPendingInspections = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { data, error } = await supabaseAdmin
      .from('produce_collections')
      .select(`
        id, collection_no, status, net_weight_kg, created_at,
        farmers!farmer_id(full_name, farmer_code),
        crop_categories!category_id(name),
        collection_centres!centre_id(name)
      `)
      .eq('status', 'weighed')
      .order('created_at');

    if (error) throw new AppError(error.message, 500);
    sendSuccess(res, { data: data || [] });
  } catch (e) { next(e); }
};
