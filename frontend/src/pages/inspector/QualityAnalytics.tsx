import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { collectionsApi } from '../../services/api';
import { BarChart3 } from 'lucide-react';

export const QualityAnalytics: React.FC = () => {
  const { data: collectionsRes, isLoading } = useQuery({
    queryKey: ['quality-analytics-collections'],
    queryFn: () => collectionsApi.getAll({ limit: '200' }),
  });

  const allCollections = collectionsRes?.data?.data || [];
  const inspected = allCollections.filter((c: any) => c.quality_inspections?.length > 0);

  const gradeCount: Record<string, number> = {};
  let totalAccepted = 0, totalRejected = 0;
  inspected.forEach((c: any) => {
    const insp = c.quality_inspections[0];
    gradeCount[insp.grade] = (gradeCount[insp.grade] || 0) + 1;
    totalAccepted += insp.accepted_qty_kg || 0;
    totalRejected += insp.rejected_qty_kg || 0;
  });

  const total = totalAccepted + totalRejected;
  const acceptRate = total > 0 ? ((totalAccepted / total) * 100).toFixed(1) : '0';

  const gradeColors: Record<string, string> = { grade_a: 'bg-primary-500', grade_b: 'bg-blue-500', grade_c: 'bg-yellow-500', rejected: 'bg-red-500' };
  const gradeLabels: Record<string, string> = { grade_a: 'Grade A', grade_b: 'Grade B', grade_c: 'Grade C', rejected: 'Rejected' };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header"><div><h1 className="page-title">Quality Analytics</h1><p className="page-subtitle">Inspection quality metrics</p></div></div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="stat-card"><div className="stat-icon bg-primary-100 text-primary-600"><BarChart3 size={22} /></div><div><p className="text-xs font-medium text-surface-500">Total Inspected</p><p className="text-2xl font-bold text-surface-900">{inspected.length}</p></div></div>
        <div className="stat-card"><div className="stat-icon bg-green-100 text-green-600">✓</div><div><p className="text-xs font-medium text-surface-500">Acceptance Rate</p><p className="text-2xl font-bold text-surface-900">{acceptRate}%</p></div></div>
        <div className="stat-card"><div className="stat-icon bg-blue-100 text-blue-600">📊</div><div><p className="text-xs font-medium text-surface-500">Accepted Qty</p><p className="text-2xl font-bold text-surface-900">{totalAccepted.toLocaleString()} kg</p></div></div>
        <div className="stat-card"><div className="stat-icon bg-red-100 text-red-600">✗</div><div><p className="text-xs font-medium text-surface-500">Rejected Qty</p><p className="text-2xl font-bold text-surface-900">{totalRejected.toLocaleString()} kg</p></div></div>
      </div>

      {/* Grade Distribution */}
      <div className="card p-6">
        <h3 className="text-sm font-semibold text-surface-800 mb-4">Grade Distribution</h3>
        {inspected.length === 0 ? (
          <p className="text-surface-400 text-sm text-center py-8">No inspection data available</p>
        ) : (
          <div className="space-y-3">
            {Object.entries(gradeCount).sort().map(([grade, count]) => {
              const pct = ((count / inspected.length) * 100).toFixed(0);
              return (
                <div key={grade}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium text-surface-700">{gradeLabels[grade] || grade}</span>
                    <span className="text-surface-500">{count} ({pct}%)</span>
                  </div>
                  <div className="h-3 bg-surface-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${gradeColors[grade] || 'bg-surface-400'} transition-all duration-500`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
