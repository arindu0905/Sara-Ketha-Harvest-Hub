import { supabaseAdmin } from '../config/supabase';
import { AppError } from '../utils/AppError';

/**
 * A delivery in one of these states keeps its driver and its vehicle occupied.
 * They are free again as soon as the delivery is delivered, failed or cancelled.
 */
export const ACTIVE_DELIVERY_STATUSES = ['scheduled', 'in_transit', 'arrived'];

export interface BusyInfo { schedule_no: string; scheduled_date: string; scheduled_time: string | null; status: string }
export interface Busy { vehicles: Record<string, BusyInfo>; drivers: Record<string, BusyInfo> }

/**
 * Vehicles and drivers that are already assigned to an active delivery.
 * The date and time are ignored on purpose: once a vehicle or a driver is scheduled for a delivery it cannot be
 * selected for another one until that delivery is completed or cancelled.
 * `excludeScheduleId` lets an existing delivery be edited without blocking itself.
 */
export async function findBusyResources(_date?: string | null, _time?: string | null, excludeScheduleId?: string): Promise<Busy> {
  let q = supabaseAdmin
    .from('delivery_schedules')
    .select('id, schedule_no, vehicle_id, driver_id, scheduled_date, scheduled_time, status')
    .in('status', ACTIVE_DELIVERY_STATUSES)
    .order('scheduled_date');
  if (excludeScheduleId) q = q.neq('id', excludeScheduleId);
  const { data, error } = await q;
  if (error) throw new AppError(error.message, 500);

  const busy: Busy = { vehicles: {}, drivers: {} };
  for (const row of data ?? []) {
    const info: BusyInfo = { schedule_no: row.schedule_no, scheduled_date: row.scheduled_date, scheduled_time: row.scheduled_time, status: row.status };
    if (row.vehicle_id && !busy.vehicles[row.vehicle_id]) busy.vehicles[row.vehicle_id] = info;
    if (row.driver_id && !busy.drivers[row.driver_id]) busy.drivers[row.driver_id] = info;
  }
  return busy;
}

const when = (b: BusyInfo) =>
  `${new Date(String(b.scheduled_date).slice(0, 10) + 'T00:00:00').toLocaleDateString('en-LK', { day: 'numeric', month: 'short', year: 'numeric' })}${b.scheduled_time ? ' at ' + b.scheduled_time.slice(0, 5) : ''}`;

/**
 * Throws 409 unless the driver and the vehicle exist, are active, and are not already on another active delivery.
 */
export async function assertDriverAndVehicleFree(opts: {
  vehicle_id?: string | null; driver_id?: string | null; scheduled_date?: string; scheduled_time?: string | null; excludeScheduleId?: string;
}): Promise<void> {
  const { vehicle_id, driver_id, excludeScheduleId } = opts;
  if (!vehicle_id && !driver_id) return;

  let vehicleName = '', driverName = '';
  if (vehicle_id) {
    const { data: v } = await supabaseAdmin.from('transport_vehicles').select('plate_number, is_active').eq('id', vehicle_id).maybeSingle();
    if (!v) throw new AppError('The selected vehicle does not exist', 400);
    if (v.is_active === false) throw new AppError(`Vehicle ${v.plate_number} is inactive and cannot be assigned`, 409);
    vehicleName = v.plate_number;
  }
  if (driver_id) {
    const { data: d } = await supabaseAdmin.from('drivers').select('full_name, is_active').eq('id', driver_id).maybeSingle();
    if (!d) throw new AppError('The selected driver does not exist', 400);
    if (d.is_active === false) throw new AppError(`Driver ${d.full_name} is inactive and cannot be assigned`, 409);
    driverName = d.full_name;
  }

  const busy = await findBusyResources(null, null, excludeScheduleId);
  if (vehicle_id && busy.vehicles[vehicle_id]) {
    const b = busy.vehicles[vehicle_id];
    throw new AppError(`Vehicle ${vehicleName} is already scheduled for delivery ${b.schedule_no} (${when(b)}). It cannot be assigned again until that delivery is completed or cancelled.`, 409);
  }
  if (driver_id && busy.drivers[driver_id]) {
    const b = busy.drivers[driver_id];
    throw new AppError(`Driver ${driverName} is already scheduled for delivery ${b.schedule_no} (${when(b)}). They cannot be assigned again until that delivery is completed or cancelled.`, 409);
  }
}
