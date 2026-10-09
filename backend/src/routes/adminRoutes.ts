import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import { supabaseAdmin } from '../config/supabase';
import { sendSuccess, paginatedResponse } from '../utils/response';
import { AppError } from '../utils/AppError';
import { USER_ROLES } from '../schemas/validationSchemas';

const router = Router();
router.use(authenticate, requireRole('administrator'));

// ─── Farmer Verification (Admin & Collection Officers can use these) ────────

// GET /api/admin/pending-farmers — list all farmers pending verification
router.get('/pending-farmers', async (req, res, next) => {
  try {
    const { page = '1', limit = '20', search } = req.query as Record<string, string>;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;

    let query = supabaseAdmin
      .from('farmers')
      .select(`
        id, farmer_code, full_name, nic_number, phone, email,
        district, verification_status, account_status, created_at,
        profiles!profile_id(id, email, avatar_url, account_status),
        collection_centres!assigned_centre_id(name, code)
      `, { count: 'exact' })
      .eq('verification_status', 'pending');

    if (search) {
      query = query.or(
        `full_name.ilike.%${search}%,farmer_code.ilike.%${search}%,nic_number.ilike.%${search}%,phone.ilike.%${search}%`
      );
    }

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limitNum - 1);

    if (error) throw new AppError(error.message, 500);
    paginatedResponse(res, data || [], { page: pageNum, limit: limitNum, total: count || 0 });
  } catch (e) { next(e); }
});

// PATCH /api/admin/farmers/:id/verify — approve or reject a farmer account
router.patch('/farmers/:id/verify', async (req: any, res, next) => {
  try {
    const { id } = req.params;
    const { verification_status, notes } = req.body;

    if (!['verified', 'rejected', 'pending'].includes(verification_status)) {
      throw new AppError('verification_status must be "verified", "rejected", or "pending"', 400);
    }

    const updates: Record<string, unknown> = {
      verification_status,
      updated_by: req.user?.id,
    };

    if (verification_status === 'verified') {
      updates.verified_by = req.user?.id;
      updates.verified_at = new Date().toISOString();
    }
    if (notes) updates.notes = notes;

    const { data: farmer, error } = await supabaseAdmin
      .from('farmers')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new AppError(error.message, 500);
    if (!farmer) throw new AppError('Farmer not found', 404);

    // Sync account_status on the linked profile
    if (farmer.profile_id) {
      const newAccountStatus = verification_status === 'verified' ? 'active'
        : verification_status === 'rejected' ? 'inactive'
        : 'pending';

      await supabaseAdmin
        .from('profiles')
        .update({ account_status: newAccountStatus })
        .eq('id', farmer.profile_id);
    } else if (farmer.email) {
      // Try to find profile by email
      const { data: prof } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('email', farmer.email)
        .maybeSingle();

      if (prof?.id) {
        const newAccountStatus = verification_status === 'verified' ? 'active'
          : verification_status === 'rejected' ? 'inactive'
          : 'pending';
        await supabaseAdmin.from('profiles').update({ account_status: newAccountStatus }).eq('id', prof.id);
        // Link profile_id for future lookups
        await supabaseAdmin.from('farmers').update({ profile_id: prof.id }).eq('id', id);
      }
    }

    sendSuccess(res, {
      message: `Farmer account ${verification_status === 'verified' ? 'approved and verified' : verification_status === 'rejected' ? 'rejected' : 'set to pending review'} successfully.`,
      data: farmer,
    });
  } catch (e) { next(e); }
});


