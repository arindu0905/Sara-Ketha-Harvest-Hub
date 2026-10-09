import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import { supabaseAdmin } from '../config/supabase';
import { sendSuccess } from '../utils/response';
import { AppError } from '../utils/AppError';

const router = Router();
router.use(authenticate);

// ─── GET /warehouses ────────────────────────────────────────────────────────
// List all warehouses with capacity stats (used / available)
router.get('/', async (req, res, next) => {
  try {
    let query = supabaseAdmin
      .from('warehouses')
      .select(`
        *,
        storage_locations(*),
        collection_centres!centre_id(id, name, code, district)
      `);

    // If query string explicitly requests active only, filter it; default to returning all for complete management
    if (req.query.active_only === 'true') {
      query = query.eq('is_active', true);
    }

    const { data: warehouses, error } = await query
      .order('is_active', { ascending: false })
      .order('name', { ascending: true });

    if (error) throw new AppError(error.message, 500);

    // For each warehouse compute used capacity from active batches
    const warehouseIds = (warehouses || []).map((w: any) => w.id);
    let usageMap: Record<string, number> = {};

    if (warehouseIds.length > 0) {
      const { data: batches } = await supabaseAdmin
        .from('inventory_batches')
        .select('warehouse_id, available_qty_kg')
        .in('warehouse_id', warehouseIds)
        .not('status', 'in', '(sold,disposed,expired)');

      (batches || []).forEach((b: any) => {
        if (b.warehouse_id) {
          usageMap[b.warehouse_id] = (usageMap[b.warehouse_id] || 0) + Number(b.available_qty_kg || 0);
        }
      });
    }

    const enriched = (warehouses || []).map((w: any) => {
      const used_capacity_kg = usageMap[w.id] || 0;
      const available_space_kg = w.capacity_kg ? Math.max(0, w.capacity_kg - used_capacity_kg) : null;
      const utilisation_pct = w.capacity_kg ? Math.min(100, Math.round((used_capacity_kg / w.capacity_kg) * 100)) : 0;
      return { ...w, used_capacity_kg, available_space_kg, utilisation_pct };
    });

    sendSuccess(res, { data: enriched });
  } catch (e) { next(e); }
});

// ─── GET /warehouses/deliveries ──────────────────────────────────────────────
// Defined before /:id so 'deliveries' is not captured as an id parameter
router.get('/deliveries', async (_req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('delivery_schedules')
      .select(`*, transport_vehicles!vehicle_id(plate_number, vehicle_type), drivers!driver_id(full_name), purchase_orders!order_id(order_no, buyers!buyer_id(company_name))`)
      .order('scheduled_date', { ascending: false });
    if (error) throw new AppError(error.message, 500);
    sendSuccess(res, { data: data || [] });
  } catch (e) { next(e); }
});

// ─── POST /warehouses/deliveries ─────────────────────────────────────────────
router.post('/deliveries', requireRole('transport_coordinator', 'administrator'), async (req: any, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('delivery_schedules')
      .insert({ ...req.body, schedule_no: `SCH-${Date.now()}`, created_by: req.user.id })
      .select().single();
    if (error) throw new AppError(error.message, 500);
    sendSuccess(res, { data, statusCode: 201, message: 'Delivery scheduled' });
  } catch (e) { next(e); }
});

// ─── GET /warehouses/:id ─────────────────────────────────────────────────────
// Single warehouse with storage locations + capacity stats + stored batches
router.get('/:id', async (req, res, next) => {
  try {
    const { data: warehouse, error } = await supabaseAdmin
      .from('warehouses')
      .select(`
        *,
        storage_locations(*),
        collection_centres!centre_id(id, name, code, district)
      `)
      .eq('id', req.params.id)
      .single();

    if (error || !warehouse) throw new AppError('Warehouse not found', 404);

    // Compute used capacity & fetch stored batches with crop and location details
    const { data: batches } = await supabaseAdmin
      .from('inventory_batches')
      .select(`
        *,
        crops!crop_id(id, name, code, category),
        storage_locations!storage_location_id(id, code, description)
      `)
      .eq('warehouse_id', req.params.id)
      .order('created_at', { ascending: false });

    const activeBatches = (batches || []).filter((b: any) => !['sold', 'disposed', 'expired'].includes(b.status));
    const used_capacity_kg = activeBatches.reduce((sum: number, b: any) => sum + Number(b.available_qty_kg || 0), 0);
    const available_space_kg = warehouse.capacity_kg ? Math.max(0, warehouse.capacity_kg - used_capacity_kg) : null;
    const utilisation_pct = warehouse.capacity_kg ? Math.min(100, Math.round((used_capacity_kg / warehouse.capacity_kg) * 100)) : 0;

    sendSuccess(res, {
      data: {
        ...warehouse,
        used_capacity_kg,
        available_space_kg,
        utilisation_pct,
        batches: batches || []
      }
    });
  } catch (e) { next(e); }
});

