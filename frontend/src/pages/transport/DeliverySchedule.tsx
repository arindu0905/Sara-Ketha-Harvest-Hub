import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { deliveriesApi } from '../../services/api';
import {
  Truck, Calendar, Plus, Search, Filter, Edit3, Trash2,
  CheckCircle, Navigation, AlertCircle, Clock, MapPin,
  RefreshCw, User, Phone, XCircle, ArrowRight
} from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { useLanguage } from '../../contexts/LanguageContext';
import toast from 'react-hot-toast';

interface DeliveryScheduleItem {
  id: string;
  schedule_no: string;
  order_id: string | null;
  vehicle_id: string | null;
  driver_id: string | null;
  pickup_address: string;
  delivery_address: string;
  scheduled_date: string;
  scheduled_time: string | null;
  status: 'scheduled' | 'in_transit' | 'arrived' | 'delivered' | 'failed' | 'cancelled';
  notes: string | null;
  created_at: string;
  transport_vehicles?: {
    id: string;
    plate_number: string;
    vehicle_type: string;
    capacity_kg: number | null;
  } | null;
  drivers?: {
    id: string;
    full_name: string;
    phone: string;
    license_no: string;
  } | null;
  purchase_orders?: {
    id: string;
    order_no: string;
    total_amount_lkr: number;
    delivery_address: string;
    buyers?: {
      company_name: string;
      contact_person: string;
      phone: string;
    } | null;
  } | null;
}

const STATUS_BADGE_MAP: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
  scheduled: { label: 'Scheduled', className: 'bg-amber-100 text-amber-800 border-amber-200', icon: <Clock size={12} /> },
  in_transit: { label: 'In Transit', className: 'bg-blue-100 text-blue-800 border-blue-200', icon: <Navigation size={12} className="animate-pulse" /> },
  arrived: { label: 'Arrived', className: 'bg-teal-100 text-teal-800 border-teal-200', icon: <MapPin size={12} /> },
  delivered: { label: 'Delivered', className: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: <CheckCircle size={12} /> },
  failed: { label: 'Failed', className: 'bg-rose-100 text-rose-800 border-rose-200', icon: <XCircle size={12} /> },
  cancelled: { label: 'Cancelled', className: 'bg-gray-100 text-gray-700 border-gray-200', icon: <XCircle size={12} /> },
};

const INITIAL_SCHEDULE_FORM = {
  order_id: '',
  vehicle_id: '',
  driver_id: '',
  pickup_address: 'Central Storage Hub, Colombo',
  delivery_address: '',
  scheduled_date: new Date().toISOString().slice(0, 10),
  scheduled_time: '09:00',
  notes: '',
};

