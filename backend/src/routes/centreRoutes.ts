import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import { supabaseAdmin } from '../config/supabase';
import { sendSuccess } from '../utils/response';
import { AppError } from '../utils/AppError';

const router = Router();
router.use(authenticate);  // All routes require login
// Note: requireRole is applied per-route below (GET is open to all authenticated users)

const SRI_LANKA_DISTRICTS = [
  'Ampara', 'Anuradhapura', 'Badulla', 'Batticaloa', 'Colombo',
  'Galle', 'Gampaha', 'Hambantota', 'Jaffna', 'Kalutara',
  'Kandy', 'Kegalle', 'Kilinochchi', 'Kurunegala', 'Mannar',
  'Matale', 'Matara', 'Monaragala', 'Mullaitivu', 'Nuwara Eliya',
  'Polonnaruwa', 'Puttalam', 'Ratnapura', 'Trincomalee', 'Vavuniya',
];

// ─── GET /centres ────────────────────────────────────────────────────────────
// List all collection centres with basic stats
router.get('/', async (_req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('collection_centres')
      .select('*, profiles!manager_id(id, full_name, email)')
      .order('name');

    if (error) throw new AppError(error.message, 500);
    sendSuccess(res, { data: data || [] });
  } catch (e) { next(e); }
});

// ─── GET /centres/:id ────────────────────────────────────────────────────────
router.get('/:id', async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('collection_centres')
      .select('*, profiles!manager_id(id, full_name, email)')
      .eq('id', req.params.id)
      .single();

    if (error || !data) throw new AppError('Collection centre not found', 404);
    sendSuccess(res, { data });
  } catch (e) { next(e); }
});

// ─── POST /centres ───────────────────────────────────────────────────────────
// Register a new collection centre (officers + admins only)
router.post('/', requireRole('collection_centre_officer', 'administrator'), async (req: any, res, next) => {
  try {
    const { name, code, address, district, phone, email, capacity_kg } = req.body;

    if (!name?.trim()) throw new AppError('Centre name is required', 400);
    if (!code?.trim()) throw new AppError('Centre code is required', 400);
    if (!address?.trim()) throw new AppError('Address is required', 400);
    if (!district || !SRI_LANKA_DISTRICTS.includes(district)) {
      throw new AppError('A valid Sri Lankan district is required', 400);
    }

    const { data, error } = await supabaseAdmin
      .from('collection_centres')
      .insert({
        name: name.trim(),
        code: code.trim().toUpperCase(),
        address: address.trim(),
        district,
        phone: phone?.trim() || null,
        email: email?.trim() || null,
        capacity_kg: capacity_kg ? parseFloat(capacity_kg) : null,
        is_active: true,
        created_by: req.user.id,
      })
      .select('*, profiles!manager_id(id, full_name, email)')
      .single();

    if (error) {
      if (error.code === '23505') throw new AppError(`A centre with code "${code.toUpperCase()}" already exists`, 409);
      throw new AppError(error.message, 500);
    }

    sendSuccess(res, { data, statusCode: 201, message: 'Collection centre registered successfully' });
  } catch (e) { next(e); }
});

// ─── PUT /centres/:id ────────────────────────────────────────────────────────
// Update an existing collection centre (officers + admins only)
router.put('/:id', requireRole('collection_centre_officer', 'administrator'), async (req: any, res, next) => {
  try {
    const { name, address, district, phone, email, capacity_kg, is_active } = req.body;
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (name !== undefined) updates.name = name.trim();
    if (address !== undefined) updates.address = address.trim();
    if (district !== undefined) {
      if (!SRI_LANKA_DISTRICTS.includes(district)) throw new AppError('Invalid district', 400);
      updates.district = district;
    }
    if (phone !== undefined) updates.phone = phone?.trim() || null;
    if (email !== undefined) updates.email = email?.trim() || null;
    if (capacity_kg !== undefined) updates.capacity_kg = capacity_kg ? parseFloat(capacity_kg) : null;
    if (is_active !== undefined) updates.is_active = is_active;

    const { data, error } = await supabaseAdmin
      .from('collection_centres')
      .update(updates)
      .eq('id', req.params.id)
      .select('*, profiles!manager_id(id, full_name, email)')
      .single();

    if (error) throw new AppError(error.message, 500);
    sendSuccess(res, { data, message: 'Collection centre updated successfully' });
  } catch (e) { next(e); }
});

export default router;
