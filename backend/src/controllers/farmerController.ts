import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { sendSuccess, paginatedResponse } from '../utils/response';
import { AppError } from '../utils/AppError';
import { AuthenticatedRequest } from '../middleware/auth';
import { assertFarmerAccess } from '../services/access';
import { notifyUser } from '../services/notify';

/** Strip characters that would break out of a PostgREST .or() filter. */
const safeSearch = (v: string) => v.replace(/[,()%*\\]/g, ' ').trim().slice(0, 60);

/** Columns a farmer may edit on their own record (no identity / verification / ownership fields). */
const FARMER_EDITABLE = ['full_name', 'nic_number', 'email', 'phone', 'address', 'district', 'divisional_secretariat', 'farm_name', 'farm_location', 'farm_size_acres', 'bank_name', 'bank_branch', 'account_holder_name', 'emergency_contact_name', 'emergency_contact_phone', 'preferred_language'];
const STAFF_EDITABLE = [...FARMER_EDITABLE, 'nic_number', 'assigned_centre_id', 'notes'];

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
          nic_number: null,
          full_name: profile?.full_name || req.user?.email?.split('@')[0] || 'New Farmer',
          email: profile?.email || req.user?.email || null,
          phone: profile?.phone || null,
          address: null,
          district: null,
          verification_status: 'pending',
          account_status: 'pending',
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
        throw new AppError('Could not create your farmer profile. Please contact the collection centre.', 500);
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
        verified_at,
        verifier:profiles!verified_by(full_name, role),
        profiles!profile_id(avatar_url),
        collection_centres!assigned_centre_id(name, code),
        farmer_crops(count)
      `, { count: 'exact' });

    if (req.user?.role === 'farmer') {
      query = query.eq('profile_id', req.user.id);
    }

    const term = search ? safeSearch(search) : '';
    if (term) {
      query = query.or(
        `full_name.ilike.%${term}%,farmer_code.ilike.%${term}%,nic_number.ilike.%${term}%,phone.ilike.%${term}%`
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
 * Update farmer profile. Farmers can only update their own record.
 */
export const updateFarmer = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    // Farmers can only update their own profile
    if (req.user?.role === 'farmer') {
      const { data: myRecord } = await supabaseAdmin
        .from('farmers')
        .select('id')
        .eq('profile_id', req.user.id)
        .maybeSingle();

      if (!myRecord || myRecord.id !== id) {
        throw new AppError('You can only update your own farmer profile', 403);
      }
    }

    // Build clean update payload — strip undefined/null to avoid overwriting good data
    const allowed = req.user?.role === 'farmer' ? FARMER_EDITABLE : STAFF_EDITABLE;
    const rawUpdates: Record<string, unknown> = { updated_by: req.user?.id };
    for (const k of allowed) if (k in req.body) rawUpdates[k] = req.body[k];
    if (typeof req.body.account_number === 'string' && req.body.account_number.length >= 4) {
      rawUpdates.account_number_masked = `****${req.body.account_number.slice(-4)}`;
    }

    // Remove null/undefined values so they don't accidentally clear existing data
    const updates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(rawUpdates)) {
      if (value !== null && value !== undefined && value !== '') {
        updates[key] = value;
      }
    }

    const { data, error } = await supabaseAdmin
      .from('farmers')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') throw new AppError(/nic/i.test(error.message) ? 'A farmer with this NIC number already exists' : 'These details already belong to another farmer record', 409);
      throw new AppError(error.message, 500);
    }
    if (!data) throw new AppError('Farmer record not found', 404);

    // Sync full_name and phone to user profiles table
    if (data.profile_id && (updates.full_name || updates.phone)) {
      const profileUpdates: Record<string, any> = {};
      if (updates.full_name) profileUpdates.full_name = updates.full_name;
      if (updates.phone) profileUpdates.phone = updates.phone;
      await supabaseAdmin.from('profiles').update(profileUpdates).eq('id', data.profile_id);
    }

    sendSuccess(res, { message: 'Farmer profile updated successfully', data });
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

    if (verification_status && !['unverified', 'pending', 'verified', 'rejected'].includes(verification_status)) {
      throw new AppError('Invalid verification status', 400);
    }
    if (account_status && !['active', 'inactive', 'suspended', 'pending'].includes(account_status)) {
      throw new AppError('Invalid account status', 400);
    }

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

    // Sync verification status to profile table if profile_id or email is linked
    if (verification_status) {
      const targetProfileId = data.profile_id;
      if (targetProfileId) {
        if (verification_status === 'verified') {
          await supabaseAdmin.from('profiles').update({ account_status: 'active' }).eq('id', targetProfileId);
        } else if (verification_status === 'rejected') {
          await supabaseAdmin.from('profiles').update({ account_status: 'inactive' }).eq('id', targetProfileId);
        }
      } else if (data.email) {
        const { data: prof } = await supabaseAdmin.from('profiles').select('id').eq('email', data.email).maybeSingle();
        if (prof?.id) {
          await supabaseAdmin.from('farmers').update({ profile_id: prof.id }).eq('id', data.id);
          if (verification_status === 'verified') {
            await supabaseAdmin.from('profiles').update({ account_status: 'active' }).eq('id', prof.id);
          } else if (verification_status === 'rejected') {
            await supabaseAdmin.from('profiles').update({ account_status: 'inactive' }).eq('id', prof.id);
          }
        }
      }
    }

    if (verification_status && ['verified', 'rejected'].includes(verification_status)) {
      await notifyUser(data.profile_id, 'account_approval',
        verification_status === 'verified' ? 'Registration approved' : 'Registration not approved',
        verification_status === 'verified'
          ? 'Your farmer registration has been verified. You can now register crops and schedule deliveries.'
          : `Your farmer registration was not approved${notes ? ': ' + notes : '.'} Please contact your collection centre.`,
        'farmer', data.id);
    }
    sendSuccess(res, { message: 'Farmer status updated', data });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/farmers/:id/crops
 */
export const getFarmerCrops = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    await assertFarmerAccess(req, id);

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
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    await assertFarmerAccess(req, id);
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
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    await assertFarmerAccess(req, id);

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
