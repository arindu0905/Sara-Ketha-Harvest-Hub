import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { farmersApi, collectionsApi, appointmentsApi } from '../../services/api';
import { StatCard } from '../../components/ui/StatCard';
import { Users, Package, Calendar, ChevronRight, UserPlus, ClipboardList, AlertCircle } from 'lucide-react';

export const OfficerDashboard: React.FC = () => {
  const { data: farmersRes, isLoading: lf } = useQuery({
    queryKey: ['officer-farmers'],
    queryFn: () => farmersApi.getAll({ limit: '1' }),
  });

  const { data: pendingFarmers } = useQuery({
    queryKey: ['officer-pending-farmers'],
    queryFn: () => farmersApi.getAll({ verification_status: 'pending', limit: '1' }),
  });

  const { data: collectionsRes, isLoading: lc } = useQuery({
    queryKey: ['officer-collections-recent'],
    queryFn: () => collectionsApi.getAll({ limit: '5' }),
  });

  const { data: appointmentsRes } = useQuery({
    queryKey: ['officer-appointments-today'],
    queryFn: () => appointmentsApi.getAll({ date: new Date().toISOString().split('T')[0] }),
  });

  const totalFarmers = farmersRes?.data?.meta?.total ?? 0;
  const pendingCount = pendingFarmers?.data?.meta?.total ?? 0;
  const todayAppointments = appointmentsRes?.data?.data?.length ?? 0;
  const recentCollections = collectionsRes?.data?.data || [];

  // Upcoming scheduled appointments (next 7 days)
  const { data: upcomingRes } = useQuery({
    queryKey: ['officer-upcoming-appointments'],
    queryFn: () => appointmentsApi.getAll({ status: 'scheduled' }),
  });
  const upcomingAppointments = (upcomingRes?.data?.data || []).slice(0, 5);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Officer Dashboard</h1>
          <p className="page-subtitle">Collection centre operations overview</p>
        </div>
        <div className="flex gap-2">
          <Link to="/officer/farmers/register" className="btn-primary btn-sm"><UserPlus size={14} /> Register Farmer</Link>
          <Link to="/officer/collections/register" className="btn-secondary btn-sm"><Package size={14} /> New Collection</Link>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Farmers" value={totalFarmers} icon={<Users size={22} />} iconBg="bg-primary-100" iconColor="text-primary-600" loading={lf} />
        <StatCard title="Pending Verification" value={pendingCount} icon={<AlertCircle size={22} />} iconBg="bg-yellow-100" iconColor="text-yellow-600" />
        <StatCard title="Today's Appointments" value={todayAppointments} icon={<Calendar size={22} />} iconBg="bg-blue-100" iconColor="text-blue-600" />
        <StatCard title="Recent Collections" value={collectionsRes?.data?.meta?.total ?? 0} icon={<Package size={22} />} iconBg="bg-earth-100" iconColor="text-earth-600" loading={lc} />
      </div>

      {pendingCount > 0 && (
        <div className="alert-warning">
          <AlertCircle size={16} className="flex-shrink-0" />
          <div>
            <p className="font-medium">{pendingCount} farmer(s) pending verification</p>
            <Link to="/officer/farmers?verification_status=pending" className="text-xs underline">Review now →</Link>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Collections */}
        <div className="card">
          <div className="card-header">
            <h2 className="text-sm font-semibold text-surface-800">Recent Collections</h2>
            <Link to="/officer/collections" className="text-xs text-primary-600 flex items-center gap-1 hover:text-primary-700">View all <ChevronRight size={14} /></Link>
          </div>
          {recentCollections.length === 0 ? (
            <div className="empty-state py-8">
              <Package className="w-8 h-8 text-surface-300 mb-2" />
              <p className="text-surface-400 text-sm">No recent collections</p>
            </div>
          ) : (
            <div className="divide-y divide-surface-50">
              {recentCollections.map((c: any) => (
                <div key={c.id} className="flex items-center justify-between p-4 hover:bg-surface-50 transition-colors">
                  <div>
                    <p className="text-sm font-semibold text-surface-800">{c.collection_no}</p>
                    <p className="text-xs text-surface-500">{c.farmers?.full_name} · {c.crop_categories?.name}</p>
                  </div>
                  <div className="text-right">
                    <span className={`badge text-xs ${c.status === 'completed' ? 'badge-success' : c.status === 'rejected' ? 'badge-danger' : 'badge-neutral'}`}>
                      {c.status?.replace(/_/g, ' ')}
                    </span>
                    <p className="text-xs text-surface-400 mt-1">{c.net_weight_kg ? `${c.net_weight_kg} kg` : '—'}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Upcoming Appointments */}
        <div className="card">
          <div className="card-header">
            <h2 className="text-sm font-semibold text-surface-800 flex items-center gap-2">
              <Calendar size={14} className="text-primary-600" />
              Upcoming Deliveries
            </h2>
            <Link to="/officer/appointments" className="text-xs text-primary-600 flex items-center gap-1 hover:text-primary-700">View all <ChevronRight size={14} /></Link>
          </div>
          {upcomingAppointments.length === 0 ? (
            <div className="empty-state py-8">
              <Calendar className="w-8 h-8 text-surface-300 mb-2" />
              <p className="text-surface-400 text-sm">No scheduled appointments</p>
              <p className="text-surface-400 text-xs mt-1">Farmers can book from their dashboard</p>
            </div>
          ) : (
            <div className="divide-y divide-surface-50">
              {upcomingAppointments.map((a: any) => (
                <div key={a.id} className="flex items-center justify-between p-4 hover:bg-surface-50 transition-colors">
                  <div>
                    <p className="text-sm font-semibold text-surface-800">{a.farmers?.full_name || '—'}</p>
                    <p className="text-xs text-surface-500">
                      {a.crop_categories?.name}
                      {a.estimated_qty_kg ? ` · ${Number(a.estimated_qty_kg).toLocaleString()} kg` : ''}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-semibold text-surface-700">
                      {new Date(a.scheduled_date).toLocaleDateString('en-LK', { day: 'numeric', month: 'short' })}
                    </p>
                    <span className="badge-info text-xs">Scheduled</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-surface-800 mb-3">Quick Actions</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Register Farmer', icon: '👤', path: '/officer/farmers/register' },
            { label: 'Register Collection', icon: '📦', path: '/officer/collections/register' },
            { label: 'Farmer Directory', icon: '📋', path: '/officer/farmers' },
            { label: 'Appointments', icon: '📅', path: '/officer/appointments' },
          ].map(a => (
            <Link key={a.path} to={a.path} className="flex flex-col items-center gap-2 p-4 bg-surface-50 rounded-xl hover:bg-primary-50 hover:text-primary-700 transition-colors text-center">
              <span className="text-2xl">{a.icon}</span>
              <span className="text-xs font-medium text-surface-700">{a.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};

