import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { inventoryApi } from '../../services/api';
import { AlertTriangle, ChevronRight } from 'lucide-react';

export const NearExpiryStock: React.FC = () => {
  const { data: invRes, isLoading } = useQuery({ queryKey: ['near-expiry-stock'], queryFn: () => inventoryApi.getAll({ near_expiry: 'true', limit: '50' }) });
  const batches = invRes?.data?.data || [];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header"><div><h1 className="page-title">Near Expiry Stock</h1><p className="page-subtitle">Batches expiring within 7 days</p></div></div>
      {isLoading ? <div className="card p-6 space-y-3">{[1,2,3].map(i => <div key={i} className="skeleton h-14 rounded-xl" />)}</div> : batches.length === 0 ? (
        <div className="card"><div className="empty-state"><AlertTriangle className="w-8 h-8 text-surface-300 mb-2" /><p className="text-surface-400 text-sm">No near-expiry stock — looking good!</p></div></div>
      ) : (
        <div className="card overflow-hidden"><div className="table-container"><table className="table">
          <thead><tr><th>Batch No</th><th>Crop</th><th>Grade</th><th>Available</th><th>Expiry Date</th><th>Days Left</th><th></th></tr></thead>
          <tbody>{batches.map((b: any) => {
            const daysLeft = Math.ceil((new Date(b.expected_expiry_date).getTime() - Date.now()) / 86400000);
            return (
              <tr key={b.id} className={daysLeft <= 2 ? 'bg-red-50' : daysLeft <= 5 ? 'bg-yellow-50' : ''}>
                <td className="font-semibold font-mono text-xs">{b.batch_no}</td>
                <td>{b.crop_categories?.name}</td><td className="capitalize">{b.grade?.replace(/_/g, ' ')}</td>
                <td className="font-bold">{b.available_qty_kg} kg</td>
                <td>{new Date(b.expected_expiry_date).toLocaleDateString('en-LK')}</td>
                <td><span className={`badge text-xs ${daysLeft <= 2 ? 'badge-danger' : 'badge-warning'}`}>{daysLeft} day{daysLeft !== 1 ? 's' : ''}</span></td>
                <td><Link to={`/inventory/stock/${b.id}`} className="btn-ghost p-1 rounded-lg"><ChevronRight size={16} /></Link></td>
              </tr>
            );
          })}</tbody>
        </table></div></div>
      )}
    </div>
  );
};
