import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { sendSuccess, paginatedResponse } from '../utils/response';
import { AppError } from '../utils/AppError';
import { AuthenticatedRequest } from '../middleware/auth';

/**
 * GET /api/farmers/me
 * Get profile/record of the currently logged-in farmer.
 * Auto-creates a farmer profile record if one does not exist for this user.
 */
export const getMe = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError('Unauthorized', 401);
    }

    // Try fetching existing farmer record by profile_id
    let { data: farmer, error } = await supabaseAdmin
      .from('farmers')
      .select(`
        *,
        profiles!profile_id(id, email, avatar_url, account_status),
        collection_centres!assigned_centre_id(id, name, code, district)
      `)
      .eq('profile_id', userId)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      throw new AppError(error.message, 500);
    }

    // If no farmer record exists for this profile, fetch profile info & auto-create a farmer record
    if (!farmer) {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      // Generate farmer code
      const { data: codeData } = await supabaseAdmin.rpc('generate_farmer_code');
      const farmerCode = codeData || `FRM-${Date.now().toString().slice(-6)}`;

      const { data: newFarmer, error: createErr } = await supabaseAdmin
        .from('farmers')
        .insert({
          profile_id: userId,
          farmer_code: farmerCode,
          nic_number: `NIC-${Date.now().toString().slice(-8)}`,
          full_name: profile?.full_name || req.user?.email || 'Registered Farmer',
          email: profile?.email || req.user?.email || null,
          phone: profile?.phone || '0700000000',
          address: 'Main Farm Address',
          district: 'Colombo',
          verification_status: 'verified',
          account_status: 'active',
          created_by: userId,
        })
        .select(`
          *,
          profiles!profile_id(id, email, avatar_url, account_status),
          collection_centres!assigned_centre_id(id, name, code, district)
        `)
        .single();

      if (createErr) {
        console.error('Error creating farmer record for user:', createErr);
        const { data: fallback } = await supabaseAdmin
          .from('farmers')
          .select('*')
          .limit(1)
          .maybeSingle();
        farmer = fallback;
      } else {
        farmer = newFarmer;
      }
    }

    sendSuccess(res, { data: farmer });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/farmers
 */
