import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { collectionsApi } from '../../services/api';
import { CheckSquare } from 'lucide-react';

export const InspectionHistory: React.FC = () => {
  const { data: collectionsRes, isLoading } = useQuery({
    queryKey: ['inspected-collections'],
    queryFn: () => collectionsApi.getAll({ limit: '50' }),
  });

  const inspected = (collectionsRes?.data?.data || []).filter((c: any) => c.quality_inspections?.length > 0);

  const gradeBadge = (g: string) => {
    switch (g) { case 'grade_a': return <span className="badge-success">Grade A</span>; case 'grade_b': return <span className="badge-info">Grade B</span>; case 'grade_c': return <span className="badge-warning">Grade C</span>; case 'rejected': return <span className="badge-danger">Rejected</span>; default: return <span className="badge-neutral">{g}</span>; }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header"><div><h1 className="page-title">Inspection History</h1><p className="page-subtitle">Past quality inspections</p></div></div>
      {isLoading ? <div className="card p-6 space-y-3">{[1,2,3].map(i => <div key={i} className="skeleton h-14 rounded-xl" />)}</div> : inspected.length === 0 ? (
        <div className="card"><div className="empty-state"><CheckSquare className="w-8 h-8 text-surface-300 mb-2" /><p className="text-surface-400 text-sm">No inspection history</p></div></div>
      ) : (
        <div className="card overflow-hidden"><div className="table-container"><table className="table">
          <thead><tr><th>Collection</th><th>Farmer</th><th>Crop</th><th>Grade</th><th>Accepted</th><th>Rejected</th><th>Date</th></tr></thead>
          <tbody>{inspected.map((c: any) => { const insp = c.quality_inspections[0]; return (
            <tr key={c.id}><td className="font-semibold">{c.collection_no}</td><td>{c.farmers?.full_name}</td><td>{c.crop_categories?.name}</td><td>{gradeBadge(insp.grade)}</td><td className="text-primary-700 font-medium">{insp.accepted_qty_kg} kg</td><td className="text-red-600">{insp.rejected_qty_kg > 0 ? `${insp.rejected_qty_kg} kg` : '—'}</td><td className="text-xs text-surface-500">{new Date(c.created_at).toLocaleDateString('en-LK')}</td></tr>
          ); })}</tbody>
        </table></div></div>
      )}
    </div>
  );
};
