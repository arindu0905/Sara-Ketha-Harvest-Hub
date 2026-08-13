import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { deliveriesApi } from '../../services/api';
import { Truck, CheckCircle, Navigation } from 'lucide-react';
import toast from 'react-hot-toast';

export const ActiveDeliveries: React.FC = () => {
  const queryClient = useQueryClient();

  const { data: delRes, isLoading } = useQuery({
    queryKey: ['transport-active-deliveries'],
    queryFn: () => deliveriesApi.getAll({ status: 'in_transit' }),
  });

  const active = delRes?.data?.data || [];

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => deliveriesApi.updateStatus(id, { status }),
    onSuccess: () => {
      toast.success('Delivery status updated!');
      queryClient.invalidateQueries({ queryKey: ['transport-active-deliveries'] });
    },
    onError: () => toast.error('Failed to update delivery status'),
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Active Deliveries</h1>
          <p className="page-subtitle">{active.length} shipments currently in transit</p>
        </div>
      </div>

      {isLoading ? (
        <div className="card p-6 space-y-3">{[1, 2, 3].map(i => <div key={i} className="skeleton h-14 rounded-xl" />)}</div>
      ) : active.length === 0 ? (
        <div className="card"><div className="empty-state"><Navigation className="w-8 h-8 text-surface-300 mb-2" /><p className="text-surface-400 text-sm">No active shipments currently in transit</p></div></div>
      ) : (
        <div className="card overflow-hidden">
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Schedule No</th>
                  <th>Order</th>
                  <th>Vehicle</th>
                  <th>Driver / Contact</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {active.map((d: any) => (
                  <tr key={d.id}>
                    <td className="font-semibold">{d.schedule_no}</td>
                    <td>{d.purchase_orders?.order_no || '—'}</td>
                    <td className="font-mono text-xs">{d.vehicle_number || 'N/A'}</td>
                    <td>{d.driver_name}<br /><span className="text-xs text-surface-400">{d.driver_phone}</span></td>
                    <td>
                      <button onClick={() => updateStatusMutation.mutate({ id: d.id, status: 'delivered' })} disabled={updateStatusMutation.isPending} className="btn-primary btn-sm">
                        <CheckCircle size={14} /> Mark Delivered
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