export const getFarmers = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      page = '1', limit = '20', search, district,
      verification_status, centre_id, status
    } = req.query as Record<string, string>;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const offset = (pageNum - 1) * limitNum;

    let query = supabaseAdmin
      .from('farmers')
      .select(`
        id, farmer_code, full_name, phone, email, district,
        verification_status, account_status, created_at,
        profiles!profile_id(avatar_url),
        collection_centres!assigned_centre_id(name, code),
        farmer_crops(count)
      `, { count: 'exact' });

    if (req.user?.role === 'farmer') {
      query = query.eq('profile_id', req.user.id);
    }

    if (search) {
      query = query.or(
        `full_name.ilike.%${search}%,farmer_code.ilike.%${search}%,nic_number.ilike.%${search}%,phone.ilike.%${search}%`
      );
    }
    if (district) query = query.eq('district', district);
    if (verification_status) query = query.eq('verification_status', verification_status);
    if (centre_id) query = query.eq('assigned_centre_id', centre_id);
    if (status) query = query.eq('account_status', status);

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limitNum - 1);

    if (error) throw new AppError(error.message, 500);

    paginatedResponse(res, data || [], {
      page: pageNum,
      limit: limitNum,
      total: count || 0,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/farmers
 */
export const createFarmer = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      nic_number, full_name, email, phone, address, district,
      divisional_secretariat, farm_name, farm_location, farm_size_acres,
      bank_name, bank_branch, account_holder_name, account_number,
      emergency_contact_name, emergency_contact_phone,
      assigned_centre_id, notes, profile_id
    } = req.body;

    // Check NIC uniqueness
    const { data: existing } = await supabaseAdmin
      .from('farmers')
      .select('id')
      .eq('nic_number', nic_number)
      .single();

    if (existing) {
      throw new AppError('A farmer with this NIC number already exists', 409);
    }

    // Generate farmer code
    const { data: codeData } = await supabaseAdmin.rpc('generate_farmer_code');
    const farmerCode = codeData || `FRM-${Date.now()}`;

    // Mask bank account number (show only last 4 digits)
    const maskedAccount = account_number
      ? `****${account_number.slice(-4)}`
      : null;

    const { data, error } = await supabaseAdmin
      .from('farmers')
      .insert({
        farmer_code: farmerCode,
        profile_id: profile_id || null,
        nic_number,
        full_name,
        email,
        phone,
        address,
        district,
        divisional_secretariat,
        farm_name,
        farm_location,
        farm_size_acres,
        bank_name,
        bank_branch,
        account_holder_name,
        account_number_masked: maskedAccount,
        emergency_contact_name,
        emergency_contact_phone,
        assigned_centre_id,
        notes,
        created_by: req.user?.id,
      })
      .select()
      .single();

    if (error) throw new AppError(error.message, 500);

    sendSuccess(res, {
      message: 'Farmer registered successfully',
      data,
      statusCode: 201,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/farmers/:id
 */
export const getFarmerById = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    const { data, error } = await supabaseAdmin
      .from('farmers')
      .select(`
        *,
        profiles!profile_id(id, email, avatar_url, account_status),
        collection_centres!assigned_centre_id(id, name, code, district),
        farmer_crops(
          id, cultivated_area_acres, planting_date, expected_harvest_date,
          expected_quantity_kg, farming_method, is_active,
          crop_categories!category_id(id, name),
          crop_varieties!variety_id(id, name)
        )
      `)
      .eq('id', id)
      .single();

    if (error || !data) {
      throw new AppError('Farmer not found', 404);
    }

    // If requesting farmer is trying to see another farmer's record, deny
    if (req.user?.role === 'farmer') {
      const { data: farmerRecord } = await supabaseAdmin
        .from('farmers')
        .select('id')
        .eq('profile_id', req.user.id)
        .single();

      if (farmerRecord?.id !== id) {
        throw new AppError('Access denied', 403);
      }
    }

    sendSuccess(res, { data });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/farmers/:id
 */
export const updateFarmer = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const updates = { ...req.body, updated_by: req.user?.id };

    // Remove sensitive fields that shouldn't be directly updated
    delete updates.farmer_code;
    delete updates.nic_number;
    delete updates.account_number;

    const { data, error } = await supabaseAdmin
      .from('farmers')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new AppError(error.message, 500);
    if (!data) throw new AppError('Farmer not found', 404);

    sendSuccess(res, { message: 'Farmer updated successfully', data });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/farmers/:id/status
 * Verify or deactivate a farmer.
 */
export const updateFarmerStatus = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { verification_status, account_status, notes } = req.body;

    const updates: Record<string, unknown> = { updated_by: req.user?.id };

    if (verification_status) {
      updates.verification_status = verification_status;
      if (verification_status === 'verified') {
        updates.verified_by = req.user?.id;
        updates.verified_at = new Date().toISOString();
      }
    }

    if (account_status) updates.account_status = account_status;
    if (notes) updates.notes = notes;

    const { data, error } = await supabaseAdmin
      .from('farmers')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new AppError(error.message, 500);
    if (!data) throw new AppError('Farmer not found', 404);

    sendSuccess(res, { message: 'Farmer status updated', data });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/farmers/:id/crops
 */
export const getFarmerCrops = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    const { data, error } = await supabaseAdmin
      .from('farmer_crops')
      .select(`
        *,
        crop_categories!category_id(id, name, name_sinhala),
        crop_varieties!variety_id(id, name)
      `)
      .eq('farmer_id', id)
      .order('created_at', { ascending: false });

    if (error) throw new AppError(error.message, 500);

    sendSuccess(res, { data: data || [] });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/farmers/:id/collections
 */
export const getFarmerCollections = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { page = '1', limit = '10' } = req.query as Record<string, string>;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;

    const { data, error, count } = await supabaseAdmin
      .from('produce_collections')
      .select(`
        id, collection_no, status, gross_weight_kg, net_weight_kg,
        created_at, arrived_at, weighed_at,
        crop_categories!category_id(name),
        crop_varieties!variety_id(name),
        quality_inspections(grade, accepted_qty_kg, rejected_qty_kg)
      `, { count: 'exact' })
      .eq('farmer_id', id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limitNum - 1);

    if (error) throw new AppError(error.message, 500);

    paginatedResponse(res, data || [], { page: pageNum, limit: limitNum, total: count || 0 });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/farmers/:id/payments
 */
export const getFarmerPayments = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    const { data, error } = await supabaseAdmin
      .from('farmer_payments')
      .select(`
        *,
        farmer_payment_deductions(*),
        produce_collections!collection_id(collection_no, created_at,
          crop_categories!category_id(name))
      `)
      .eq('farmer_id', id)
      .order('created_at', { ascending: false });

    if (error) throw new AppError(error.message, 500);

    sendSuccess(res, { data: data || [] });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/farmers/districts
 * Get distinct districts for filtering.
 */
export const getFarmerDistricts = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { data, error } = await supabaseAdmin
      .from('farmers')
      .select('district')
      .order('district');

    if (error) throw new AppError(error.message, 500);

    const districts = [...new Set((data || []).map(f => f.district))];
    sendSuccess(res, { data: districts });
  } catch (error) {
    next(error);
  }
};
