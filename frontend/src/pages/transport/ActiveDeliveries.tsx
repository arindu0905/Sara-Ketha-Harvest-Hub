import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { deliveriesApi } from '../../services/api';
import {
  Truck, CheckCircle, Navigation, MapPin, Phone,
  Clock, AlertCircle, RefreshCw, XCircle, ArrowRight, MessageSquare
} from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import toast from 'react-hot-toast';

export const ActiveDeliveries: React.FC = () => {
  const queryClient = useQueryClient();

  const [selectedDelivery, setSelectedDelivery] = useState<any | null>(null);
  const [updateStatusModal, setUpdateStatusModal] = useState<any | null>(null);
  const [statusForm, setStatusForm] = useState({ status: 'delivered', location: '', notes: '' });

  const { data: delRes, isLoading, refetch } = useQuery({
    queryKey: ['transport-active-deliveries'],
    queryFn: () => deliveriesApi.getAll({}),
  });

  const allDeliveries = delRes?.data?.data || [];
  // Filter for active dispatches (in_transit or arrived or scheduled for today)
  const active = allDeliveries.filter((d: any) => d.status === 'in_transit' || d.status === 'arrived');

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { status: string; location?: string; notes?: string } }) =>
      deliveriesApi.updateStatus(id, data),
    onSuccess: () => {
      toast.success('Shipment tracking status updated!');
      queryClient.invalidateQueries({ queryKey: ['transport-active-deliveries'] });
      queryClient.invalidateQueries({ queryKey: ['transport-schedules'] });
      queryClient.invalidateQueries({ queryKey: ['transport-deliveries-dash'] });
      setUpdateStatusModal(null);
      setStatusForm({ status: 'delivered', location: '', notes: '' });
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to update status'),
  });

  const handleOpenStatusModal = (delivery: any, targetStatus: string) => {
    setUpdateStatusModal(delivery);
    setStatusForm({
      status: targetStatus,
      location: delivery.delivery_address || '',
      notes: targetStatus === 'delivered' ? 'Shipment safely delivered and signed off' : 'Arrived at destination site',
    });
  };

  const handleStatusSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!updateStatusModal) return;
    updateStatusMutation.mutate({
      id: updateStatusModal.id,
      data: statusForm,
    });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Navigation className="text-primary-600 animate-pulse" size={28} />
            Active Shipments & Dispatch Tracking
          </h1>
          <p className="page-subtitle">{active.length} shipments currently in transit or arriving</p>
        </div>

        <button onClick={() => refetch()} className="btn-secondary flex items-center gap-2">
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      {isLoading ? (
        <div className="card p-6 space-y-3">{[1, 2, 3].map(i => <div key={i} className="skeleton h-14 rounded-xl" />)}</div>
      ) : active.length === 0 ? (
        <div className="card">
          <div className="empty-state py-12">
            <Truck className="w-12 h-12 text-surface-300 mb-2" />
            <h3 className="text-base font-semibold text-surface-700">No active shipments in transit</h3>
            <p className="text-surface-400 text-sm max-w-sm mt-1">
              All deliveries are either completed or currently in scheduled status.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {active.map((d: any) => (
            <div key={d.id} className="card p-5 border-l-4 border-l-primary-500 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="font-mono font-bold text-surface-900 text-sm">{d.schedule_no}</span>
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                    d.status === 'in_transit'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-teal-100 text-teal-800'
                  }`}>
                    {d.status === 'in_transit' ? <Navigation size={12} className="animate-pulse" /> : <MapPin size={12} />}
                    {d.status === 'in_transit' ? 'In Transit' : 'Arrived at Destination'}
                  </span>
                </div>

                <div className="space-y-2 text-xs text-surface-600 mb-4">
                  <div className="flex items-start gap-2">
                    <MapPin size={14} className="text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-semibold text-surface-800">Destination:</div>
                      <div>{d.delivery_address}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-surface-100">
                    <div>
                      <span className="text-surface-400">Vehicle: </span>
                      <span className="font-mono font-semibold text-surface-800">
                        {d.transport_vehicles?.plate_number || 'Unassigned'}
                      </span>
                    </div>
                    <div>
                      <span className="text-surface-400">Driver: </span>
                      <span className="font-medium text-surface-800">
                        {d.drivers?.full_name || 'Unassigned'}
                      </span>
                    </div>
                  </div>

                  {d.drivers?.phone && (
                    <div className="flex items-center gap-1 text-primary-700">
                      <Phone size={12} />
                      <span>{d.drivers.phone}</span>
                    </div>
                  )}

                  {d.purchase_orders && (
                    <div className="text-surface-500">
                      Order: <span className="font-semibold text-surface-700 font-mono">{d.purchase_orders.order_no}</span> · {d.purchase_orders.buyers?.company_name}
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between gap-2 pt-3 border-t border-surface-100">
                <button
                  onClick={() => handleOpenStatusModal(d, 'failed')}
                  className="px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 text-xs font-semibold"
                >
                  Report Issue / Fail
                </button>

                <div className="flex items-center gap-2">
                  {d.status === 'in_transit' && (
                    <button
                      onClick={() => handleOpenStatusModal(d, 'arrived')}
                      className="px-3 py-1.5 bg-teal-50 text-teal-700 hover:bg-teal-100 border border-teal-200 rounded-lg text-xs font-semibold flex items-center gap-1"
                    >
                      <MapPin size={12} /> Mark Arrived
                    </button>
                  )}
                  <button
                    onClick={() => handleOpenStatusModal(d, 'delivered')}
                    className="btn-primary btn-sm flex items-center gap-1"
                  >
                    <CheckCircle size={14} /> Mark Delivered
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ─── Update Status & Location Tracking Modal ──────────────────────────── */}
      {updateStatusModal && (
        <Modal
          isOpen={!!updateStatusModal}
          onClose={() => setUpdateStatusModal(null)}
          title={`Update Shipment: ${updateStatusModal.schedule_no}`}
          subtitle="Record delivery milestone and location tracking info"
        >
          <form onSubmit={handleStatusSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-surface-700 mb-1.5">
                New Milestone Status <span className="text-red-500">*</span>
              </label>
              <select
                value={statusForm.status}
                onChange={(e) => setStatusForm({ ...statusForm, status: e.target.value })}
                className="input w-full font-semibold"
              >
                <option value="in_transit">In Transit</option>
                <option value="arrived">Arrived at Destination</option>
                <option value="delivered">Delivered Successfully</option>
                <option value="failed">Failed / Returned</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-surface-700 mb-1.5">
                Current Location / Checkpoint
              </label>
              <input
                type="text"
                value={statusForm.location}
                onChange={(e) => setStatusForm({ ...statusForm, location: e.target.value })}
                placeholder="e.g. Colombo Central Distribution Hub / Buyer Warehouse"
                className="input w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-surface-700 mb-1.5">
                Tracking Notes / Handover Sign-off
              </label>
              <textarea
                value={statusForm.notes}
                onChange={(e) => setStatusForm({ ...statusForm, notes: e.target.value })}
                placeholder="e.g. Received in good condition by store manager."
                rows={2}
                className="input w-full"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-surface-100">
              <button type="button" onClick={() => setUpdateStatusModal(null)} className="btn-secondary">
                Cancel
              </button>
              <button
                type="submit"
                disabled={updateStatusMutation.isPending}
                className="btn-primary flex items-center gap-2"
              >
                {updateStatusMutation.isPending ? (
                  <><RefreshCw size={14} className="animate-spin" /> Updating...</>
                ) : (
                  <><CheckCircle size={14} /> Confirm Update</>
                )}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