export const DeliverySchedule: React.FC = () => {
  const queryClient = useQueryClient();
  const { t } = useLanguage();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [scheduleForm, setScheduleForm] = useState(INITIAL_SCHEDULE_FORM);
  const [editingSchedule, setEditingSchedule] = useState<DeliveryScheduleItem | null>(null);
  const [scheduleToDelete, setScheduleToDelete] = useState<DeliveryScheduleItem | null>(null);

  // Queries
  const { data: schedulesRes, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['transport-schedules', statusFilter, search],
    queryFn: () => deliveriesApi.getAll({ status: statusFilter, search }),
  });

  const { data: vehiclesRes } = useQuery({
    queryKey: ['transport-vehicles-list'],
    queryFn: () => deliveriesApi.getVehicles(),
  });

  const { data: driversRes } = useQuery({
    queryKey: ['transport-drivers-list'],
    queryFn: () => deliveriesApi.getDrivers(),
  });

  const { data: ordersRes } = useQuery({
    queryKey: ['transport-orders-list'],
    queryFn: () => deliveriesApi.getAvailableOrders(),
  });

  // vehicles / drivers already on a delivery at the chosen date and time
  const { data: busyCreateRes } = useQuery({
    queryKey: ['delivery-availability', 'create', scheduleForm.scheduled_date, scheduleForm.scheduled_time],
    queryFn: () => deliveriesApi.getAvailability(scheduleForm.scheduled_date, scheduleForm.scheduled_time),
    enabled: showCreateModal && !!scheduleForm.scheduled_date,
  });
  const { data: busyEditRes } = useQuery({
    queryKey: ['delivery-availability', 'edit', editingSchedule?.id, editingSchedule?.scheduled_date, editingSchedule?.scheduled_time],
    queryFn: () => deliveriesApi.getAvailability(String(editingSchedule!.scheduled_date).slice(0, 10), editingSchedule!.scheduled_time?.slice(0, 5) || undefined, editingSchedule!.id),
    enabled: !!editingSchedule?.scheduled_date,
  });
  const busyCreate = busyCreateRes?.data?.data || { vehicles: {}, drivers: {} };
  const busyEdit = busyEditRes?.data?.data || { vehicles: {}, drivers: {} };

  const schedules: DeliveryScheduleItem[] = schedulesRes?.data?.data || [];
  const vehicles = vehiclesRes?.data?.data || [];
  const drivers = driversRes?.data?.data || [];
  const orders = ordersRes?.data?.data || [];

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: typeof INITIAL_SCHEDULE_FORM) => deliveriesApi.create(data),
    onSuccess: () => {
      toast.success('Delivery scheduled successfully!');
      queryClient.invalidateQueries({ queryKey: ['transport-schedules'] });
      queryClient.invalidateQueries({ queryKey: ['transport-deliveries-dash'] });
      queryClient.invalidateQueries({ queryKey: ['transport-active-deliveries'] });
      setShowCreateModal(false);
      setScheduleForm(INITIAL_SCHEDULE_FORM);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to create delivery schedule');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<DeliveryScheduleItem> }) => deliveriesApi.update(id, data),
    onSuccess: () => {
      toast.success('Delivery schedule updated!');
      queryClient.invalidateQueries({ queryKey: ['transport-schedules'] });
      queryClient.invalidateQueries({ queryKey: ['transport-deliveries-dash'] });
      queryClient.invalidateQueries({ queryKey: ['transport-active-deliveries'] });
      setEditingSchedule(null);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to update schedule');
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => deliveriesApi.updateStatus(id, { status }),
    onSuccess: () => {
      toast.success('Status updated successfully!');
      queryClient.invalidateQueries({ queryKey: ['transport-schedules'] });
      queryClient.invalidateQueries({ queryKey: ['transport-deliveries-dash'] });
      queryClient.invalidateQueries({ queryKey: ['transport-active-deliveries'] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to update status');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deliveriesApi.delete(id),
    onSuccess: () => {
      toast.success('Delivery schedule deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['transport-schedules'] });
      queryClient.invalidateQueries({ queryKey: ['transport-deliveries-dash'] });
      queryClient.invalidateQueries({ queryKey: ['transport-active-deliveries'] });
      setScheduleToDelete(null);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to delete schedule');
      setScheduleToDelete(null);
    },
  });

  const handleOrderSelect = (orderId: string) => {
    const selected = orders.find((o: any) => o.id === orderId);
    if (selected) {
      setScheduleForm(prev => ({
        ...prev,
        order_id: orderId,
        delivery_address: selected.delivery_address || prev.delivery_address,
      }));
    } else {
      setScheduleForm(prev => ({ ...prev, order_id: orderId }));
    }
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!scheduleForm.delivery_address.trim()) {
      return toast.error('Please enter a delivery destination address');
    }
    if (!scheduleForm.scheduled_date) {
      return toast.error('Please specify a delivery date');
    }
    createMutation.mutate(scheduleForm);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSchedule) return;
    updateMutation.mutate({
      id: editingSchedule.id,
      data: {
        order_id: editingSchedule.order_id,
        vehicle_id: editingSchedule.vehicle_id,
        driver_id: editingSchedule.driver_id,
        pickup_address: editingSchedule.pickup_address,
        delivery_address: editingSchedule.delivery_address,
        scheduled_date: editingSchedule.scheduled_date,
        scheduled_time: editingSchedule.scheduled_time,
        status: editingSchedule.status,
        notes: editingSchedule.notes,
      },
    });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ─── Page Header ──────────────────────────────────────────────────────── */}
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Truck className="text-primary-600" size={28} />
            Delivery Schedule
          </h1>
          <p className="page-subtitle">Master schedule and dispatch management for all transport operations</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="btn-secondary flex items-center gap-2"
          >
            <RefreshCw size={16} className={isFetching ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            onClick={() => {
              setScheduleForm(INITIAL_SCHEDULE_FORM);
              setShowCreateModal(true);
            }}
            className="btn-primary flex items-center gap-2"
          >
            <Plus size={16} />
            Schedule Delivery
          </button>
        </div>
      </div>

      {/* ─── Search & Filter Toolbar ──────────────────────────────────────────── */}
      <div className="card p-4 space-y-4 md:space-y-0 md:flex md:items-center md:justify-between gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-surface-400" size={18} />
          <input
            type="text"
            placeholder="Search by schedule #, destination, or pickup address..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="form-input pl-10 w-full"
          />
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-surface-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="form-select text-sm py-2"
            >
              <option value="all">All Statuses</option>
              <option value="scheduled">Scheduled</option>
              <option value="in_transit">In Transit</option>
              <option value="arrived">Arrived</option>
              <option value="delivered">Delivered</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>
      </div>

      {/* ─── Delivery Schedules Table ─────────────────────────────────────────── */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-surface-500">
            <RefreshCw className="animate-spin mx-auto mb-2 text-primary-600" size={24} />
            Loading transport schedules...
          </div>
        ) : schedules.length === 0 ? (
          <div className="p-12 text-center">
            <Truck className="mx-auto text-surface-300 mb-3" size={48} />
            <h3 className="text-lg font-semibold text-surface-700 mb-1">No Delivery Schedules Found</h3>
            <p className="text-sm text-surface-400 max-w-md mx-auto mb-4">
              Get started by scheduling your first transport dispatch with vehicle and driver assignments.
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn-primary btn-sm inline-flex items-center gap-2"
            >
              <Plus size={14} /> Schedule New Delivery
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-50 border-b border-surface-200 text-xs font-semibold text-surface-600 uppercase tracking-wider">
                  <th className="py-3 px-4">Schedule Details</th>
                  <th className="py-3 px-4">Order / Buyer</th>
                  <th className="py-3 px-4">Fleet Vehicle</th>
                  <th className="py-3 px-4">Driver</th>
                  <th className="py-3 px-4">Destination</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100 text-sm">
                {schedules.map((item) => {
                  const badge = STATUS_BADGE_MAP[item.status] || STATUS_BADGE_MAP.scheduled;
                  return (
                    <tr key={item.id} className="hover:bg-surface-50/80 transition-colors">
                      {/* Schedule details */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-surface-900 font-mono text-xs">
                          {item.schedule_no}
                        </div>
                        <div className="text-xs text-surface-500 flex items-center gap-1 mt-0.5">
                          <Calendar size={12} className="text-surface-400" />
                          {item.scheduled_date ? new Date(item.scheduled_date).toLocaleDateString('en-LK', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}
                          {item.scheduled_time && ` at ${item.scheduled_time.slice(0, 5)}`}
                        </div>
                      </td>

                      {/* Order / Buyer */}
                      <td className="py-3.5 px-4">
                        {item.purchase_orders ? (
                          <div>
                            <span className="font-semibold text-surface-800 text-xs font-mono">
                              {item.purchase_orders.order_no}
                            </span>
                            <div className="text-xs text-surface-500 truncate max-w-[140px]">
                              {item.purchase_orders.buyers?.company_name || 'Buyer'}
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-surface-400 italic">Direct Dispatch</span>
                        )}
                      </td>

                      {/* Fleet Vehicle */}
                      <td className="py-3.5 px-4">
                        {item.transport_vehicles ? (
                          <div>
                            <div className="font-mono font-semibold text-surface-900 text-xs">
                              {item.transport_vehicles.plate_number}
                            </div>
                            <div className="text-xs text-surface-500 capitalize">
                              {item.transport_vehicles.vehicle_type}
                              {item.transport_vehicles.capacity_kg ? ` (${item.transport_vehicles.capacity_kg} kg)` : ''}
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                            Unassigned
                          </span>
                        )}
                      </td>

                      {/* Driver */}
                      <td className="py-3.5 px-4">
                        {item.drivers ? (
                          <div>
                            <div className="font-medium text-surface-800 text-xs flex items-center gap-1">
                              <User size={12} className="text-surface-400" />
                              {item.drivers.full_name}
                            </div>
                            <div className="text-xs text-surface-500 flex items-center gap-1">
                              <Phone size={10} className="text-surface-400" />
                              {item.drivers.phone}
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-surface-400 italic">No driver assigned</span>
                        )}
                      </td>

                      {/* Destination */}
                      <td className="py-3.5 px-4">
                        <div className="text-xs text-surface-700 max-w-[180px] truncate" title={item.delivery_address}>
                          <MapPin size={12} className="inline text-emerald-600 mr-1" />
                          {item.delivery_address}
                        </div>
                        {item.notes && (
                          <div className="text-2xs text-surface-400 truncate max-w-[180px] mt-0.5" title={item.notes}>
                            📝 {item.notes}
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${badge.className}`}>
                          {badge.icon}
                          {badge.label}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Quick Status Advance */}
                          {item.status === 'scheduled' && (
                            <button
                              onClick={() => updateStatusMutation.mutate({ id: item.id, status: 'in_transit' })}
                              title="Start Transit"
                              className="px-2 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-lg text-xs font-semibold flex items-center gap-1"
                            >
                              <Navigation size={11} /> Start
                            </button>
                          )}
                          {item.status === 'in_transit' && (
                            <button
                              onClick={() => updateStatusMutation.mutate({ id: item.id, status: 'delivered' })}
                              title="Mark as Delivered"
                              className="px-2 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded-lg text-xs font-semibold flex items-center gap-1"
                            >
                              <CheckCircle size={11} /> Delivered
                            </button>
                          )}

                          {/* Edit button */}
                          <button
                            onClick={() => setEditingSchedule(item)}
                            title="Edit Schedule"
                            className="btn-secondary py-1 px-2 text-xs flex items-center gap-1"
                          >
                            <Edit3 size={13} />
                          </button>

                          {/* Delete button */}
                          <button
                            onClick={() => setScheduleToDelete(item)}
                            title="Delete Schedule"
                            className="p-1.5 rounded-lg border bg-red-50 text-red-600 border-red-200 hover:bg-red-100 hover:text-red-700 transition-colors"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── Create Delivery Schedule Modal ────────────────────────────────────── */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => { setShowCreateModal(false); setScheduleForm(INITIAL_SCHEDULE_FORM); }}
        title="Schedule New Delivery"
        subtitle="Assign a fleet vehicle, driver, and delivery destination"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          {/* Link to Purchase Order */}
          <div>
            <label className="block text-sm font-semibold text-surface-700 mb-1.5">
              Link Purchase Order (Optional)
            </label>
            <select
              value={scheduleForm.order_id}
              onChange={(e) => handleOrderSelect(e.target.value)}
              className="input w-full"
            >
              <option value="">-- Direct Dispatch (No Order Link) --</option>
              {orders.map((o: any) => (
                <option key={o.id} value={o.id}>
                  {o.order_no} · {o.buyers?.company_name || 'Buyer'} (LKR {o.total_amount_lkr?.toLocaleString()})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Fleet Vehicle */}
            <div>
              <label className="block text-sm font-semibold text-surface-700 mb-1.5">
                Assign Vehicle
              </label>
              <select
                value={scheduleForm.vehicle_id}
                onChange={(e) => setScheduleForm({ ...scheduleForm, vehicle_id: e.target.value })}
                className="input w-full"
              >
                <option value="">-- Select Fleet Vehicle --</option>
                {vehicles.map((v: any) => (
                  <option key={v.id} value={v.id} disabled={!!busyCreate.vehicles[v.id] || v.is_active === false}>
                    {v.plate_number} ({v.vehicle_type} - {v.capacity_kg || 'N/A'} kg){busyCreate.vehicles[v.id] ? ` – busy (${busyCreate.vehicles[v.id].schedule_no})` : v.is_active === false ? ' – inactive' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Driver */}
            <div>
              <label className="block text-sm font-semibold text-surface-700 mb-1.5">
                Assign Driver
              </label>
              <select
                value={scheduleForm.driver_id}
                onChange={(e) => setScheduleForm({ ...scheduleForm, driver_id: e.target.value })}
                className="input w-full"
              >
                <option value="">-- Select Driver --</option>
                {drivers.map((d: any) => (
                  <option key={d.id} value={d.id} disabled={!!busyCreate.drivers[d.id] || d.is_active === false}>
                    {d.full_name} ({d.phone}){busyCreate.drivers[d.id] ? ` – busy (${busyCreate.drivers[d.id].schedule_no})` : d.is_active === false ? ' – inactive' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <p className="text-xs text-surface-400 -mt-1">A vehicle or driver that is already scheduled for a delivery cannot be chosen again until that delivery is completed or cancelled. Busy ones are greyed out.</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Scheduled Date */}
            <div>
              <label className="block text-sm font-semibold text-surface-700 mb-1.5">
                Scheduled Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={scheduleForm.scheduled_date}
                onChange={(e) => setScheduleForm({ ...scheduleForm, scheduled_date: e.target.value })}
                className="input w-full"
                required
              />
            </div>

            {/* Scheduled Time */}
            <div>
              <label className="block text-sm font-semibold text-surface-700 mb-1.5">
                Scheduled Time
              </label>
              <input
                type="time"
                value={scheduleForm.scheduled_time}
                onChange={(e) => setScheduleForm({ ...scheduleForm, scheduled_time: e.target.value })}
                className="input w-full"
              />
            </div>
          </div>

          {/* Pickup Address */}
          <div>
            <label className="block text-sm font-semibold text-surface-700 mb-1.5">
              Pickup Location
            </label>
            <input
              type="text"
              value={scheduleForm.pickup_address}
              onChange={(e) => setScheduleForm({ ...scheduleForm, pickup_address: e.target.value })}
              placeholder="e.g. Central Storage Hub, Colombo"
              className="input w-full"
            />
          </div>

          {/* Delivery Address */}
          <div>
            <label className="block text-sm font-semibold text-surface-700 mb-1.5">
              Delivery Destination <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={scheduleForm.delivery_address}
              onChange={(e) => setScheduleForm({ ...scheduleForm, delivery_address: e.target.value })}
              placeholder="e.g. 123 Supermarket Logistics Bay, Kandy"
              className="input w-full"
              required
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-semibold text-surface-700 mb-1.5">
              Notes & Handling Instructions
            </label>
            <textarea
              value={scheduleForm.notes}
              onChange={(e) => setScheduleForm({ ...scheduleForm, notes: e.target.value })}
              placeholder="e.g. Maintain cold storage between 4-8°C. Contact receiver upon arrival."
              rows={2}
              className="input w-full"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-surface-100">
            <button
              type="button"
              onClick={() => setShowCreateModal(false)}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="btn-primary flex items-center gap-2"
            >
              {createMutation.isPending ? (
                <><RefreshCw size={14} className="animate-spin" /> Scheduling...</>
              ) : (
                <><Plus size={14} /> Confirm Schedule</>
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* ─── Edit Delivery Schedule Modal ──────────────────────────────────────── */}
      {editingSchedule && (
        <Modal
          isOpen={!!editingSchedule}
          onClose={() => setEditingSchedule(null)}
          title={`Edit ${editingSchedule.schedule_no}`}
          subtitle="Update schedule details, assignments, or dispatch status"
        >
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-surface-700 mb-1.5">Vehicle</label>
                <select
                  value={editingSchedule.vehicle_id || ''}
                  onChange={(e) => setEditingSchedule({ ...editingSchedule, vehicle_id: e.target.value || null })}
                  className="input w-full"
                >
                  <option value="">-- No Vehicle Assigned --</option>
                  {vehicles.map((v: any) => (
                    <option key={v.id} value={v.id} disabled={!!busyEdit.vehicles[v.id]}>
                      {v.plate_number} ({v.vehicle_type}){busyEdit.vehicles[v.id] ? ` – busy (${busyEdit.vehicles[v.id].schedule_no})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-surface-700 mb-1.5">Driver</label>
                <select
                  value={editingSchedule.driver_id || ''}
                  onChange={(e) => setEditingSchedule({ ...editingSchedule, driver_id: e.target.value || null })}
                  className="input w-full"
                >
                  <option value="">-- No Driver Assigned --</option>
                  {drivers.map((d: any) => (
                    <option key={d.id} value={d.id} disabled={!!busyEdit.drivers[d.id]}>
                      {d.full_name} ({d.phone}){busyEdit.drivers[d.id] ? ` – busy (${busyEdit.drivers[d.id].schedule_no})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-semibold text-surface-700 mb-1.5">Scheduled Date</label>
                <input
                  type="date"
                  value={editingSchedule.scheduled_date ? editingSchedule.scheduled_date.slice(0, 10) : ''}
                  onChange={(e) => setEditingSchedule({ ...editingSchedule, scheduled_date: e.target.value })}
                  className="input w-full"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-surface-700 mb-1.5">Scheduled Time</label>
                <input
                  type="time"
                  value={editingSchedule.scheduled_time || ''}
                  onChange={(e) => setEditingSchedule({ ...editingSchedule, scheduled_time: e.target.value })}
                  className="input w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-surface-700 mb-1.5">Status</label>
                <select
                  value={editingSchedule.status}
                  onChange={(e) => setEditingSchedule({ ...editingSchedule, status: e.target.value as any })}
                  className="input w-full font-semibold"
                >
                  <option value="scheduled">Scheduled</option>
                  <option value="in_transit">In Transit</option>
                  <option value="arrived">Arrived</option>
                  <option value="delivered">Delivered</option>
                  <option value="failed">Failed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-surface-700 mb-1.5">Pickup Location</label>
              <input
                type="text"
                value={editingSchedule.pickup_address}
                onChange={(e) => setEditingSchedule({ ...editingSchedule, pickup_address: e.target.value })}
                className="input w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-surface-700 mb-1.5">Delivery Destination</label>
              <input
                type="text"
                value={editingSchedule.delivery_address}
                onChange={(e) => setEditingSchedule({ ...editingSchedule, delivery_address: e.target.value })}
                className="input w-full"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-surface-700 mb-1.5">Notes</label>
              <textarea
                value={editingSchedule.notes || ''}
                onChange={(e) => setEditingSchedule({ ...editingSchedule, notes: e.target.value })}
                rows={2}
                className="input w-full"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-surface-100">
              <button
                type="button"
                onClick={() => setEditingSchedule(null)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={updateMutation.isPending}
                className="btn-primary flex items-center gap-2"
              >
                {updateMutation.isPending ? (
                  <><RefreshCw size={14} className="animate-spin" /> Saving...</>
                ) : (
                  <><CheckCircle size={14} /> Save Changes</>
                )}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ─── Delete Confirmation Modal ─────────────────────────────────────────── */}
      {scheduleToDelete && (
        <Modal
          isOpen={!!scheduleToDelete}
          onClose={() => setScheduleToDelete(null)}
          title="Delete Delivery Schedule"
          subtitle={`Are you sure you want to delete ${scheduleToDelete.schedule_no}?`}
        >
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
              <AlertCircle size={20} className="text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-red-800 text-sm">Permanent Deletion</p>
                <p className="text-xs text-red-600 mt-1">
                  This will remove the delivery schedule and its associated tracking records.
                </p>
              </div>
            </div>

            <div className="bg-surface-50 rounded-xl p-3 text-sm space-y-1">
              <div className="font-mono font-bold text-surface-900">{scheduleToDelete.schedule_no}</div>
              <div className="text-xs text-surface-600">📍 To: {scheduleToDelete.delivery_address}</div>
              <div className="text-xs text-surface-500">📅 Date: {scheduleToDelete.scheduled_date}</div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-surface-100">
              <button
                type="button"
                onClick={() => setScheduleToDelete(null)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => deleteMutation.mutate(scheduleToDelete.id)}
                disabled={deleteMutation.isPending}
                className="btn bg-red-600 text-white hover:bg-red-700 flex items-center gap-2"
              >
                {deleteMutation.isPending ? (
                  <><RefreshCw size={14} className="animate-spin" /> Deleting...</>
                ) : (
                  <><Trash2 size={14} /> Delete Schedule</>
                )}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
