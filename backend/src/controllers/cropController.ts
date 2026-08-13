import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { sendSuccess, paginatedResponse } from '../utils/response';
import { AppError } from '../utils/AppError';
import { AuthenticatedRequest } from '../middleware/auth';

// ─── Crop Categories ──────────────────────────────────────────────

export const getCategories = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { data, error } = await supabaseAdmin
      .from('crop_categories')
      .select('*, crop_varieties(id, name, description, is_active)')
      .eq('is_active', true)
      .order('name');
    if (error) throw new AppError(error.message, 500);
    sendSuccess(res, { data: data || [] });
  } catch (e) { next(e); }
};

export const getCategoryById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { data, error } = await supabaseAdmin
      .from('crop_categories')
      .select('*, crop_varieties(id, name, description, is_active, created_at)')
      .eq('id', id)
      .single();

    if (error || !data) throw new AppError('Crop category not found', 404);
    sendSuccess(res, { data });
  } catch (e) { next(e); }
};

export const createCategory = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { varieties, products, ...categoryData } = req.body;
    const varietyList: Array<string | { name: string; description?: string }> = varieties || products || [];

    const { data, error } = await supabaseAdmin
      .from('crop_categories')
      .insert({ ...categoryData, created_by: req.user?.id })
      .select().single();
    if (error) throw new AppError(error.message, 500);

    if (varietyList && varietyList.length > 0) {
      const varietyInserts = varietyList.map((item) => {
        const name = typeof item === 'string' ? item.trim() : item.name?.trim();
        const description = typeof item === 'string' ? null : item.description || null;
        return {
          category_id: data.id,
          name,
          description,
          created_by: req.user?.id,
          is_active: true,
        };
      }).filter(v => Boolean(v.name));

      if (varietyInserts.length > 0) {
        const { error: varietyError } = await supabaseAdmin
          .from('crop_varieties')
          .insert(varietyInserts);
        if (varietyError) {
          console.error('Failed to insert varieties during category creation:', varietyError);
        }
      }
    }

    const { data: fullData } = await supabaseAdmin
      .from('crop_categories')
      .select('*, crop_varieties(id, name, description, is_active)')
      .eq('id', data.id)
      .single();

    sendSuccess(res, { data: fullData || data, statusCode: 201, message: 'Category created' });
  } catch (e) { next(e); }
};

export const updateCategory = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { varieties, products, ...categoryData } = req.body;

    const { data, error } = await supabaseAdmin
      .from('crop_categories')
      .update({ ...categoryData, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select().single();
    if (error) throw new AppError(error.message, 500);

    sendSuccess(res, { data, message: 'Category updated' });
  } catch (e) { next(e); }
};

export const deleteCategory = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { error } = await supabaseAdmin
      .from('crop_categories')
      .update({ is_active: false })
      .eq('id', req.params.id);
    if (error) throw new AppError(error.message, 500);
    sendSuccess(res, { message: 'Category deactivated' });
  } catch (e) { next(e); }
};

// ─── Crop Varieties / Products ─────────────────────────────────────

export const createVariety = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const categoryId = req.params.categoryId || req.body.category_id;
    const { name, description } = req.body;
    if (!categoryId) throw new AppError('Category ID is required', 400);
    if (!name || !name.trim()) throw new AppError('Product/Variety name is required', 400);

    const { data, error } = await supabaseAdmin
      .from('crop_varieties')
      .insert({
        category_id: categoryId,
        name: name.trim(),
        description: description?.trim() || null,
        is_active: true,
        created_by: req.user?.id,
      })
      .select().single();

    if (error) throw new AppError(error.message, 500);
    sendSuccess(res, { data, statusCode: 201, message: 'Product added successfully' });
  } catch (e) { next(e); }
};

export const updateVariety = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { data, error } = await supabaseAdmin
      .from('crop_varieties')
      .update({ ...req.body })
      .eq('id', req.params.id)
      .select().single();

    if (error) throw new AppError(error.message, 500);
    sendSuccess(res, { data, message: 'Product updated successfully' });
  } catch (e) { next(e); }
};

export const deleteVariety = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { error } = await supabaseAdmin
      .from('crop_varieties')
      .update({ is_active: false })
      .eq('id', req.params.id);

    if (error) throw new AppError(error.message, 500);
    sendSuccess(res, { message: 'Product deactivated successfully' });
  } catch (e) { next(e); }
};

// ─── Farmer Crops ─────────────────────────────────────────────────

export const getCrops = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { page = '1', limit = '20', farmer_id, category_id, is_active } = req.query as Record<string, string>;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;

    let query = supabaseAdmin
      .from('farmer_crops')
      .select(`
        *, farmers!farmer_id(id, full_name, farmer_code),
        crop_categories!category_id(id, name, name_sinhala, name_tamil),
        crop_varieties!variety_id(id, name)
      `, { count: 'exact' });

    if (farmer_id) query = query.eq('farmer_id', farmer_id);
    if (category_id) query = query.eq('category_id', category_id);

    // Filter out inactive/deleted crops unless explicitly requested with is_active=false/all
    if (is_active !== undefined && is_active !== 'all') {
      query = query.eq('is_active', is_active === 'true');
    } else if (is_active === undefined) {
      query = query.eq('is_active', true);
    }

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limitNum - 1);

    if (error) throw new AppError(error.message, 500);
    paginatedResponse(res, data || [], { page: pageNum, limit: limitNum, total: count || 0 });
  } catch (e) { next(e); }
};

export const createCrop = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { data, error } = await supabaseAdmin
      .from('farmer_crops')
      .insert({ ...req.body, created_by: req.user?.id })
      .select(`
        *, crop_categories!category_id(name),
        crop_varieties!variety_id(name)
      `).single();
    if (error) throw new AppError(error.message, 500);
    sendSuccess(res, { data, statusCode: 201, message: 'Crop registered successfully' });
  } catch (e) { next(e); }
};

export const getCropById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { data, error } = await supabaseAdmin
      .from('farmer_crops')
      .select(`
        *, farmers!farmer_id(id, full_name, farmer_code),
        crop_categories!category_id(*), crop_varieties!variety_id(*)
      `)
      .eq('id', req.params.id).single();
    if (error || !data) throw new AppError('Crop not found', 404);
    sendSuccess(res, { data });
  } catch (e) { next(e); }
};

export const updateCrop = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { data, error } = await supabaseAdmin
      .from('farmer_crops')
      .update({ ...req.body })
      .eq('id', req.params.id)
      .select().single();
    if (error) throw new AppError(error.message, 500);
    if (!data) throw new AppError('Crop not found', 404);
    sendSuccess(res, { data, message: 'Crop updated successfully' });
  } catch (e) { next(e); }
};

export const deleteCrop = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    
    // Perform hard deletion on farmer_crops table
    const { error: delError } = await supabaseAdmin
      .from('farmer_crops')
      .delete()
      .eq('id', id);

    if (delError) {
      // If there are foreign key constraints (e.g. linked to collection records), soft delete
      const { error: updateErr } = await supabaseAdmin
        .from('farmer_crops')
        .update({ is_active: false })
        .eq('id', id);
      if (updateErr) throw new AppError(updateErr.message, 500);
    }
    sendSuccess(res, { message: 'Crop removed successfully' });
  } catch (e) { next(e); }
};
