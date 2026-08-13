import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { sendSuccess, paginatedResponse } from '../utils/response';
import { AppError } from '../utils/AppError';
import { AuthenticatedRequest } from '../middleware/auth';

/**
 * GET /api/inventory
 */
export const getInventory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { page = '1', limit = '20', status, category_id, warehouse_id, near_expiry } = req.query as Record<string, string>;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;

    let query = supabaseAdmin
      .from('inventory_batches')
      .select(`
        id, batch_no, qr_code_value, grade, status,
        initial_qty_kg, available_qty_kg, reserved_qty_kg, sold_qty_kg, wasted_qty_kg,
        purchase_price_lkr, selling_price_lkr, received_date, expected_expiry_date,
        crop_categories!category_id(id, name, name_sinhala, name_tamil),
        crop_varieties!variety_id(id, name),
        warehouses!warehouse_id(id, name, code),
        storage_locations!storage_location_id(id, code),
        farmers!farmer_id(id, full_name, farmer_code)
      `, { count: 'exact' });

    if (status) query = query.eq('status', status);
    else query = query.not('status', 'in', '(disposed,sold)');
    if (category_id) query = query.eq('category_id', category_id);
    if (warehouse_id) query = query.eq('warehouse_id', warehouse_id);
    if (near_expiry === 'true') {
      const threshold = new Date();
      threshold.setDate(threshold.getDate() + 7);
      query = query.lte('expected_expiry_date', threshold.toISOString().split('T')[0])
        .gte('expected_expiry_date', new Date().toISOString().split('T')[0]);
    }

    const { data, error, count } = await query
      .order('received_date', { ascending: true })
      .range(offset, offset + limitNum - 1);

    if (error) throw new AppError(error.message, 500);
    paginatedResponse(res, data || [], { page: pageNum, limit: limitNum, total: count || 0 });
  } catch (e) { next(e); }
};

/**
 * GET /api/inventory/:id
 */
export const getBatchById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { data, error } = await supabaseAdmin
      .from('inventory_batches')
      .select(`
        *,
        crop_categories!category_id(*), crop_varieties!variety_id(*),
        farmers!farmer_id(id, full_name, farmer_code, phone),
        warehouses!warehouse_id(*), storage_locations!storage_location_id(*),
        produce_collections!collection_id(collection_no, created_at),
        inventory_transactions(*, profiles!created_by(full_name))
      `)
      .eq('id', req.params.id)
      .single();

    if (error || !data) throw new AppError('Batch not found', 404);
    sendSuccess(res, { data });
  } catch (e) { next(e); }
};

/**
 * POST /api/inventory/:id/adjust
 * Record a stock adjustment (waste, damage, etc.)
 */
export const adjustStock = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { adjustment_type, quantity_kg, notes } = req.body;

    const { data: batch } = await supabaseAdmin
      .from('inventory_batches')
      .select('available_qty_kg, wasted_qty_kg')
      .eq('id', id)
      .single();

    if (!batch) throw new AppError('Batch not found', 404);
    if (quantity_kg > batch.available_qty_kg) {
      throw new AppError(`Cannot adjust ${quantity_kg}kg — only ${batch.available_qty_kg}kg available`, 400);
    }

    const updates: Record<string, number> = {};
    if (adjustment_type === 'waste' || adjustment_type === 'damage') {
      updates.wasted_qty_kg = batch.wasted_qty_kg + quantity_kg;
      updates.available_qty_kg = batch.available_qty_kg - quantity_kg;
    }

    const { error: updateError } = await supabaseAdmin
      .from('inventory_batches')
      .update(updates)
      .eq('id', id);

    if (updateError) throw new AppError(updateError.message, 500);

    // Log transaction
    await supabaseAdmin.from('inventory_transactions').insert({
      batch_id: id,
      transaction_type: adjustment_type,
      quantity_kg: -quantity_kg,
      balance_kg: batch.available_qty_kg - quantity_kg,
      notes,
      created_by: req.user?.id,
    });

    sendSuccess(res, { message: 'Stock adjustment recorded' });
  } catch (e) { next(e); }
};

/**
 * POST /api/inventory/:id/transfer
 * Transfer batch to different warehouse/location.
 */
export const transferBatch = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { warehouse_id, storage_location_id, notes } = req.body;

    const { data, error } = await supabaseAdmin
      .from('inventory_batches')
      .update({ warehouse_id, storage_location_id })
      .eq('id', id)
      .select()
      .single();

    if (error) throw new AppError(error.message, 500);

    await supabaseAdmin.from('inventory_transactions').insert({
      batch_id: id,
      transaction_type: 'transferred',
      quantity_kg: 0,
      balance_kg: data.available_qty_kg,
      notes: notes || 'Stock transferred to new location',
      created_by: req.user?.id,
    });

    sendSuccess(res, { data, message: 'Batch transferred successfully' });
  } catch (e) { next(e); }
};

/**
 * GET /api/inventory/summary
 * Aggregate inventory by crop category.
 */
export const getInventorySummary = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { data, error } = await supabaseAdmin
      .from('inventory_batches')
      .select(`
        category_id, grade, available_qty_kg, reserved_qty_kg,
        crop_categories!category_id(id, name, name_sinhala, name_tamil)
      `)
      .in('status', ['available', 'reserved', 'partially_sold']);

    if (error) throw new AppError(error.message, 500);

    // Aggregate by category
    const summary: Record<string, { name: string; total_available: number; by_grade: Record<string, number> }> = {};
    (data || []).forEach((batch: any) => {
      const catId = batch.category_id;
      const catName = Array.isArray(batch.crop_categories) ? batch.crop_categories[0]?.name : batch.crop_categories?.name || catId;
      if (!summary[catId]) summary[catId] = { name: catName, total_available: 0, by_grade: {} };
      summary[catId].total_available += batch.available_qty_kg;
      summary[catId].by_grade[batch.grade] = (summary[catId].by_grade[batch.grade] || 0) + batch.available_qty_kg;
    });

    sendSuccess(res, { data: Object.values(summary) });
  } catch (e) { next(e); }
};
