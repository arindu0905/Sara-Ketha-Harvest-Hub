import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { collectionsApi } from '../../services/api';
import { Package, Scale, ChevronRight } from 'lucide-react';

export const CollectionHistory: React.FC = () => {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');

  const { data: collectionsRes, isLoading } = useQuery({
    queryKey: ['officer-collections', page, statusFilter],
    queryFn: () => collectionsApi.getAll({ page: page.toString(), limit: '20', ...(statusFilter && { status: statusFilter }) }),
  });

  const collections = collectionsRes?.data?.data || [];
  const total = collectionsRes?.data?.meta?.total || 0;
  const totalPages = Math.ceil(total / 20);

  const statusBadge = (s: string) => {
    const map: Record<string, string> = {
      arrived: 'badge-info', weighed: 'badge-info', accepted: 'badge-success',
      partially_accepted: 'badge-earth', rejected: 'badge-danger', completed: 'badge-success',
      payment_pending: 'badge-warning', added_to_inventory: 'badge-success',
    };
    return <span className={map[s] || 'badge-neutral'}>{s?.replace(/_/g, ' ')}</span>;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div><h1 className="page-title">Collection History</h1><p className="page-subtitle">{total} total collections</p></div>
        <Link to="/officer/collections/register" className="btn-primary btn-sm"><Package size={14} /> New Collection</Link>
      </div>

      <div className="card p-4">
        <select className="form-select w-auto" value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
          <option value="">All Status</option>
          <option value="arrived">Arrived</option>
          <option value="weighed">Weighed</option>
          <option value="accepted">Accepted</option>
          <option value="rejected">Rejected</option>
          <option value="completed">Completed</option>
        </select>
      </div>

      {isLoading ? (
        <div className="card p-6 space-y-3">{[1,2,3,4].map(i => <div key={i} className="skeleton h-14 rounded-xl" />)}</div>
      ) : (
        <>
          <div className="card overflow-hidden">
            <div className="table-container">
              <table className="table">
                <thead><tr><th>Collection No</th><th>Farmer</th><th>Crop</th><th>Net Weight</th><th>Status</th><th>Date</th><th></th></tr></thead>
                <tbody>
                  {collections.map((c: any) => (
                    <tr key={c.id}>
                      <td className="font-semibold">{c.collection_no}</td>
                      <td>{c.farmers?.full_name}<br /><span className="text-xs text-surface-400">{c.farmers?.farmer_code}</span></td>
                      <td>{c.crop_categories?.name || '—'}</td>
                      <td>{c.net_weight_kg ? `${c.net_weight_kg} kg` : '—'}</td>
                      <td>{statusBadge(c.status)}</td>
                      <td className="text-xs text-surface-500">{new Date(c.created_at).toLocaleDateString('en-LK')}</td>
                      <td>
                        {c.status === 'arrived' && <Link to={`/officer/collections/${c.id}/weigh`} className="btn-secondary btn-sm"><Scale size={12} /> Weigh</Link>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          {totalPages > 1 && (
            <div className="flex justify-center gap-2">
              <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1} className="btn-secondary btn-sm">Previous</button>
              <span className="flex items-center text-sm text-surface-500">Page {page} of {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page === totalPages} className="btn-secondary btn-sm">Next</button>
            </div>
          )}
        </>
      )}
    </div>
  );
};
