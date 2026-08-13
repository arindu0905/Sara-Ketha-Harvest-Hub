import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { inventoryApi } from '../../services/api';
import { Trash2 } from 'lucide-react';

export const WastageRecords: React.FC = () => {
  const { data: invRes, isLoading } = useQuery({ queryKey: ['inventory-all-wastage'], queryFn: () => inventoryApi.getAll({ limit: '100' }) });
  const batches = (invRes?.data?.data || []).filter((b: any) => (b.wasted_qty_kg || 0) > 0);
  const totalWasted = batches.reduce((s: number, b: any) => s + (b.wasted_qty_kg || 0), 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header"><div><h1 className="page-title">Wastage Records</h1><p className="page-subtitle">Track damaged and wasted stock</p></div></div>

      <div className="stat-card max-w-sm">
        <div className="stat-icon bg-red-100 text-red-600"><Trash2 size={22} /></div>
        <div><p className="text-xs font-medium text-surface-500">Total Wastage</p><p className="text-2xl font-bold text-red-700">{totalWasted.toLocaleString()} kg</p></div>
      </div>

      {isLoading ? <div className="card p-6 space-y-3">{[1,2,3].map(i => <div key={i} className="skeleton h-14 rounded-xl" />)}</div> : batches.length === 0 ? (
        <div className="card"><div className="empty-state"><Trash2 className="w-8 h-8 text-surface-300 mb-2" /><p className="text-surface-400 text-sm">No wastage recorded</p></div></div>
      ) : (
        <div className="card overflow-hidden"><div className="table-container"><table className="table">
          <thead><tr><th>Batch No</th><th>Crop</th><th>Initial Qty</th><th>Wasted</th><th>% Wasted</th><th>Status</th></tr></thead>
          <tbody>{batches.map((b: any) => {
            const pct = ((b.wasted_qty_kg / b.initial_qty_kg) * 100).toFixed(1);
            return (
              <tr key={b.id}><td className="font-semibold font-mono text-xs">{b.batch_no}</td><td>{b.crop_categories?.name}</td><td>{b.initial_qty_kg} kg</td>
              <td className="text-red-700 font-bold">{b.wasted_qty_kg} kg</td><td><span className={`badge text-xs ${parseFloat(pct) > 10 ? 'badge-danger' : 'badge-warning'}`}>{pct}%</span></td>
              <td className="capitalize">{b.status}</td></tr>
            );
          })}</tbody>
        </table></div></div>
      )}
    </div>
  );
};
