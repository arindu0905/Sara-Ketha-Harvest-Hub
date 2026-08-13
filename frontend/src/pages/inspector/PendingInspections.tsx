import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { inspectionsApi } from '../../services/api';
import { ClipboardList, ChevronRight } from 'lucide-react';

export const PendingInspections: React.FC = () => {
  const { data: pendingRes, isLoading } = useQuery({ queryKey: ['pending-inspections'], queryFn: () => inspectionsApi.getPending() });
  const pending = pendingRes?.data?.data || [];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header"><div><h1 className="page-title">Pending Inspections</h1><p className="page-subtitle">{pending.length} collections awaiting inspection</p></div></div>
      {isLoading ? (
        <div className="card p-6 space-y-3">{[1,2,3].map(i => <div key={i} className="skeleton h-16 rounded-xl" />)}</div>
      ) : pending.length === 0 ? (
        <div className="card"><div className="empty-state"><ClipboardList className="w-8 h-8 text-surface-300 mb-2" /><p className="text-surface-400 text-sm">No pending inspections</p></div></div>
      ) : (
        <div className="card overflow-hidden"><div className="table-container">
          <table className="table">
            <thead><tr><th>Collection No</th><th>Farmer</th><th>Crop</th><th>Net Weight</th><th>Centre</th><th>Date</th><th></th></tr></thead>
            <tbody>
              {pending.map((c: any) => (
                <tr key={c.id}>
                  <td className="font-semibold">{c.collection_no}</td>
                  <td>{c.farmers?.full_name}<br /><span className="text-xs text-surface-400">{c.farmers?.farmer_code}</span></td>
                  <td>{c.crop_categories?.name}</td>
                  <td className="font-medium">{c.net_weight_kg} kg</td>
                  <td className="text-xs">{c.collection_centres?.name}</td>
                  <td className="text-xs text-surface-500">{new Date(c.created_at).toLocaleDateString('en-LK')}</td>
                  <td><Link to={`/inspector/inspect/${c.id}`} className="btn-primary btn-sm">Inspect</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div></div>
      )}
    </div>
  );
};
