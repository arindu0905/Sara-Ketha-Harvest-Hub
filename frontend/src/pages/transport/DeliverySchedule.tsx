import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { deliveriesApi } from '../../services/api';
import { Truck } from 'lucide-react';

export const DeliverySchedule: React.FC = () => {
  const { data: delRes, isLoading } = useQuery({
    queryKey: ['transport-deliveries-schedule'],
    queryFn: () => deliveriesApi.getAll({}),
  });

  const deliveries = delRes?.data?.data || [];

  const statusBadge = (s: string) => {
    const m: Record<string, string> = { scheduled: 'badge-warning', in_transit: 'badge-primary', delivered: 'badge-success', cancelled: 'badge-danger' };
    return <span className={m[s] || 'badge-neutral'}>{s?.replace(/_/g, ' ')}</span>;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Delivery Schedule</h1>
          <p className="page-subtitle">Master schedule for all transport dispatches</p>
        </div>
      </div>

      {isLoading ? (
        <div className="card p-6 space-y-3">{[1, 2, 3].map(i => <div key={i} className="skeleton h-14 rounded-xl" />)}</div>
      ) : deliveries.length === 0 ? (
        <div className="card"><div className="empty-state"><Truck className="w-8 h-8 text-surface-300 mb-2" /><p className="text-surface-400 text-sm">No delivery schedules found</p></div></div>
      ) : (
        <div className="card overflow-hidden">
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Schedule No</th>
                  <th>Order No</th>
                  <th>Vehicle</th>
                  <th>Driver</th>
                  <th>Scheduled Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {deliveries.map((d: any) => (
                  <tr key={d.id}>
                    <td className="font-semibold">{d.schedule_no}</td>
                    <td>{d.purchase_orders?.order_no || '—'}</td>
                    <td className="font-mono text-xs">{d.vehicle_number || 'Unassigned'}</td>
                    <td>{d.driver_name || 'Unassigned'}</td>
                    <td className="text-xs text-surface-500">{d.scheduled_date ? new Date(d.scheduled_date).toLocaleDateString('en-LK') : '—'}</td>
                    <td>{statusBadge(d.status)}</td>
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
