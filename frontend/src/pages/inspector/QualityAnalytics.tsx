import React, { useMemo } from 'react';
import { one } from '../../utils/relations';
import { useQuery } from '@tanstack/react-query';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { collectionsApi } from '../../services/api';
import { StatCard } from '../../components/ui/StatCard';
import { BarChart3, Percent, PackageCheck, PackageX } from 'lucide-react';

const GRADE: Record<string, { label: string; color: string }> = {
  grade_a: { label: 'Grade A', color: '#16a34a' }, grade_b: { label: 'Grade B', color: '#3b82f6' },
  grade_c: { label: 'Grade C', color: '#eab308' }, rejected: { label: 'Rejected', color: '#dc2626' },
};

export const QualityAnalytics: React.FC = () => {
  const { data: res, isLoading } = useQuery({ queryKey: ['quality-analytics-collections'], queryFn: () => collectionsApi.getAll({ limit: '200' }) });

  const a = useMemo(() => {
    const inspected: any[] = (res?.data?.data || []).filter((c: any) => !!one(c.quality_inspections));
    const grades: Record<string, number> = {};
    const byCrop: Record<string, { accepted: number; rejected: number }> = {};
    let acc = 0, rej = 0;
    inspected.forEach(c => {
      const i: any = one(c.quality_inspections);
      grades[i.grade] = (grades[i.grade] || 0) + 1;
      acc += Number(i.accepted_qty_kg || 0); rej += Number(i.rejected_qty_kg || 0);
      const crop = c.crop_categories?.name || 'Other';
      byCrop[crop] ||= { accepted: 0, rejected: 0 };
      byCrop[crop].accepted += Number(i.accepted_qty_kg || 0); byCrop[crop].rejected += Number(i.rejected_qty_kg || 0);
    });
    return {
      count: inspected.length, acc, rej,
      rate: acc + rej > 0 ? (acc / (acc + rej)) * 100 : 0,
      pie: Object.entries(grades).map(([g, n]) => ({ name: GRADE[g]?.label || g, value: n, color: GRADE[g]?.color || '#94a3b8' })),
      crops: Object.entries(byCrop).map(([name, v]) => ({
        name, Accepted: Math.round(v.accepted), Rejected: Math.round(v.rejected),
        rate: v.accepted + v.rejected > 0 ? Math.round((v.accepted / (v.accepted + v.rejected)) * 100) : 0,
      })).sort((x, y) => x.rate - y.rate),
    };
  }, [res]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header"><div><h1 className="page-title">Quality Analytics</h1><p className="page-subtitle">Grades, acceptance and rejection by crop (last 200 collections)</p></div></div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Inspected" value={a.count} icon={<BarChart3 size={22} />} loading={isLoading} />
        <StatCard title="Acceptance rate" value={`${a.rate.toFixed(1)}%`} icon={<Percent size={22} />} iconBg="bg-green-100" iconColor="text-green-600" loading={isLoading} />
        <StatCard title="Accepted" value={`${Math.round(a.acc).toLocaleString()} kg`} icon={<PackageCheck size={22} />} iconBg="bg-blue-100" iconColor="text-blue-600" loading={isLoading} />
        <StatCard title="Rejected" value={`${Math.round(a.rej).toLocaleString()} kg`} icon={<PackageX size={22} />} iconBg="bg-red-100" iconColor="text-red-600" loading={isLoading} />
      </div>

      {a.count === 0 && !isLoading ? (
        <div className="card p-6"><p className="text-surface-400 text-sm text-center py-8">No inspection data available yet</p></div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card p-4 h-80"><h3 className="text-sm font-semibold mb-2">Grade distribution</h3>
            <ResponsiveContainer width="100%" height="90%"><PieChart><Pie data={a.pie} dataKey="value" nameKey="name" outerRadius={90} label>
              {a.pie.map((p, i) => <Cell key={i} fill={p.color} />)}</Pie><Tooltip /><Legend /></PieChart></ResponsiveContainer></div>
          <div className="card p-4 h-80"><h3 className="text-sm font-semibold mb-2">Accepted vs rejected by crop (kg)</h3>
            <ResponsiveContainer width="100%" height="90%"><BarChart data={a.crops}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} /><Tooltip /><Legend />
              <Bar dataKey="Accepted" stackId="a" fill="#16a34a" /><Bar dataKey="Rejected" stackId="a" fill="#dc2626" /></BarChart></ResponsiveContainer></div>
          <div className="card lg:col-span-2 overflow-hidden"><div className="card-header"><h3 className="text-sm font-semibold">Crops needing attention (lowest acceptance first)</h3></div>
            <div className="table-container"><table className="table"><thead><tr><th>Crop</th><th>Accepted</th><th>Rejected</th><th>Acceptance</th></tr></thead>
              <tbody>{a.crops.map(c => (<tr key={c.name}><td className="font-medium">{c.name}</td><td>{c.Accepted} kg</td><td className="text-red-600">{c.Rejected} kg</td>
                <td><span className={c.rate < 80 ? 'badge-danger' : c.rate < 90 ? 'badge-warning' : 'badge-success'}>{c.rate}%</span></td></tr>))}</tbody></table></div></div>
        </div>
      )}
    </div>
  );
};
