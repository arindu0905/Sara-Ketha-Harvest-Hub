import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { sendSuccess, paginatedResponse } from '../utils/response';
import { AppError } from '../utils/AppError';
import { AuthenticatedRequest } from '../middleware/auth';
import { getFarmerIdForUser, assertFarmerAccess } from '../services/access';

// ─── Crop Categories ──────────────────────────────────────────────

/** Farmers may only touch crops that belong to their own farmer record; staff are unrestricted. */
async function assertCropAccess(req: AuthenticatedRequest, cropId: string): Promise<void> {
  const { data } = await supabaseAdmin.from('farmer_crops').select('farmer_id').eq('id', cropId).maybeSingle();
  if (!data) throw new AppError('Crop not found', 404);
  await assertFarmerAccess(req, data.farmer_id);
}

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
      .select('*, crop_varieties(*)')
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

    if (req.user?.role === 'farmer') {
      const own = await getFarmerIdForUser(req.user.id);
      query = query.eq('farmer_id', own ?? '00000000-0000-0000-0000-000000000000');
    } else if (farmer_id) {
      query = query.eq('farmer_id', farmer_id);
    }
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
    const body = { ...req.body };
    if (req.user?.role === 'farmer') {
      const own = await getFarmerIdForUser(req.user.id);
      if (!own) throw new AppError('Farmer record not found', 403);
      body.farmer_id = own; // a farmer can only register crops for themselves
    }
    const { data, error } = await supabaseAdmin
      .from('farmer_crops')
      .insert({ ...body, created_by: req.user?.id })
      .select(`
        *, crop_categories!category_id(name),
        crop_varieties!variety_id(name)
      `).single();
    if (error) throw new AppError(error.message, 500);
    sendSuccess(res, { data, statusCode: 201, message: 'Crop registered successfully' });
  } catch (e) { next(e); }
};

export const getCropById = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    await assertCropAccess(req, req.params.id);
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
    await assertCropAccess(req, req.params.id);
    const updates = { ...req.body };
    if (req.user?.role === 'farmer') delete updates.farmer_id; // cannot be re-assigned to someone else
    const { data, error } = await supabaseAdmin
      .from('farmer_crops')
      .update(updates)
      .eq('id', req.params.id)
      .select().single();
    if (error) throw new AppError(error.message, 500);
    if (!data) throw new AppError('Crop not found', 404);
    sendSuccess(res, { data, message: 'Crop updated successfully' });
  } catch (e) { next(e); }
};

export const deleteCrop = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    await assertCropAccess(req, id);
    
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

// ─── Product / category images ──────────────────────────────────────────────
const IMAGE_BUCKET = 'product-images';
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;

/** Creates the public bucket the first time an image is uploaded. */
async function ensureImageBucket(): Promise<void> {
  const { data } = await supabaseAdmin.storage.getBucket(IMAGE_BUCKET);
  if (data) return;
  const { error } = await supabaseAdmin.storage.createBucket(IMAGE_BUCKET, { public: true, fileSizeLimit: MAX_IMAGE_BYTES });
  if (error && !/already exists/i.test(error.message)) throw new AppError(`Could not prepare image storage: ${error.message}`, 500);
}

const imageHandler = (table: 'crop_varieties' | 'crop_categories', kind: 'variety' | 'category') =>
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params.id;
      const { data: row } = await supabaseAdmin.from(table).select('id, name').eq('id', id).maybeSingle();
      if (!row) throw new AppError(`${kind === 'variety' ? 'Product' : 'Category'} not found`, 404);

      const m = /^data:(image\/(png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(req.body?.image || ''));
      if (!m) throw new AppError('Please upload a PNG, JPG or WebP image', 400);
      const buffer = Buffer.from(m[3], 'base64');
      if (buffer.length > MAX_IMAGE_BYTES) throw new AppError('Image is too large – the limit is 3 MB', 400);

      await ensureImageBucket();
      const ext = m[2] === 'jpeg' ? 'jpg' : m[2];
      const path = `${kind}/${id}_${Date.now()}.${ext}`;
      const { error: upErr } = await supabaseAdmin.storage.from(IMAGE_BUCKET).upload(path, buffer, { contentType: m[1], upsert: false });
      if (upErr) throw new AppError(`Image upload failed: ${upErr.message}`, 500);
      const url = supabaseAdmin.storage.from(IMAGE_BUCKET).getPublicUrl(path).data.publicUrl;

      const { error } = await supabaseAdmin.from(table).update({ image_url: url }).eq('id', id);
      if (error) {
        if (/image_url|schema cache/i.test(error.message)) {
          throw new AppError('Product images are not set up yet. Run RUN_8_product_images.sql in the Supabase SQL editor.', 503);
        }
        throw new AppError(error.message, 500);
      }
      sendSuccess(res, { data: { image_url: url }, message: 'Image saved' });
    } catch (e) { next(e); }
  };

const removeImageHandler = (table: 'crop_varieties' | 'crop_categories') =>
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { error } = await supabaseAdmin.from(table).update({ image_url: null }).eq('id', req.params.id);
      if (error) throw new AppError(error.message, 500);
      sendSuccess(res, { message: 'Image removed' });
    } catch (e) { next(e); }
  };

export const uploadVarietyImage = imageHandler('crop_varieties', 'variety');
export const uploadCategoryImage = imageHandler('crop_categories', 'category');
export const removeVarietyImage = removeImageHandler('crop_varieties');
export const removeCategoryImage = removeImageHandler('crop_categories');
