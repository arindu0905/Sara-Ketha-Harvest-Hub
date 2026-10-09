import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { inspectionsApi } from '../../services/api';
import { ClipboardList, ChevronRight, Scale } from 'lucide-react';

export const PendingInspections: React.FC = () => {
  const { data: pendingRes, isLoading, refetch } = useQuery({
    queryKey: ['pending-inspections'],
    queryFn: () => inspectionsApi.getPending(),
  });
  const pending = pendingRes?.data?.data || [];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header flex justify-between items-center">
        <div>
          <h1 className="page-title">Pending Inspections</h1>
          <p className="page-subtitle">{pending.length} collections awaiting quality inspection</p>
        </div>
        <button onClick={() => refetch()} className="btn-ghost btn-sm">Refresh List</button>
      </div>

      {isLoading ? (
        <div className="card p-6 space-y-3">{[1, 2, 3].map(i => <div key={i} className="skeleton h-16 rounded-xl" />)}</div>
      ) : pending.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <ClipboardList className="w-10 h-10 text-surface-300 mb-2" />
            <p className="text-surface-600 font-medium">No pending inspections</p>
            <p className="text-surface-400 text-xs mt-1">Weighed collections will automatically appear here for quality grading.</p>
          </div>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Collection No</th>
                  <th>Farmer</th>
                  <th>Crop Category</th>
                  <th>Net Weight</th>
                  <th>Collection Centre</th>
                  <th>Weighed Date</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {pending.map((c: any) => (
                  <tr key={c.id} className="hover:bg-surface-50 transition-colors">
                    <td className="font-semibold text-primary-700">{c.collection_no}</td>
                    <td>
                      <span className="font-medium">{c.farmers?.full_name || 'N/A'}</span>
                      <br />
                      <span className="text-xs text-surface-400">{c.farmers?.farmer_code}</span>
                    </td>
                    <td className="font-medium">{c.crop_categories?.name || 'N/A'}</td>
                    <td>
                      <span className="badge-primary font-bold text-sm">
                        <Scale size={12} className="inline mr-1" />
                        {c.net_weight_kg ? `${c.net_weight_kg} kg` : '—'}
                      </span>
                    </td>
                    <td className="text-xs font-medium">{c.collection_centres?.name || 'N/A'}</td>
                    <td className="text-xs text-surface-500">
                      {c.created_at ? new Date(c.created_at).toLocaleDateString('en-LK') : '—'}
                    </td>
                    <td>
                      <Link to={`/inspector/inspections/create/${c.id}`} className="btn-primary btn-sm flex items-center gap-1">
                        Inspect Produce <ChevronRight size={14} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
