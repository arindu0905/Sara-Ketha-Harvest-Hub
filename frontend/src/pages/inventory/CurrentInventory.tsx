import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { inventoryApi, cropsApi } from '../../services/api';
import { formatDateSL } from '../../utils/lkrFormat';
import { Package, ChevronRight } from 'lucide-react';

export const CurrentInventory: React.FC = () => {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const { data: catRes } = useQuery({ queryKey: ['crop-categories'], queryFn: () => cropsApi.getCategories() });
  const categories: any[] = catRes?.data?.data || [];

  const { data: invRes, isLoading } = useQuery({
    queryKey: ['inventory-list', page, statusFilter, search, categoryId],
    queryFn: () => inventoryApi.getAll({ page: page.toString(), limit: '20', ...(statusFilter && { status: statusFilter }), ...(search.trim() && { search: search.trim() }), ...(categoryId && { category_id: categoryId }) }),
  });

  const batches = invRes?.data?.data || [];
  const total = invRes?.data?.meta?.total || 0;
  const totalPages = Math.ceil(total / 20);

  const statusBadge = (s: string) => {
    const m: Record<string, string> = { available: 'badge-success', reserved: 'badge-warning', partially_sold: 'badge-info', expired: 'badge-danger', damaged: 'badge-danger' };
    return <span className={m[s] || 'badge-neutral'}>{s}</span>;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header"><div><h1 className="page-title">Current Inventory</h1><p className="page-subtitle">{total} batches</p></div></div>

      <div className="card p-4 flex flex-wrap gap-3">
        <input className="form-input w-56" placeholder="Search batch no…" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        <select className="form-select w-auto" value={categoryId} onChange={e => { setCategoryId(e.target.value); setPage(1); }}>
          <option value="">All crops</option>{categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className="form-select w-auto" value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
          <option value="">All Status</option>
          <option value="available">Available</option>
          <option value="reserved">Reserved</option>
          <option value="partially_sold">Partially Sold</option>
          <option value="expired">Expired</option>
        </select>
      </div>

      {isLoading ? <div className="card p-6 space-y-3">{[1,2,3,4].map(i => <div key={i} className="skeleton h-14 rounded-xl" />)}</div> : (
        <><div className="card overflow-hidden"><div className="table-container"><table className="table">
          <thead><tr><th>Batch No</th><th>Crop</th><th>Grade</th><th>Available</th><th>Reserved</th><th>Expiry</th><th>Farmer</th><th>Warehouse</th><th>Status</th><th></th></tr></thead>
          <tbody>{batches.map((b: any) => (
            <tr key={b.id}>
              <td className="font-semibold font-mono text-xs">{b.batch_no}</td>
              <td>{b.crop_categories?.name}<br /><span className="text-xs text-surface-400">{b.crop_varieties?.name}</span></td>
              <td className="capitalize">{b.grade?.replace(/_/g, ' ')}</td>
              <td className="font-bold text-primary-700">{b.available_qty_kg} kg</td>
              <td>{Number(b.reserved_qty_kg) > 0 ? `${b.reserved_qty_kg} kg` : '—'}</td>
              <td className={`text-xs ${b.expected_expiry_date && new Date(b.expected_expiry_date) < new Date() ? 'text-red-600 font-semibold' : ''}`}>{b.expected_expiry_date ? formatDateSL(b.expected_expiry_date) : '—'}</td>
              <td className="text-sm">{b.farmers?.full_name}<br /><span className="text-xs text-surface-400">{b.farmers?.farmer_code}</span></td>
              <td className="text-xs">{b.warehouses?.name || '—'}</td>
              <td>{statusBadge(b.status)}</td>
              <td><Link to={`/inventory/stock/${b.id}`} className="btn-ghost p-1 rounded-lg"><ChevronRight size={16} /></Link></td>
            </tr>
          ))}</tbody>
        </table></div></div>
        {totalPages > 1 && <div className="flex justify-center gap-2">
          <button onClick={() => setPage(p => Math.max(1,p-1))} disabled={page===1} className="btn-secondary btn-sm">Previous</button>
          <span className="flex items-center text-sm text-surface-500">Page {page} of {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages,p+1))} disabled={page===totalPages} className="btn-secondary btn-sm">Next</button>
        </div>}</>
      )}
    </div>
  );
};
