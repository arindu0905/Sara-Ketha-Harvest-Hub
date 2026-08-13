import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { inventoryApi } from '../../services/api';
import { ArrowLeft, Package, Scale, Clock, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

export const BatchDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: batchRes, isLoading } = useQuery({ queryKey: ['batch-detail', id], queryFn: () => inventoryApi.getById(id!), enabled: !!id });
  const batch = batchRes?.data?.data;

  const adjustForm = useForm<{ adjustment_type: string; quantity_kg: string; notes: string }>();
  const adjustMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => inventoryApi.adjust(id!, data),
    onSuccess: () => { toast.success('Stock adjusted'); queryClient.invalidateQueries({ queryKey: ['batch-detail', id] }); adjustForm.reset(); },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed'),
  });

  if (isLoading) return <div className="card p-8"><div className="skeleton h-64 rounded-xl" /></div>;
  if (!batch) return <div className="card"><div className="empty-state"><p>Batch not found</p></div></div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="btn-ghost p-2 rounded-xl"><ArrowLeft size={18} /></button>
          <div><h1 className="page-title">{batch.batch_no}</h1><p className="page-subtitle">Batch details and transactions</p></div>
        </div>
        <span className={`badge ${batch.status === 'available' ? 'badge-success' : 'badge-neutral'}`}>{batch.status}</span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="stat-card"><div className="stat-icon bg-primary-100 text-primary-600"><Package size={20} /></div><div><p className="text-xs text-surface-500">Available</p><p className="text-xl font-bold">{batch.available_qty_kg} kg</p></div></div>
        <div className="stat-card"><div className="stat-icon bg-blue-100 text-blue-600"><Scale size={20} /></div><div><p className="text-xs text-surface-500">Initial</p><p className="text-xl font-bold">{batch.initial_qty_kg} kg</p></div></div>
        <div className="stat-card"><div className="stat-icon bg-yellow-100 text-yellow-600">📦</div><div><p className="text-xs text-surface-500">Reserved</p><p className="text-xl font-bold">{batch.reserved_qty_kg || 0} kg</p></div></div>
        <div className="stat-card"><div className="stat-icon bg-red-100 text-red-600">🗑️</div><div><p className="text-xs text-surface-500">Wasted</p><p className="text-xl font-bold">{batch.wasted_qty_kg || 0} kg</p></div></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="card-header"><h3 className="text-sm font-semibold">Batch Info</h3></div>
          <div className="card-body space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-surface-500">Crop</span><span className="font-medium">{batch.crop_categories?.name} {batch.crop_varieties?.name ? `(${batch.crop_varieties.name})` : ''}</span></div>
            <div className="flex justify-between"><span className="text-surface-500">Grade</span><span className="font-medium capitalize">{batch.grade?.replace(/_/g, ' ')}</span></div>
            <div className="flex justify-between"><span className="text-surface-500">Farmer</span><span className="font-medium">{batch.farmers?.full_name} ({batch.farmers?.farmer_code})</span></div>
            <div className="flex justify-between"><span className="text-surface-500">Purchase Price</span><span className="font-medium">LKR {batch.purchase_price_lkr?.toLocaleString()}/kg</span></div>
            <div className="flex justify-between"><span className="text-surface-500">Selling Price</span><span className="font-medium">LKR {batch.selling_price_lkr?.toLocaleString()}/kg</span></div>
            <div className="flex justify-between"><span className="text-surface-500">Warehouse</span><span className="font-medium">{batch.warehouses?.name || '—'}</span></div>
            <div className="flex justify-between"><span className="text-surface-500">Expiry</span><span className="font-medium">{batch.expected_expiry_date ? new Date(batch.expected_expiry_date).toLocaleDateString('en-LK') : '—'}</span></div>
            <div className="flex justify-between"><span className="text-surface-500">QR Code</span><span className="font-mono text-xs">{batch.qr_code_value}</span></div>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h3 className="text-sm font-semibold">Stock Adjustment</h3></div>
          <div className="card-body">
            <form onSubmit={adjustForm.handleSubmit(d => adjustMutation.mutate({ adjustment_type: d.adjustment_type, quantity_kg: parseFloat(d.quantity_kg), notes: d.notes }))} className="space-y-4">
              <select className="form-select" {...adjustForm.register('adjustment_type', { required: true })}>
                <option value="">Select type</option><option value="waste">Waste</option><option value="damage">Damage</option>
              </select>
              <input type="number" step="0.1" min="0.1" max={batch.available_qty_kg} className="form-input" placeholder="Quantity (kg)" {...adjustForm.register('quantity_kg', { required: true })} />
              <textarea className="form-input" rows={2} placeholder="Notes..." {...adjustForm.register('notes')} />
              <button type="submit" disabled={adjustMutation.isPending} className="btn-danger w-full btn-sm">
                {adjustMutation.isPending ? <><Loader2 size={14} className="animate-spin" /> Processing...</> : 'Record Adjustment'}
              </button>
            </form>
          </div>
        </div>
      </div>

      {batch.inventory_transactions?.length > 0 && (
        <div className="card">
          <div className="card-header"><h3 className="text-sm font-semibold">Transaction History</h3></div>
          <div className="table-container"><table className="table">
            <thead><tr><th>Type</th><th>Qty</th><th>Balance</th><th>Notes</th><th>By</th><th>Date</th></tr></thead>
            <tbody>{batch.inventory_transactions.map((t: any) => (
              <tr key={t.id}><td className="capitalize">{t.transaction_type}</td><td className={t.quantity_kg < 0 ? 'text-red-600' : 'text-primary-600'}>{t.quantity_kg} kg</td><td>{t.balance_kg} kg</td><td className="text-xs text-surface-500">{t.notes || '—'}</td><td className="text-xs">{t.profiles?.full_name || '—'}</td><td className="text-xs text-surface-400">{new Date(t.created_at).toLocaleString('en-LK')}</td></tr>
            ))}</tbody>
          </table></div>
        </div>
      )}
    </div>
  );
};
