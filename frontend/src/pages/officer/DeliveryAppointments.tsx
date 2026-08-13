import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { appointmentsApi } from '../../services/api';
import { Calendar, CheckCircle, XCircle, Clock } from 'lucide-react';
import toast from 'react-hot-toast';

export const DeliveryAppointments: React.FC = () => {
  const queryClient = useQueryClient();

  const { data: appointmentsRes, isLoading } = useQuery({
    queryKey: ['officer-appointments'],
    queryFn: () => appointmentsApi.getAll({}),
  });

  const appointments = appointmentsRes?.data?.data || [];

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => appointmentsApi.updateStatus(id, status),
    onSuccess: () => { toast.success('Appointment updated'); queryClient.invalidateQueries({ queryKey: ['officer-appointments'] }); },
    onError: () => toast.error('Failed to update'),
  });

  const statusBadge = (s: string) => {
    switch (s) {
      case 'scheduled': return <span className="badge-info">Scheduled</span>;
      case 'confirmed': return <span className="badge-success">Confirmed</span>;
      case 'completed': return <span className="badge-success">Completed</span>;
      case 'cancelled': return <span className="badge-danger">Cancelled</span>;
      default: return <span className="badge-neutral">{s}</span>;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div><h1 className="page-title">Delivery Appointments</h1><p className="page-subtitle">Manage farmer delivery appointments</p></div>
      </div>

      {isLoading ? (
        <div className="card p-6 space-y-3">{[1,2,3].map(i => <div key={i} className="skeleton h-16 rounded-xl" />)}</div>
      ) : appointments.length === 0 ? (
        <div className="card"><div className="empty-state"><Calendar className="w-8 h-8 text-surface-300 mb-2" /><p className="text-surface-400 text-sm">No appointments</p></div></div>
      ) : (
        <div className="card overflow-hidden">
          <div className="table-container">
            <table className="table">
              <thead>
                <tr><th>Reference</th><th>Farmer</th><th>Crop</th><th>Date</th><th>Qty (est.)</th><th>Centre</th><th>Status</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {appointments.map((a: any) => (
                  <tr key={a.id}>
                    <td className="font-semibold">{a.reference_no}</td>
                    <td>{a.farmers?.full_name || '—'}<br /><span className="text-xs text-surface-400">{a.farmers?.farmer_code}</span></td>
                    <td>{a.crop_categories?.name || '—'}</td>
                    <td>{new Date(a.scheduled_date).toLocaleDateString('en-LK')}</td>
                    <td>{a.estimated_quantity_kg ? `${a.estimated_quantity_kg} kg` : '—'}</td>
                    <td className="text-xs">{a.collection_centres?.name || '—'}</td>
                    <td>{statusBadge(a.status)}</td>
                    <td>
                      {a.status === 'scheduled' && (
                        <div className="flex gap-1">
                          <button onClick={() => statusMutation.mutate({ id: a.id, status: 'confirmed' })} className="btn-ghost p-1 rounded text-primary-600" title="Confirm"><CheckCircle size={16} /></button>
                          <button onClick={() => statusMutation.mutate({ id: a.id, status: 'cancelled' })} className="btn-ghost p-1 rounded text-red-600" title="Cancel"><XCircle size={16} /></button>
                        </div>
                      )}
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