// ─── POST /warehouses ────────────────────────────────────────────────────────
// Create a new warehouse
router.post('/', requireRole('inventory_manager', 'administrator', 'collection_centre_officer', 'finance_officer'), async (req: any, res, next) => {
  try {
    const { name, centre_id, capacity_kg, address, code } = req.body;
    if (!name || !centre_id) throw new AppError('Warehouse name and collection centre are required', 400);
    if (typeof address !== 'string' || address.trim().length < 5) throw new AppError('Warehouse address is required (at least 5 characters)', 400);

    // Auto-generate code if not provided
    const warehouseCode = code || `WH-${Date.now().toString(36).toUpperCase()}`;

    const { data, error } = await supabaseAdmin
      .from('warehouses')
      .insert({
        name,
        centre_id,
        capacity_kg: capacity_kg ? parseFloat(capacity_kg) : null,
        address: address.trim(),
        code: warehouseCode,
        created_by: req.user.id,
      })
      .select(`*, collection_centres!centre_id(id, name, code, district), storage_locations(*)`)
      .single();

    if (error) throw new AppError(error.message, 500);
    sendSuccess(res, { data, statusCode: 201, message: 'Warehouse created successfully' });
  } catch (e) { next(e); }
});

// ─── PATCH /warehouses/:id ───────────────────────────────────────────────────
// Update warehouse (name, centre_id, capacity, address, code, active status)
router.patch('/:id', requireRole('inventory_manager', 'administrator', 'collection_centre_officer', 'finance_officer'), async (req: any, res, next) => {
  try {
    const { name, centre_id, capacity_kg, address, is_active, code } = req.body;
    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name;
    if (centre_id !== undefined) updates.centre_id = centre_id;
    if (code !== undefined) updates.code = code;
    if (capacity_kg !== undefined) updates.capacity_kg = capacity_kg ? parseFloat(capacity_kg) : null;
    if (address !== undefined) {
      if (typeof address !== 'string' || address.trim().length < 5) throw new AppError('Warehouse address is required (at least 5 characters)', 400);
      updates.address = address.trim();
    }
    if (is_active !== undefined) updates.is_active = is_active;
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from('warehouses')
      .update(updates)
      .eq('id', req.params.id)
      .select(`
        *,
        storage_locations(*),
        collection_centres!centre_id(id, name, code, district)
      `)
      .single();

    if (error) throw new AppError(error.message, 500);
    sendSuccess(res, { data, message: 'Warehouse updated successfully' });
  } catch (e) { next(e); }
});

// ─── POST /warehouses/:id/locations ─────────────────────────────────────────
// Add a storage location inside a warehouse
router.post('/:id/locations', requireRole('inventory_manager', 'administrator', 'collection_centre_officer', 'finance_officer'), async (req: any, res, next) => {
  try {
    const { code, description, capacity_kg } = req.body;
    if (!code) throw new AppError('Location code is required', 400);

    const { data, error } = await supabaseAdmin
      .from('storage_locations')
      .insert({
        warehouse_id: req.params.id,
        code: code.toUpperCase().trim(),
        description: description || null,
        capacity_kg: capacity_kg ? parseFloat(capacity_kg) : null,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') throw new AppError(`Location code "${code.toUpperCase()}" already exists in this warehouse`, 409);
      throw new AppError(error.message, 500);
    }

    sendSuccess(res, { data, statusCode: 201, message: 'Storage location added' });
  } catch (e) { next(e); }
});

// ─── PATCH /warehouses/:id/locations/:locId ──────────────────────────────────
// Update a storage location (description, capacity, active)
router.patch('/:id/locations/:locId', requireRole('inventory_manager', 'administrator'), async (req: any, res, next) => {
  try {
    const { description, capacity_kg, is_active } = req.body;
    const updates: Record<string, unknown> = {};
    if (description !== undefined) updates.description = description;
    if (capacity_kg !== undefined) updates.capacity_kg = capacity_kg ? parseFloat(capacity_kg) : null;
    if (is_active !== undefined) updates.is_active = is_active;

    const { data, error } = await supabaseAdmin
      .from('storage_locations')
      .update(updates)
      .eq('id', req.params.locId)
      .eq('warehouse_id', req.params.id)
      .select()
      .single();

    if (error) throw new AppError(error.message, 500);
    sendSuccess(res, { data, message: 'Storage location updated' });
  } catch (e) { next(e); }
});

// ─── DELETE /warehouses/:id/locations/:locId ─────────────────────────────────
// Soft-delete (deactivate) a storage location
router.delete('/:id/locations/:locId', requireRole('inventory_manager', 'administrator'), async (req: any, res, next) => {
  try {
    // Check no active batches are using this location
    const { count } = await supabaseAdmin
      .from('inventory_batches')
      .select('id', { count: 'exact', head: true })
      .eq('storage_location_id', req.params.locId)
      .not('status', 'in', '(sold,disposed,expired)');

    if ((count || 0) > 0) {
      throw new AppError('Cannot remove location — it has active inventory batches assigned', 409);
    }

    const { error } = await supabaseAdmin
      .from('storage_locations')
      .update({ is_active: false })
      .eq('id', req.params.locId)
      .eq('warehouse_id', req.params.id);

    if (error) throw new AppError(error.message, 500);
    sendSuccess(res, { message: 'Storage location deactivated' });
  } catch (e) { next(e); }
});

export default router;
