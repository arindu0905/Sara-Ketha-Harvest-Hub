import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { deliveriesApi } from '../../services/api';
import { StatCard } from '../../components/ui/StatCard';
import {
  Truck, Calendar, CheckCircle, Navigation, ChevronRight,
  Plus, Warehouse, Users, RefreshCw
} from 'lucide-react';

export const TransportDashboard: React.FC = () => {
  const { data: delRes, isLoading: loadingDel, refetch: refetchDel } = useQuery({
    queryKey: ['transport-deliveries-dash'],
    queryFn: () => deliveriesApi.getAll({}),
  });

  const { data: vehRes, isLoading: loadingVeh } = useQuery({
    queryKey: ['transport-vehicles-dash'],
    queryFn: () => deliveriesApi.getVehicles(),
  });

  const { data: drvRes } = useQuery({
    queryKey: ['transport-drivers-dash'],
    queryFn: () => deliveriesApi.getDrivers(),
  });

  const deliveries = delRes?.data?.data || [];
  const vehicles = vehRes?.data?.data || [];
  const drivers = drvRes?.data?.data || [];

  const inTransit = deliveries.filter((d: any) => d.status === 'in_transit');
  const scheduled = deliveries.filter((d: any) => d.status === 'scheduled');
  const delivered = deliveries.filter((d: any) => d.status === 'delivered');

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Truck className="text-primary-600" size={28} />
            Transport Operations Dashboard
          </h1>
          <p className="page-subtitle">Central logistics management, live vehicle dispatches, and delivery coordination</p>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => refetchDel()} className="btn-secondary flex items-center gap-2">
            <RefreshCw size={16} /> Refresh
          </button>
          <Link to="/transport/schedule" className="btn-primary flex items-center gap-2">
            <Plus size={16} /> Schedule Delivery
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Active In-Transit"
          value={inTransit.length}
          icon={<Navigation size={22} className="animate-pulse" />}
          iconBg="bg-blue-100"
          iconColor="text-blue-600"
          loading={loadingDel}
        />
        <StatCard
          title="Scheduled Dispatches"
          value={scheduled.length}
          icon={<Calendar size={22} />}
          iconBg="bg-amber-100"
          iconColor="text-amber-600"
          loading={loadingDel}
        />
        <StatCard
          title="Delivered Total"
          value={delivered.length}
          icon={<CheckCircle size={22} />}
          iconBg="bg-emerald-100"
          iconColor="text-emerald-600"
          loading={loadingDel}
        />
        <StatCard
          title="Fleet Assets"
          value={vehicles.length}
          icon={<Truck size={22} />}
          iconBg="bg-primary-100"
          iconColor="text-primary-600"
          loading={loadingVeh}
        />
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active In-Transit List (2 cols) */}
        <div className="card lg:col-span-2">
          <div className="card-header flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-surface-900">Active In-Transit Shipments</h2>
              <p className="text-xs text-surface-500">Live monitoring of shipments on the road</p>
            </div>
            <Link to="/transport/active" className="text-xs text-primary-600 hover:text-primary-700 font-semibold flex items-center gap-1">
              View All <ChevronRight size={14} />
            </Link>
          </div>

          {inTransit.length === 0 ? (
            <div className="empty-state py-10 text-center">
              <Truck className="w-10 h-10 text-surface-300 mx-auto mb-2" />
              <p className="text-surface-500 text-sm font-medium">No shipments currently in transit</p>
              <Link to="/transport/schedule" className="btn-primary btn-sm mt-3 inline-flex items-center gap-1">
                <Plus size={14} /> Schedule a Dispatch
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-surface-100">
              {inTransit.slice(0, 5).map((d: any) => (
                <div key={d.id} className="flex items-center justify-between p-4 hover:bg-surface-50 transition-colors">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-surface-900 text-sm">{d.schedule_no}</span>
                      <span className="bg-blue-100 text-blue-800 text-2xs px-2 py-0.5 rounded-full font-semibold">
                        In Transit
                      </span>
                    </div>
                    <p className="text-xs text-surface-600 mt-1">
                      📍 {d.delivery_address}
                    </p>
                    <p className="text-2xs text-surface-400 mt-0.5">
                      Driver: {d.drivers?.full_name || 'Assigned'} · Vehicle: {d.transport_vehicles?.plate_number || 'Assigned'}
                    </p>
                  </div>
                  <Link
                    to="/transport/active"
                    className="btn-secondary py-1 px-2.5 text-xs font-semibold text-primary-700"
                  >
                    Track
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Tools & Fleet Overview (1 col) */}
        <div className="space-y-4">
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-surface-900 mb-3">Logistics Quick Actions</h2>
            <div className="grid grid-cols-1 gap-2.5">
              <Link
                to="/transport/schedule"
                className="flex items-center gap-3 p-3 bg-surface-50 hover:bg-primary-50 rounded-xl transition-colors border border-surface-100 group"
              >
                <div className="w-9 h-9 bg-amber-100 rounded-lg flex items-center justify-center text-amber-700 font-bold">
                  📅
                </div>
                <div>
                  <div className="text-xs font-bold text-surface-900 group-hover:text-primary-700">Delivery Schedule</div>
                  <div className="text-2xs text-surface-500">Create, edit, and dispatch deliveries</div>
                </div>
              </Link>

              <Link
                to="/transport/active"
                className="flex items-center gap-3 p-3 bg-surface-50 hover:bg-primary-50 rounded-xl transition-colors border border-surface-100 group"
              >
                <div className="w-9 h-9 bg-blue-100 rounded-lg flex items-center justify-center text-blue-700 font-bold">
                  🚚
                </div>
                <div>
                  <div className="text-xs font-bold text-surface-900 group-hover:text-primary-700">Active Shipments</div>
                  <div className="text-2xs text-surface-500">Live checkpoint tracking & delivery sign-off</div>
                </div>
              </Link>

              <Link
                to="/transport/vehicles"
                className="flex items-center gap-3 p-3 bg-surface-50 hover:bg-primary-50 rounded-xl transition-colors border border-surface-100 group"
              >
                <div className="w-9 h-9 bg-emerald-100 rounded-lg flex items-center justify-center text-emerald-700 font-bold">
                  🚛
                </div>
                <div>
                  <div className="text-xs font-bold text-surface-900 group-hover:text-primary-700">Fleet & Drivers</div>
                  <div className="text-2xs text-surface-500">{vehicles.length} vehicles · {drivers.length} drivers</div>
                </div>
              </Link>
            </div>
          </div>

          {/* Fleet Status Summary Card */}
          <div className="card p-5 bg-gradient-to-br from-surface-50 to-primary-50/40 border border-primary-100">
            <h3 className="text-xs font-bold text-surface-800 uppercase tracking-wider mb-2">Fleet Readiness</h3>
            <div className="flex items-center justify-between text-xs py-1">
              <span className="text-surface-600">Registered Vehicles</span>
              <span className="font-bold font-mono text-surface-900">{vehicles.length}</span>
            </div>
            <div className="flex items-center justify-between text-xs py-1">
              <span className="text-surface-600">Registered Drivers</span>
              <span className="font-bold font-mono text-surface-900">{drivers.length}</span>
            </div>
            <div className="flex items-center justify-between text-xs py-1">
              <span className="text-surface-600">Active Deliveries</span>
              <span className="font-bold font-mono text-primary-700">{inTransit.length + scheduled.length}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
