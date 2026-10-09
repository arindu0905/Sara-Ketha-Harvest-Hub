import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { inventoryApi } from '../../services/api';
import { StatCard } from '../../components/ui/StatCard';
import { Modal } from '../../components/ui/Modal';
import { Trash2, Plus, Banknote } from 'lucide-react';
import { formatLKR, formatDateTimeSL } from '../../utils/lkrFormat';
import { apiErrorMessage } from '../../utils/apiError';

export const WASTE_REASONS = [
  ['spoilage', 'Spoilage'], ['damage', 'Physical damage'], ['expiry', 'Expired'], ['pest_disease', 'Pest / disease'],
  ['handling', 'Handling loss'], ['temperature', 'Temperature'], ['other', 'Other'],
] as const;
const COLORS = ['#dc2626', '#f59e0b', '#7c3aed', '#16a34a', '#0ea5e9', '#64748b', '#be185d'];

export const WastageRecords: React.FC = () => {
  const qc = useQueryClient();
  const [reason, setReason] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ batch_id: '', quantity_kg: '', reason: 'spoilage', notes: '' });

  const { data: res, isLoading } = useQuery({
    queryKey: ['inventory-wastage', reason, from, to],
    queryFn: () => inventoryApi.getWastage({ limit: '100', ...(reason && { reason }), ...(from && { from }), ...(to && { to }) }),
  });
  const { data: batchRes } = useQuery({ queryKey: ['inventory-batches-for-waste'], queryFn: () => inventoryApi.getAll({ limit: '200', status: 'available' }), enabled: open });

  const rows: any[] = res?.data?.data || [];
  const totals = res?.data?.meta?.totals || { total_kg: 0, total_value_lkr: 0, by_reason: {} };
  const pie = Object.entries(totals.by_reason || {}).map(([k, v]: any) => ({ name: k.replace(/_/g, ' '), value: Math.round(v * 10) / 10 }));
  const batches: any[] = (batchRes?.data?.data || []).filter((b: any) => Number(b.available_qty_kg) > 0);
  const selected = batches.find(b => b.id === form.batch_id);

  const record = useMutation({
    mutationFn: () => inventoryApi.recordWastage(form.batch_id, { quantity_kg: Number(form.quantity_kg), reason: form.reason, notes: form.notes || undefined }),
    onSuccess: () => {
      toast.success('Wastage recorded and stock updated');
      setOpen(false); setForm({ batch_id: '', quantity_kg: '', reason: 'spoilage', notes: '' });
      ['inventory-wastage', 'inventory-summary', 'inventory-list', 'inventory-expiry'].forEach(k => qc.invalidateQueries({ queryKey: [k] }));
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const qty = Number(form.quantity_kg);
  const qtyError = form.quantity_kg !== '' && (!(qty > 0) || (selected && qty > Number(selected.available_qty_kg)))
    ? (selected && qty > Number(selected.available_qty_kg) ? `Only ${selected.available_qty_kg} kg available` : 'Enter a quantity above 0') : '';
  const canSubmit = form.batch_id && qty > 0 && !qtyError && !record.isPending;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div><h1 className="page-title">Wastage Records</h1><p className="page-subtitle">Every kilogram written off, with reason and value lost</p></div>
        <button className="btn-primary" onClick={() => setOpen(true)}><Plus size={16} /> Record wastage</button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
        <StatCard title="Total wasted" value={`${Math.round(totals.total_kg).toLocaleString()} kg`} icon={<Trash2 size={22} />} iconBg="bg-red-100" iconColor="text-red-600" loading={isLoading} />
        <StatCard title="Value lost" value={formatLKR(totals.total_value_lkr, 0)} icon={<Banknote size={22} />} iconBg="bg-orange-100" iconColor="text-orange-600" loading={isLoading} />
      </div>

      <div className="card p-4 flex flex-wrap gap-3 items-end">
        <div><label className="form-label">Reason</label>
          <select className="form-select" value={reason} onChange={e => setReason(e.target.value)}>
            <option value="">All reasons</option>{WASTE_REASONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select></div>
        <div><label className="form-label">From</label><input type="date" className="form-input" value={from} max={to || undefined} onChange={e => setFrom(e.target.value)} /></div>
        <div><label className="form-label">To</label><input type="date" className="form-input" value={to} min={from || undefined} onChange={e => setTo(e.target.value)} /></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card p-4 h-72">
          <h2 className="text-sm font-semibold mb-2">By reason (kg)</h2>
          {pie.length === 0 ? <p className="text-sm text-surface-400 text-center pt-16">No data</p> : (
            <ResponsiveContainer width="100%" height="90%"><PieChart><Pie data={pie} dataKey="value" nameKey="name" outerRadius={80}>
              {pie.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip /><Legend /></PieChart></ResponsiveContainer>
          )}
        </div>
        <div className="lg:col-span-2">
          {isLoading ? <div className="card p-6 space-y-3">{[1, 2, 3].map(i => <div key={i} className="skeleton h-14 rounded-xl" />)}</div> : rows.length === 0 ? (
            <div className="card"><div className="empty-state"><Trash2 className="w-8 h-8 text-surface-300 mb-2" /><p className="text-surface-400 text-sm">No wastage recorded for this filter</p></div></div>
          ) : (
            <div className="card overflow-hidden"><div className="table-container"><table className="table">
              <thead><tr><th>Date</th><th>Batch</th><th>Crop</th><th>Qty</th><th>Reason</th><th>Value lost</th><th>By</th></tr></thead>
              <tbody>{rows.map(r => (
                <tr key={r.id}>
                  <td className="text-xs">{formatDateTimeSL(r.created_at)}</td>
                  <td className="font-mono text-xs font-semibold">{r.inventory_batches?.batch_no}</td>
                  <td>{r.inventory_batches?.crop_categories?.name}</td>
                  <td className="text-red-700 font-bold">{Number(r.quantity_kg)} kg</td>
                  <td><span className="badge-neutral capitalize">{String(r.reason).replace(/_/g, ' ')}</span></td>
                  <td>{formatLKR(r.value_lost_lkr, 0)}</td>
                  <td className="text-xs text-surface-500">{r.profiles?.full_name ?? 'System'}</td>
                </tr>))}</tbody>
            </table></div></div>
          )}
        </div>
      </div>

      <Modal isOpen={open} onClose={() => setOpen(false)} title="Record wastage" subtitle="Stock is reduced immediately and the loss is added to the ledger">
        <div className="space-y-4">
          <div><label className="form-label">Batch *</label>
            <select className="form-select" value={form.batch_id} onChange={e => setForm({ ...form, batch_id: e.target.value })}>
              <option value="">Select a batch…</option>
              {batches.map(b => <option key={b.id} value={b.id}>{b.batch_no} · {b.crop_categories?.name} · {b.available_qty_kg} kg</option>)}
            </select></div>
          <div><label className="form-label">Quantity (kg) *</label>
            <input type="number" min="0" step="0.1" className={`form-input ${qtyError ? 'form-input-error' : ''}`} value={form.quantity_kg} onChange={e => setForm({ ...form, quantity_kg: e.target.value })} />
            {qtyError && <p className="form-error">{qtyError}</p>}</div>
          <div><label className="form-label">Reason *</label>
            <select className="form-select" value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })}>
              {WASTE_REASONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
          <div><label className="form-label">Notes</label><textarea className="form-input" rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
          <div className="flex justify-end gap-2"><button className="btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
            <button className="btn-danger" disabled={!canSubmit} onClick={() => record.mutate()}>{record.isPending ? 'Saving…' : 'Record wastage'}</button></div>
        </div>
      </Modal>
    </div>
  );
};
