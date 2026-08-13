import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { sendSuccess } from '../utils/response';
import { AppError } from '../utils/AppError';
import { AuthenticatedRequest } from '../middleware/auth';

/**
 * GET /api/prices/current
 * Get currently active prices, optionally filtered.
 */
export const getCurrentPrices = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { category_id, grade, centre_id } = req.query as Record<string, string>;

    let query = supabaseAdmin
      .from('crop_prices')
      .select(`
        *, crop_categories!category_id(id, name, name_sinhala, name_tamil),
        crop_varieties!variety_id(id, name),
        collection_centres!centre_id(id, name, code)
      `)
      .eq('status', 'active')
      .lte('effective_from', new Date().toISOString().split('T')[0]);

    if (category_id) query = query.eq('category_id', category_id);
    if (grade) query = query.eq('grade', grade);
    if (centre_id) query = query.eq('centre_id', centre_id);

    const { data, error } = await query.order('category_id').order('grade');
    if (error) throw new AppError(error.message, 500);
    sendSuccess(res, { data: data || [] });
  } catch (e) { next(e); }
};

/**
 * GET /api/prices/history
 */
export const getPriceHistory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { category_id, grade } = req.query as Record<string, string>;

    let query = supabaseAdmin
      .from('crop_prices')
      .select(`
        *, crop_categories!category_id(id, name, name_sinhala, name_tamil),
        crop_varieties!variety_id(id, name)
      `);

    if (category_id) query = query.eq('category_id', category_id);
    if (grade) query = query.eq('grade', grade);

    const { data, error } = await query.order('effective_from', { ascending: false }).limit(100);
    if (error) throw new AppError(error.message, 500);
    sendSuccess(res, { data: data || [] });
  } catch (e) { next(e); }
};

/**
 * POST /api/prices
 * Create a new price record. Supersedes active price for same category/grade.
 */
export const createPrice = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { category_id, variety_id, centre_id, grade, purchase_price, selling_price, unit, effective_from, effective_until } = req.body;

    // Supersede existing active price for same category+grade+centre
    await supabaseAdmin
      .from('crop_prices')
      .update({ status: 'superseded', effective_until: new Date().toISOString().split('T')[0] })
      .eq('category_id', category_id)
      .eq('grade', grade)
      .eq('status', 'active')
      .is('centre_id', centre_id || null);

    const { data, error } = await supabaseAdmin
      .from('crop_prices')
      .insert({
        category_id, variety_id, centre_id, grade,
        purchase_price, selling_price, unit,
        effective_from, effective_until,
        status: 'active',
        created_by: req.user?.id,
      })
      .select(`*, crop_categories!category_id(id, name, name_sinhala, name_tamil)`)
      .single();

    if (error) throw new AppError(error.message, 500);
    sendSuccess(res, { data, statusCode: 201, message: 'Price created successfully' });
  } catch (e) { next(e); }
};

/**
 * PUT /api/prices/:id/status
 */
export const updatePriceStatus = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { status } = req.body;
    const { data, error } = await supabaseAdmin
      .from('crop_prices')
      .update({ status, updated_by: req.user?.id })
      .eq('id', req.params.id)
      .select().single();
    if (error) throw new AppError(error.message, 500);
    sendSuccess(res, { data, message: 'Price status updated' });
  } catch (e) { next(e); }
};

/**
 * PUT /api/prices/:id
 */
export const updatePrice = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { data, error } = await supabaseAdmin
      .from('crop_prices')
      .update({ ...req.body, updated_by: req.user?.id })
      .eq('id', req.params.id)
      .select(`*, crop_categories!category_id(id, name, name_sinhala, name_tamil)`).single();
    if (error) throw new AppError(error.message, 500);
    sendSuccess(res, { data, message: 'Price updated successfully' });
  } catch (e) { next(e); }
};

/**
 * DELETE /api/prices/:id
 */
export const deletePrice = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { error } = await supabaseAdmin
      .from('crop_prices')
      .delete()
      .eq('id', req.params.id);
    if (error) throw new AppError(error.message, 500);
    sendSuccess(res, { message: 'Price record deleted successfully' });
  } catch (e) { next(e); }
};
