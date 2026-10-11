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
    assertPriceFields(req.body, true);

    // The product must belong to the chosen category
    if (variety_id) {
      const { data: v } = await supabaseAdmin.from('crop_varieties').select('category_id').eq('id', variety_id).maybeSingle();
      if (!v || v.category_id !== category_id) throw new AppError('The selected product does not belong to this category', 400);
    }

    // Supersede the existing active price for the same category + product + grade + centre
    let supersede = supabaseAdmin
      .from('crop_prices')
      .update({ status: 'superseded', effective_until: new Date().toISOString().split('T')[0] })
      .eq('category_id', category_id)
      .eq('grade', grade)
      .eq('status', 'active')
      .is('centre_id', centre_id || null);
    supersede = variety_id ? supersede.eq('variety_id', variety_id) : supersede.is('variety_id', null);
    await supersede;

    const { data, error } = await supabaseAdmin
      .from('crop_prices')
      .insert({
        category_id, variety_id, centre_id, grade,
        purchase_price, selling_price, unit,
        effective_from, effective_until,
        status: 'active',
        created_by: req.user?.id,
      })
      .select(`*, crop_categories!category_id(id, name, name_sinhala, name_tamil), crop_varieties!variety_id(id, name)`)
      .single();

    if (error) throw new AppError(error.message, 500);
    sendSuccess(res, { data, statusCode: 201, message: 'Price created successfully' });
  } catch (e) { next(e); }
};

const GRADES_ALLOWED = ['grade_a', 'grade_b', 'grade_c'];
const normalisePriceBody = (b: Record<string, unknown> = {}) => ({ ...b, variety_id: b.variety_id === '' ? null : b.variety_id });

/** Rejects missing / non-positive prices and unknown grades with a clear 400 (create = all fields required). */
function assertPriceFields(b: Record<string, any>, create: boolean): void {
  if (create && !b.category_id) throw new AppError('Please select a crop category', 400);
  if (create && !GRADES_ALLOWED.includes(b.grade)) throw new AppError('Grade must be grade_a, grade_b or grade_c', 400);
  if (!create && b.grade !== undefined && !GRADES_ALLOWED.includes(b.grade)) throw new AppError('Grade must be grade_a, grade_b or grade_c', 400);
  for (const key of ['purchase_price', 'selling_price']) {
    if (b[key] === undefined || b[key] === null || b[key] === '') {
      if (create) throw new AppError(`${key.replace('_', ' ')} is required`, 400);
      continue;
    }
    const n = Number(b[key]);
    if (!Number.isFinite(n) || n <= 0) throw new AppError(`${key.replace('_', ' ')} must be a number greater than zero`, 400);
    if (n > 1_000_000) throw new AppError(`${key.replace('_', ' ')} looks too large`, 400);
  }
}

const PRICE_EDITABLE = ['category_id', 'variety_id', 'centre_id', 'grade', 'purchase_price', 'selling_price', 'unit', 'effective_from', 'effective_until', 'status'];
const pick = (body: Record<string, unknown> = {}, keys: string[]) =>
  Object.fromEntries(Object.entries(body).filter(([k, v]) => keys.includes(k) && v !== undefined));

/**
 * PUT /api/prices/:id/status
 */
export const updatePriceStatus = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { status } = req.body;
    const { data, error } = await supabaseAdmin
      .from('crop_prices')
      .update({ status, updated_at: new Date().toISOString(), ...(status === 'active' ? { approved_by: req.user?.id } : {}) })
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
    assertPriceFields(req.body, false);
    const { data, error } = await supabaseAdmin
      .from('crop_prices')
      .update({ ...pick(normalisePriceBody(req.body), PRICE_EDITABLE), updated_at: new Date().toISOString() })
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
