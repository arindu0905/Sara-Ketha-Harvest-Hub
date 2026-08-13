import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { deliveriesApi } from '../../services/api';
import { StatCard } from '../../components/ui/StatCard';
import { Truck, Calendar, CheckCircle, Navigation, ChevronRight } from 'lucide-react';

export const TransportDashboard: React.FC = () => {
  const { data: delRes, isLoading } = useQuery({
    queryKey: ['transport-deliveries-dash'],
    queryFn: () => deliveriesApi.getAll({}),
  });

  const deliveries = delRes?.data?.data || [];
  const inTransit = deliveries.filter((d: any) => d.status === 'in_transit');
  const scheduled = deliveries.filter((d: any) => d.status === 'scheduled');
  const completed = deliveries.filter((d: any) => d.status === 'delivered');

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Transport Dashboard</h1>
          <p className="page-subtitle">Logistics and vehicle fleet operations</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Active In-Transit" value={inTransit.length} icon={<Navigation size={22} />} iconBg="bg-primary-100" iconColor="text-primary-600" loading={isLoading} />
        <StatCard title="Scheduled" value={scheduled.length} icon={<Calendar size={22} />} iconBg="bg-yellow-100" iconColor="text-yellow-600" />
        <StatCard title="Delivered" value={completed.length} icon={<CheckCircle size={22} />} iconBg="bg-blue-100" iconColor="text-blue-600" />
        <StatCard title="Total Deliveries" value={deliveries.length} icon={<Truck size={22} />} iconBg="bg-earth-100" iconColor="text-earth-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="card-header">
            <h2 className="text-sm font-semibold">In-Transit Shipments</h2>
            <Link to="/transport/active" className="text-xs text-primary-600 flex items-center gap-1">View all <ChevronRight size={14} /></Link>
          </div>
          {inTransit.length === 0 ? (
            <div className="empty-state py-8"><p className="text-surface-400 text-sm">No active shipments in transit</p></div>
          ) : (
            <div className="divide-y divide-surface-50">
              {inTransit.map((d: any) => (
                <div key={d.id} className="flex items-center justify-between p-4 hover:bg-surface-50 transition-colors">
                  <div>
                    <p className="text-sm font-semibold text-surface-800">{d.schedule_no}</p>
                    <p className="text-xs text-surface-500">{d.driver_name || 'Driver assigned'} · {d.vehicle_number || 'Vehicle'}</p>
                  </div>
                  <span className="badge-primary text-xs">In Transit</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card p-5">
          <h2 className="text-sm font-semibold text-surface-800 mb-3">Transport Tools</h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Schedule', icon: '📅', path: '/transport/schedule' },
              { label: 'Active Deliveries', icon: '🚚', path: '/transport/active' },
              { label: 'Fleet & Vehicles', icon: '🚛', path: '/transport/vehicles' },
            ].map(a => (
              <Link key={a.path} to={a.path} className="flex flex-col items-center gap-2 p-4 bg-surface-50 rounded-xl hover:bg-primary-50 hover:text-primary-700 transition-colors text-center">
                <span className="text-2xl">{a.icon}</span>
                <span className="text-xs font-medium text-surface-700">{a.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