// GET all users
router.get('/users', async (req, res, next) => {
  try {
    const { page = '1', limit = '20', role, status, search } = req.query as Record<string, string>;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;

    let query = supabaseAdmin
      .from('profiles')
      .select('id, email, full_name, role, account_status, created_at, assigned_centre, collection_centres!assigned_centre(name)', { count: 'exact' });

    if (role) query = query.eq('role', role);
    if (status) query = query.eq('account_status', status);
    if (search) query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`);

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limitNum - 1);

    if (error) throw new AppError(error.message, 500);
    paginatedResponse(res, data || [], { page: pageNum, limit: limitNum, total: count || 0 });
  } catch (e) { next(e); }
});

// POST create user by admin
router.post('/users', async (req, res, next) => {
  try {
    const { email, password, full_name, role = 'farmer', phone, district = 'Colombo' } = req.body;
    if (!email || !password || !full_name) {
      throw new AppError('Email, password, and full name are required', 400);
    }
    if (!(USER_ROLES as readonly string[]).includes(role)) throw new AppError('Invalid role', 400);
    if (String(password).length < 8) throw new AppError('Password must be at least 8 characters', 400);

    const hashedPassword = (await import('bcryptjs')).default.hashSync(password, 10);

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name, role, phone, encrypted_password: hashedPassword },
    });

    if (authError) throw new AppError(authError.message, 400);

    const userId = authData.user?.id;
    if (userId) {
      // Upsert profile with encrypted password
      await supabaseAdmin.from('profiles').upsert({
        id: userId,
        email,
        full_name,
        role,
        account_status: 'active',
        phone: phone || null,
        encrypted_password: hashedPassword,
      });

      const codeSuffix = userId.replace(/-/g, '').substring(0, 8).toUpperCase();

      // Create role-specific database record
      if (role === 'farmer') {
        await supabaseAdmin.from('farmers').upsert({
          profile_id: userId,
          farmer_code: `FAR-${codeSuffix}`,
          nic_number: null,
          full_name,
          email,
          phone: phone || null,
          address: null,
          district,
          verification_status: 'verified',
          account_status: 'active',
        });
      } else if (role === 'buyer') {
        await supabaseAdmin.from('buyers').upsert({
          profile_id: userId,
          buyer_code: `BUY-${codeSuffix}`,
          company_name: full_name,
          contact_person: full_name,
          email,
          phone: phone || null,
          address: null,
          district,
          verification_status: 'verified',
          account_status: 'active',
        });
      }
    }

    sendSuccess(res, { message: 'User created successfully', data: authData.user, statusCode: 201 });
  } catch (e) { next(e); }
});

// PATCH user role
router.patch('/users/:id/role', async (req, res, next) => {
  try {
    const { role } = req.body;
    if (!(USER_ROLES as readonly string[]).includes(role)) throw new AppError('Invalid role', 400);
    if (req.params.id === (req as any).user?.id && role !== 'administrator') throw new AppError('You cannot remove your own administrator role', 409);
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update({ role })
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw new AppError(error.message, 500);
    sendSuccess(res, { data, message: 'User role updated' });
  } catch (e) { next(e); }
});

// PATCH user status
router.patch('/users/:id/status', async (req, res, next) => {
  try {
    const { account_status } = req.body;
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update({ account_status })
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw new AppError(error.message, 500);

    // Also update Supabase auth user (ban/unban)
    if (account_status === 'suspended' || account_status === 'inactive') {
      await supabaseAdmin.auth.admin.updateUserById(req.params.id, {
        ban_duration: account_status === 'suspended' ? '876000h' : '876000h',
      });
    } else if (account_status === 'active') {
      await supabaseAdmin.auth.admin.updateUserById(req.params.id, { ban_duration: 'none' });
    }

    sendSuccess(res, { data, message: 'User status updated' });
  } catch (e) { next(e); }
});

// DELETE user
// A user who has history (collections, payments, audit entries ...) is referenced by many tables, so a hard delete is
// refused by the database. In that case the account is DEACTIVATED and blocked from signing in instead, which keeps the
// records intact. Users with no history are removed completely.
router.delete('/users/:id', async (req: any, res, next) => {
  try {
    const { id } = req.params;

    if (req.user?.id === id) {
      throw new AppError('You cannot delete your own account', 400);
    }

    const { data: target } = await supabaseAdmin.from('profiles').select('id, role, full_name').eq('id', id).maybeSingle();
    if (!target) throw new AppError('User not found', 404);

    if (target.role === 'administrator') {
      const { count } = await supabaseAdmin.from('profiles').select('id', { count: 'exact', head: true })
        .eq('role', 'administrator').eq('account_status', 'active');
      if ((count ?? 0) <= 1) throw new AppError('The last active administrator cannot be deleted', 400);
    }

    const FK_VIOLATION = '23503';
    const deactivate = async () => {
      // Release the email address: the records keep pointing at this (now anonymised) account, while the real
      // address can be registered again as a brand-new account.
      const tombstone = `deleted+${id}@deleted.invalid`;
      await supabaseAdmin.from('profiles').update({ account_status: 'inactive', email: tombstone }).eq('id', id);
      await supabaseAdmin.from('farmers').update({ account_status: 'inactive', email: tombstone }).eq('profile_id', id);
      await supabaseAdmin.from('buyers').update({ account_status: 'inactive', email: tombstone }).eq('profile_id', id);
      await supabaseAdmin.auth.admin.updateUserById(id, { email: tombstone, email_confirm: true, ban_duration: '876000h' });
      sendSuccess(res, {
        data: { id, deactivated: true },
        message: `${target.full_name || 'This user'} has activity records, so the account was deactivated and can no longer sign in (records are kept). The email address can be registered again.`,
      });
    };

    // role-specific rows first
    for (const table of ['farmers', 'buyers']) {
      const { error } = await supabaseAdmin.from(table).delete().eq('profile_id', id);
      if (error) {
        if (error.code === FK_VIOLATION) return await deactivate();
        throw new AppError(error.message, 500);
      }
    }

    // then the profile
    const { error: profErr } = await supabaseAdmin.from('profiles').delete().eq('id', id);
    if (profErr) {
      if (profErr.code === FK_VIOLATION) return await deactivate();
      throw new AppError(profErr.message, 500);
    }

    // finally the login
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(id);
    if (authError && !/not found/i.test(authError.message)) throw new AppError(authError.message, 500);

    sendSuccess(res, { data: { id, deactivated: false }, message: 'User deleted successfully' });
  } catch (e) { next(e); }
});

// GET audit logs
router.get('/audit-logs', async (req, res, next) => {
  try {
    const { entity_type, actor_id, page = '1', limit = '50' } = req.query as Record<string, string>;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;

    let query = supabaseAdmin
      .from('audit_logs')
      .select('*, profiles!actor_id(full_name, email)', { count: 'exact' });

    if (entity_type) query = query.eq('entity_type', entity_type);
    if (actor_id) query = query.eq('actor_id', actor_id);

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limitNum - 1);

    if (error) throw new AppError(error.message, 500);
    paginatedResponse(res, data || [], { page: pageNum, limit: limitNum, total: count || 0 });
  } catch (e) { next(e); }
});

// GET system settings
router.get('/settings', async (_req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('system_settings')
      .select('*')
      .order('key');
    if (error) throw new AppError(error.message, 500);
    sendSuccess(res, { data: data || [] });
  } catch (e) { next(e); }
});

// PUT update setting
router.put('/settings/:key', async (req: any, res, next) => {
  try {
    const { value } = req.body;
    const { data, error } = await supabaseAdmin
      .from('system_settings')
      .upsert({ key: req.params.key, value, updated_by: req.user?.id })
      .select()
      .single();
    if (error) throw new AppError(error.message, 500);
    sendSuccess(res, { data, message: 'Setting updated' });
  } catch (e) { next(e); }
});

// GET collection centres
router.get('/centres', async (_req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('collection_centres')
      .select('*, profiles!manager_id(full_name, email)')
      .order('name');
    if (error) throw new AppError(error.message, 500);
    sendSuccess(res, { data: data || [] });
  } catch (e) { next(e); }
});

// POST create collection centre
router.post('/centres', async (req: any, res, next) => {
  try {
    const { name, code, address, district, phone, email, manager_id, capacity_kg } = req.body;
    if (!name || !code || !address || !district) {
      throw new AppError('Name, code, address, and district are required', 400);
    }

    const payload: Record<string, any> = {
      name,
      code,
      address,
      district,
      phone: phone || null,
      email: email || null,
      manager_id: manager_id || null,
      is_active: true,
      created_by: req.user?.id,
    };

    if (capacity_kg !== undefined && capacity_kg !== null && capacity_kg !== '') {
      payload.capacity_kg = parseFloat(capacity_kg);
    }

    let insertRes = await supabaseAdmin
      .from('collection_centres')
      .insert(payload)
      .select('*, profiles!manager_id(full_name, email)')
      .single();

    // If capacity_kg column is missing in older schema, retry without it
    if (insertRes.error && insertRes.error.message.includes('capacity_kg')) {
      delete payload.capacity_kg;
      insertRes = await supabaseAdmin
        .from('collection_centres')
        .insert(payload)
        .select('*, profiles!manager_id(full_name, email)')
        .single();
    }

    if (insertRes.error) throw new AppError(insertRes.error.message, 500);
    sendSuccess(res, { data: insertRes.data, statusCode: 201, message: 'Collection centre created successfully' });
  } catch (e) { next(e); }
});

// PUT update collection centre
router.put('/centres/:id', async (req: any, res, next) => {
  try {
    const CENTRE_EDITABLE = ['name', 'code', 'address', 'district', 'phone', 'email', 'manager_id', 'latitude', 'longitude', 'is_active', 'capacity_kg'];
    const payload: Record<string, unknown> = {
      ...Object.fromEntries(Object.entries(req.body || {}).filter(([k, v]) => CENTRE_EDITABLE.includes(k) && v !== undefined)),
      updated_at: new Date().toISOString(),
    };

    let updateRes = await supabaseAdmin
      .from('collection_centres')
      .update(payload)
      .eq('id', req.params.id)
      .select('*, profiles!manager_id(full_name, email)')
      .single();

    // If capacity_kg column is missing in older schema, retry without it
    if (updateRes.error && updateRes.error.message.includes('capacity_kg')) {
      delete payload.capacity_kg;
      updateRes = await supabaseAdmin
        .from('collection_centres')
        .update(payload)
        .eq('id', req.params.id)
        .select('*, profiles!manager_id(full_name, email)')
        .single();
    }

    if (updateRes.error) throw new AppError(updateRes.error.message, 500);
    sendSuccess(res, { data: updateRes.data, message: 'Collection centre updated successfully' });
  } catch (e) { next(e); }
});

export default router;
