import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { inspectionsApi, collectionsApi } from '../../services/api';
import { StatCard } from '../../components/ui/StatCard';
import { ClipboardList, CheckSquare, BarChart3, ChevronRight } from 'lucide-react';

export const InspectorDashboard: React.FC = () => {
  const { data: pendingRes, isLoading } = useQuery({ queryKey: ['pending-inspections'], queryFn: () => inspectionsApi.getPending() });
  const pending = pendingRes?.data?.data || [];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div><h1 className="page-title">Inspector Dashboard</h1><p className="page-subtitle">Quality inspection overview</p></div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard title="Pending Inspections" value={pending.length} icon={<ClipboardList size={22} />} iconBg="bg-yellow-100" iconColor="text-yellow-600" loading={isLoading} />
        <StatCard title="Awaiting Review" value={pending.filter((p: any) => p.status === 'weighed').length} icon={<CheckSquare size={22} />} iconBg="bg-blue-100" iconColor="text-blue-600" />
        <StatCard title="Analytics" value="View" icon={<BarChart3 size={22} />} iconBg="bg-primary-100" iconColor="text-primary-600" />
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="text-sm font-semibold text-surface-800">Collections Awaiting Inspection</h2>
          <Link to="/inspector/pending" className="text-xs text-primary-600 flex items-center gap-1">View all <ChevronRight size={14} /></Link>
        </div>
        {pending.length === 0 ? (
          <div className="empty-state py-8"><ClipboardList className="w-8 h-8 text-surface-300 mb-2" /><p className="text-surface-400 text-sm">No pending inspections</p></div>
        ) : (
          <div className="divide-y divide-surface-50">
            {pending.slice(0, 5).map((c: any) => (
              <Link key={c.id} to={`/inspector/inspect/${c.id}`} className="flex items-center justify-between p-4 hover:bg-surface-50 transition-colors">
                <div>
                  <p className="text-sm font-semibold text-surface-800">{c.collection_no}</p>
                  <p className="text-xs text-surface-500">{c.farmers?.full_name} · {c.crop_categories?.name} · {c.net_weight_kg} kg</p>
                </div>
                <div className="text-right">
                  <span className="badge-warning text-xs">Awaiting</span>
                  <p className="text-xs text-surface-400 mt-1">{c.collection_centres?.name}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
