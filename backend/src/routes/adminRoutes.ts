import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import { supabaseAdmin } from '../config/supabase';
import { sendSuccess, paginatedResponse } from '../utils/response';
import { AppError } from '../utils/AppError';

const router = Router();
router.use(authenticate, requireRole('administrator'));

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
          nic_number: `NIC-${codeSuffix}`,
          full_name,
          email,
          phone: phone || '0700000000',
          address: 'Sri Lanka',
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
          phone: phone || '0700000000',
          address: 'Sri Lanka',
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
    const { data, error } = await supabaseAdmin
      .from('collection_centres')
      .insert({
        name, code, address, district, phone, email,
        manager_id: manager_id || null,
        capacity_kg: capacity_kg || null,
        is_active: true,
        created_by: req.user?.id,
      })
      .select('*, profiles!manager_id(full_name, email)')
      .single();
    if (error) throw new AppError(error.message, 500);
    sendSuccess(res, { data, statusCode: 201, message: 'Collection centre created' });
  } catch (e) { next(e); }
});

// PUT update collection centre
router.put('/centres/:id', async (req: any, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('collection_centres')
      .update({ ...req.body, updated_by: req.user?.id })
      .eq('id', req.params.id)
      .select('*, profiles!manager_id(full_name, email)')
      .single();
    if (error) throw new AppError(error.message, 500);
    sendSuccess(res, { data, message: 'Collection centre updated' });
  } catch (e) { next(e); }
});

export default router;
