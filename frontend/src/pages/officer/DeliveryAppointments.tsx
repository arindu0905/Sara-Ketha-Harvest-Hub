import React, { useState } from 'react';
import { formatCategoryName } from '../../utils/categoryUtils';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { appointmentsApi, centresApi } from '../../services/api';
import {
  Calendar, CheckCircle, XCircle, Clock, RefreshCw,
  User, Package, Building2, ChevronRight, Filter
} from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';

type StatusFilter = 'all' | 'scheduled' | 'confirmed' | 'completed' | 'cancelled';

const STATUS_TABS: { key: StatusFilter; label: string }[] = [
  { key: 'all',       label: 'All' },
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
];

const statusBadge = (s: string) => {
  switch (s) {
    case 'scheduled': return <span className="badge-info text-xs">Scheduled</span>;
    case 'confirmed': return <span className="badge-success text-xs">Confirmed</span>;
    case 'completed': return <span className="badge-success text-xs">Completed</span>;
    case 'cancelled': return <span className="badge-danger text-xs">Cancelled</span>;
    default:          return <span className="badge-neutral text-xs">{s}</span>;
  }
};

export const DeliveryAppointments: React.FC = () => {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [centreFilter, setCentreFilter] = useState('');

  // Fetch all appointments (no centre restriction — officers see all)
  const { data: allRes, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['officer-appointments-all'],
    queryFn: () => appointmentsApi.getAll({}),
    staleTime: 30_000,
  });

  const allAppointments: any[] = allRes?.data?.data || [];

  // Fetch centres for the centre filter dropdown
  const { data: centresRes } = useQuery({
    queryKey: ['centres'],
    queryFn: () => centresApi.getAll(),
  });
  const centres: any[] = centresRes?.data?.data || [];

  // Apply filters client-side (fast, no extra API calls)
  const filtered = allAppointments.filter((a: any) => {
    const matchStatus = statusFilter === 'all' || a.status === statusFilter;
    const matchCentre = !centreFilter || a.centre_id === centreFilter;
    return matchStatus && matchCentre;
  });

  const countByStatus = (s: string) => allAppointments.filter((a: any) => a.status === s).length;

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      appointmentsApi.updateStatus(id, status),
    onSuccess: () => {
      toast.success('Appointment status updated');
      queryClient.invalidateQueries({ queryKey: ['officer-appointments-all'] });
      queryClient.invalidateQueries({ queryKey: ['officer-appointments-today'] });
      queryClient.invalidateQueries({ queryKey: ['officer-upcoming-appointments'] });
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to update'),
  });

  const todayStr = new Date().toLocaleDateString('en-LK', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Calendar className="text-primary-600" size={24} />
            Delivery Appointments
          </h1>
          <p className="page-subtitle">Farmer delivery bookings — {todayStr}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="btn-secondary flex items-center gap-2 text-sm"
          >
            <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />
            Refresh
          </button>
          <Link to="/officer/collections/register" className="btn-primary btn-sm flex items-center gap-2">
            <Package size={14} /> Register Collection
          </Link>
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total', value: allAppointments.length, icon: <Calendar size={18} />, bg: 'bg-blue-50',    color: 'text-blue-600' },
          { label: 'Scheduled', value: countByStatus('scheduled'), icon: <Clock size={18} />, bg: 'bg-amber-50',   color: 'text-amber-600' },
          { label: 'Confirmed', value: countByStatus('confirmed'), icon: <CheckCircle size={18} />, bg: 'bg-primary-50', color: 'text-primary-600' },
          { label: 'Completed', value: countByStatus('completed'), icon: <CheckCircle size={18} />, bg: 'bg-emerald-50', color: 'text-emerald-600' },
        ].map(card => (
          <div key={card.label} className="card flex items-center gap-3 p-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${card.bg} ${card.color}`}>
              {card.icon}
            </div>
            <div>
              <p className="text-xs text-surface-500">{card.label}</p>
              <p className="text-2xl font-bold text-surface-800">{card.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="card">
        <div className="flex flex-col sm:flex-row gap-3 p-4 border-b border-surface-100">
          {/* Status Tabs */}
          <div className="flex flex-wrap gap-1 flex-1">
            {STATUS_TABS.map(tab => {
              const count = tab.key === 'all' ? allAppointments.length : countByStatus(tab.key);
              return (
                <button
                  key={tab.key}
                  onClick={() => setStatusFilter(tab.key)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${
                    statusFilter === tab.key
                      ? 'bg-primary-600 text-white shadow-sm'
                      : 'text-surface-600 hover:bg-surface-100'
                  }`}
                >
                  {tab.label}
                  {count > 0 && (
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                      statusFilter === tab.key ? 'bg-white/25 text-white' : 'bg-surface-200 text-surface-600'
                    }`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Centre Filter */}
          <div className="flex items-center gap-2 min-w-[200px]">
            <Filter size={14} className="text-surface-400 flex-shrink-0" />
            <select
              value={centreFilter}
              onChange={e => setCentreFilter(e.target.value)}
              className="form-input py-1.5 text-sm flex-1"
            >
              <option value="">All Centres</option>
              {centres.map((c: any) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3, 4].map(i => <div key={i} className="skeleton h-14 rounded-xl" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state py-14">
            <Calendar className="w-10 h-10 text-surface-300 mb-3" />
            <p className="text-surface-600 font-medium">
              {allAppointments.length === 0
                ? 'No appointments yet'
                : `No ${statusFilter !== 'all' ? statusFilter : ''} appointments`}
            </p>
            <p className="text-surface-400 text-sm mt-1">
              {allAppointments.length === 0
                ? 'Farmers can schedule deliveries from their Schedule Delivery page'
                : 'Try a different filter'}
            </p>
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Farmer</th>
                  <th>Crop</th>
                  <th>Scheduled Date</th>
                  <th>Est. Qty</th>
                  <th>Centre</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((a: any) => (
                  <tr key={a.id} className="hover:bg-surface-50">
                    <td>
                      <span className="font-mono font-semibold text-xs text-surface-700 bg-surface-100 px-2 py-0.5 rounded">
                        {a.reference_no}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
                          <User size={12} className="text-primary-600" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">{a.farmers?.full_name || '—'}</p>
                          <p className="text-xs text-surface-400">{a.farmers?.farmer_code}</p>
                        </div>
                      </div>
                    </td>
                    <td>
                      <p className="text-sm font-medium">{formatCategoryName(a.crop_categories) || a.crop_categories?.name || '—'}</p>
                      {a.crop_varieties?.name && <p className="text-xs text-surface-400">{a.crop_varieties.name}</p>}
                    </td>
                    <td>
                      <p className="text-sm font-medium">
                        {new Date(a.scheduled_date).toLocaleDateString('en-LK', {
                          day: 'numeric', month: 'short', year: 'numeric',
                        })}
                      </p>
                    </td>
                    <td>
                      <span className="text-sm font-medium text-surface-700">
                        {a.estimated_qty_kg
                          ? `${Number(a.estimated_qty_kg).toLocaleString()} kg`
                          : '—'}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center gap-1 text-xs text-surface-600">
                        <Building2 size={12} className="text-surface-400 flex-shrink-0" />
                        <span>{a.collection_centres?.name || '—'}</span>
                      </div>
                    </td>
                    <td>{statusBadge(a.status)}</td>
                    <td>
                      <div className="flex items-center gap-1">
                        {a.status === 'scheduled' && (
                          <>
                            <button
                              onClick={() => statusMutation.mutate({ id: a.id, status: 'confirmed' })}
                              disabled={statusMutation.isPending}
                              className="btn-ghost p-1.5 rounded-lg text-primary-600 hover:bg-primary-50"
                              title="Confirm appointment"
                            >
                              <CheckCircle size={15} />
                            </button>
                            <button
                              onClick={() => {
                                if (window.confirm('Cancel this appointment?')) {
                                  statusMutation.mutate({ id: a.id, status: 'cancelled' });
                                }
                              }}
                              disabled={statusMutation.isPending}
                              className="btn-ghost p-1.5 rounded-lg text-red-500 hover:bg-red-50"
                              title="Cancel appointment"
                            >
                              <XCircle size={15} />
                            </button>
                          </>
                        )}
                        {['scheduled', 'confirmed'].includes(a.status) && (
                          <Link
                            to={`/officer/collections/register?appointment=${a.id}`}
                            className="btn-ghost p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 text-xs flex items-center gap-1"
                            title="Register collection for this appointment"
                          >
                            <Package size={13} />
                            <ChevronRight size={11} />
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
