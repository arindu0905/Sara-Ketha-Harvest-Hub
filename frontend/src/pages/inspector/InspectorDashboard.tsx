import React from 'react';
import { one } from '../../utils/relations';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { inspectionsApi, collectionsApi } from '../../services/api';
import { StatCard } from '../../components/ui/StatCard';
import { ClipboardList, CheckSquare, BarChart3, ChevronRight, Percent } from 'lucide-react';

export const InspectorDashboard: React.FC = () => {
  const { data: pendingRes, isLoading } = useQuery({ queryKey: ['pending-inspections'], queryFn: () => inspectionsApi.getPending() });
  const { data: doneRes } = useQuery({ queryKey: ['inspected-collections'], queryFn: () => collectionsApi.getAll({ limit: '200' }) });
  const pending: any[] = pendingRes?.data?.data || [];
  const inspected: any[] = (doneRes?.data?.data || []).filter((c: any) => !!one(c.quality_inspections));

  const today = new Date().toDateString();
  const todayCount = inspected.filter(c => new Date(c.updated_at || c.created_at).toDateString() === today).length;
  let acc = 0, rej = 0;
  inspected.forEach(c => { const i: any = one(c.quality_inspections) || {}; acc += Number(i.accepted_qty_kg || 0); rej += Number(i.rejected_qty_kg || 0); });
  const rate = acc + rej > 0 ? ((acc / (acc + rej)) * 100).toFixed(1) : '–';
  const pendingKg = pending.reduce((s, c) => s + Number(c.net_weight_kg || 0), 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div><h1 className="page-title">Inspector Dashboard</h1><p className="page-subtitle">Quality inspection overview</p></div>
        <Link to="/inspector/pending" className="btn-primary">Start inspecting</Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Awaiting inspection" value={pending.length} subtitle={`${Math.round(pendingKg).toLocaleString()} kg waiting`} icon={<ClipboardList size={22} />} iconBg="bg-yellow-100" iconColor="text-yellow-600" loading={isLoading} />
        <StatCard title="Inspected today" value={todayCount} icon={<CheckSquare size={22} />} iconBg="bg-blue-100" iconColor="text-blue-600" />
        <StatCard title="Acceptance rate" value={rate === '–' ? rate : `${rate}%`} icon={<Percent size={22} />} iconBg="bg-green-100" iconColor="text-green-600" />
        <Link to="/inspector/analytics"><StatCard title="Quality analytics" value="Open" icon={<BarChart3 size={22} />} iconBg="bg-primary-100" iconColor="text-primary-600" /></Link>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="text-sm font-semibold text-surface-800">Collections awaiting inspection (oldest first)</h2>
          <Link to="/inspector/pending" className="text-xs text-primary-600 flex items-center gap-1">View all <ChevronRight size={14} /></Link>
        </div>
        {pending.length === 0 ? (
          <div className="empty-state py-8"><ClipboardList className="w-8 h-8 text-surface-300 mb-2" /><p className="text-surface-400 text-sm">No pending inspections</p></div>
        ) : (
          <div className="divide-y divide-surface-50">
            {[...pending].sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at)).slice(0, 6).map(c => (
              <Link key={c.id} to={`/inspector/inspections/create/${c.id}`} className="flex items-center justify-between p-4 hover:bg-surface-50 transition-colors">
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
