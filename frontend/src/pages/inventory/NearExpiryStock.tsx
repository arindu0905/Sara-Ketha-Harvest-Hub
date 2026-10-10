import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { inventoryApi } from '../../services/api';
import { StatCard } from '../../components/ui/StatCard';
import { Modal } from '../../components/ui/Modal';
import { AlertTriangle, ChevronRight, Banknote, Skull, RefreshCw, CalendarClock, Tag, Trash2, Plus } from 'lucide-react';
import { formatLKR, formatDateSL } from '../../utils/lkrFormat';
import { apiErrorMessage } from '../../utils/apiError';
import { WASTE_REASONS } from './WastageRecords';

const RISK: Record<string, { badge: string; row: string; label: string }> = {
  expired: { badge: 'badge-danger', row: 'bg-red-50', label: 'Expired' },
  critical: { badge: 'badge-danger', row: 'bg-red-50/60', label: 'Critical' },
  high: { badge: 'badge-warning', row: 'bg-yellow-50', label: 'High' },
  medium: { badge: 'badge-info', row: '', label: 'Medium' },
};

type Action = { kind: 'expiry' | 'clearance' | 'writeoff'; batch: any | null };

const todayStr = () => new Date().toLocaleDateString('en-CA');

export const NearExpiryStock: React.FC = () => {
  const qc = useQueryClient();
  const [action, setAction] = useState<Action | null>(null);
  const [pickBatchId, setPickBatchId] = useState('');
  const [date, setDate] = useState('');
  const [reason, setReason] = useState('');
  const [discount, setDiscount] = useState('20');
  const [qty, setQty] = useState('');
  const [wasteReason, setWasteReason] = useState('expiry');

  const { data: res, isLoading } = useQuery({ queryKey: ['inventory-expiry'], queryFn: () => inventoryApi.getExpiry() });
  const items: any[] = res?.data?.data?.items || [];
  const summary = res?.data?.data?.summary;

  // the separate near-expiry register (table near_expiry_stock) – includes resolved history
  const [regStatus, setRegStatus] = useState('');
  const { data: regRes, isLoading: regLoading, error: regError } = useQuery({
    queryKey: ['inventory-expiry-records', regStatus],
    queryFn: () => inventoryApi.getExpiryRecords(regStatus ? { status: regStatus } : undefined),
    retry: false,
  });
  const records: any[] = regRes?.data?.data || [];

  // every batch with stock, so any batch can be flagged as near-expiry
  const { data: allRes } = useQuery({
    queryKey: ['inventory-list', 'flaggable'],
    queryFn: () => inventoryApi.getAll({ status: 'available', limit: '200' }),
    enabled: action?.kind === 'expiry' && !action.batch,
  });
  const allBatches: any[] = allRes?.data?.data || [];

  const refresh = () => ['inventory-expiry', 'inventory-expiry-records', 'inventory-summary', 'inventory-list', 'inventory-wastage'].forEach(k => qc.invalidateQueries({ queryKey: [k] }));
  const close = () => { setAction(null); setPickBatchId(''); setDate(''); setReason(''); setQty(''); setDiscount('20'); setWasteReason('expiry'); };

  const sweep = useMutation({
    mutationFn: () => inventoryApi.runExpirySweep(),
    onSuccess: (r) => {
      const d = r.data?.data || {};
      toast.success(`Sweep done: ${d.expired_batches ?? 0} batch(es) written off (${Math.round(d.expired_kg ?? 0)} kg), ${d.released_reservations ?? 0} reservation(s) released`);
      refresh();
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const expiryMutation = useMutation({
    mutationFn: (v: { id: string; date: string; reason: string }) => inventoryApi.updateExpiry(v.id, { expected_expiry_date: v.date, reason: v.reason || undefined }),
    onSuccess: (r) => { toast.success(r.data?.message || 'Expiry date updated'); refresh(); close(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
  const clearanceMutation = useMutation({
    mutationFn: (v: { id: string; pct: number }) => inventoryApi.applyClearance(v.id, v.pct),
    onSuccess: (r) => { toast.success(r.data?.message || 'Clearance price applied'); refresh(); close(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
  const writeOffMutation = useMutation({
    mutationFn: (v: { id: string; qty: number; reason: string; notes: string }) => inventoryApi.recordWastage(v.id, { quantity_kg: v.qty, reason: v.reason, notes: v.notes || undefined }),
    onSuccess: () => { toast.success('Wastage recorded'); refresh(); close(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const open = (kind: Action['kind'], batch: any | null) => {
    setAction({ kind, batch });
    if (batch) {
      setDate(batch.expected_expiry_date ? String(batch.expected_expiry_date).slice(0, 10) : '');
      setQty(String(batch.available_qty_kg ?? ''));
    }
  };

  const batch = action?.batch ?? allBatches.find(b => b.id === pickBatchId) ?? null;
  const hasExpired = (summary?.expired_batches ?? 0) > 0;

  const submitExpiry = () => {
    if (!batch) return toast.error('Select a batch');
    if (!date) return toast.error('Choose the new expiry date');
    expiryMutation.mutate({ id: batch.id, date, reason });
  };
  const submitClearance = () => {
    const pct = Number(discount);
    if (!batch || !Number.isFinite(pct) || pct < 1 || pct > 90) return toast.error('Discount must be between 1 % and 90 %');
    clearanceMutation.mutate({ id: batch.id, pct });
  };
  const submitWriteOff = () => {
    const q = Number(qty);
    if (!batch || !Number.isFinite(q) || q <= 0) return toast.error('Enter a quantity greater than zero');
    if (q > Number(batch.available_qty_kg)) return toast.error(`Only ${batch.available_qty_kg} kg is available in this batch`);
    writeOffMutation.mutate({ id: batch.id, qty: q, reason: wasteReason, notes: reason });
  };

  const newPrice = batch && Number.isFinite(Number(discount)) ? Math.round(Number(batch.selling_price_lkr) * (1 - Number(discount) / 100) * 100) / 100 : null;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Near-Expiry Stock</h1>
          <p className="page-subtitle">Batches expiring within {summary?.threshold_days ?? 7} days, ranked by urgency</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-secondary flex items-center gap-2" onClick={() => open('expiry', null)}>
            <Plus size={16} /> Flag a batch as near-expiry
          </button>
          <button className="btn-danger" disabled={sweep.isPending || !hasExpired}
            title={hasExpired ? 'Write off all expired stock and release stale reservations' : 'No expired stock to write off'}
            onClick={() => { if (window.confirm('Write off all expired batches as wastage? This cannot be undone.')) sweep.mutate(); }}>
            <RefreshCw size={16} className={sweep.isPending ? 'animate-spin' : ''} /> Write off expired stock
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Batches at risk" value={summary?.near_expiry_batches ?? 0} icon={<AlertTriangle size={22} />} iconBg="bg-yellow-100" iconColor="text-yellow-600" loading={isLoading} />
        <StatCard title="Already expired" value={summary?.expired_batches ?? 0} icon={<Skull size={22} />} iconBg="bg-red-100" iconColor="text-red-600" loading={isLoading} />
        <StatCard title="Critical (≤ 2 days)" value={summary?.critical_batches ?? 0} icon={<AlertTriangle size={22} />} iconBg="bg-orange-100" iconColor="text-orange-600" loading={isLoading} />
        <StatCard title="Value at risk" value={formatLKR(summary?.total_value_at_risk_lkr ?? 0, 0)} subtitle={`${Math.round(summary?.total_kg_at_risk ?? 0)} kg`} icon={<Banknote size={22} />} iconBg="bg-primary-100" iconColor="text-primary-600" loading={isLoading} />
      </div>

      {isLoading ? <div className="card p-6 space-y-3">{[1, 2, 3].map(i => <div key={i} className="skeleton h-14 rounded-xl" />)}</div> : items.length === 0 ? (
        <div className="card"><div className="empty-state"><AlertTriangle className="w-8 h-8 text-surface-300 mb-2" /><p className="text-surface-400 text-sm">No near-expiry stock — looking good!</p>
          <p className="text-surface-400 text-xs mt-1">Found produce that will not keep? Use “Flag a batch as near-expiry”.</p></div></div>
      ) : (
        <div className="card overflow-hidden"><div className="table-container"><table className="table">
          <thead><tr><th>Batch</th><th>Crop</th><th>Grade</th><th>Warehouse</th><th>Available</th><th>Value at risk</th><th>Expiry</th><th>Risk</th><th>Manage</th></tr></thead>
          <tbody>{items.map(b => {
            const r = RISK[b.risk] || RISK.medium;
            return (
              <tr key={b.id} className={r.row}>
                <td className="font-semibold font-mono text-xs">{b.batch_no}</td>
                <td>{b.crop_categories?.name}</td>
                <td className="capitalize">{b.grade?.replace(/_/g, ' ')}</td>
                <td>{b.warehouses?.name ?? '–'}</td>
                <td className="font-bold">{Number(b.available_qty_kg).toLocaleString()} kg</td>
                <td>{formatLKR(b.value_at_risk_lkr, 0)}</td>
                <td>{formatDateSL(b.expected_expiry_date)}</td>
                <td><span className={`${r.badge} text-xs`}>{b.days_left < 0 ? `${Math.abs(b.days_left)}d overdue` : b.days_left === 0 ? 'Today' : `${b.days_left}d left`}</span></td>
                <td>
                  <div className="flex items-center gap-1">
                    <button className="btn-ghost p-1.5 rounded-lg text-blue-600" title="Change expiry date" onClick={() => open('expiry', b)}><CalendarClock size={15} /></button>
                    {b.risk !== 'expired' && <button className="btn-ghost p-1.5 rounded-lg text-amber-600" title="Clearance price" onClick={() => open('clearance', b)}><Tag size={15} /></button>}
                    <button className="btn-ghost p-1.5 rounded-lg text-red-600" title="Write off / record wastage" onClick={() => open('writeoff', b)}><Trash2 size={15} /></button>
                    <Link to={`/inventory/stock/${b.id}`} className="btn-ghost p-1.5 rounded-lg" title="Open batch"><ChevronRight size={16} /></Link>
                  </div>
                </td>
              </tr>
            );
          })}</tbody>
        </table></div></div>
      )}

      {/* Near-expiry register: separate table with history */}
      <div className="card overflow-hidden">
        <div className="p-4 flex flex-wrap items-center justify-between gap-3 border-b border-surface-100">
          <div>
            <h2 className="text-base font-bold text-surface-900">Near-expiry register</h2>
            <p className="text-xs text-surface-500">Every batch that has been close to expiry, with how it ended (sold, extended, written off)</p>
          </div>
          <select className="form-select w-auto" value={regStatus} onChange={e => setRegStatus(e.target.value)}>
            <option value="">All</option>
            <option value="at_risk">At risk</option>
            <option value="expired">Expired</option>
            <option value="resolved">Resolved</option>
          </select>
        </div>
        {regLoading ? <div className="p-6"><div className="skeleton h-14 rounded-xl" /></div> : regError ? (
          <p className="p-6 text-sm text-amber-700">{apiErrorMessage(regError)}</p>
        ) : records.length === 0 ? (
          <p className="p-6 text-sm text-surface-400">No records yet.</p>
        ) : (
          <div className="table-container"><table className="table">
            <thead><tr><th>Batch</th><th>Crop</th><th>Farmer</th><th>Warehouse</th><th>Available</th><th>Value at risk</th><th>Expiry</th><th>Status</th><th>First flagged</th><th>How it ended</th></tr></thead>
            <tbody>{records.map(r => (
              <tr key={r.id} className={r.status === 'resolved' ? 'opacity-70' : ''}>
                <td className="font-mono text-xs font-semibold">{r.batch_no}</td>
                <td>{r.crop_categories?.name ?? '–'}</td>
                <td>{r.farmers?.full_name ?? '–'}</td>
                <td>{r.warehouses?.name ?? '–'}</td>
                <td>{Number(r.available_qty_kg).toLocaleString()} kg</td>
                <td>{formatLKR(r.value_at_risk_lkr, 0)}</td>
                <td>{formatDateSL(r.expiry_date)}</td>
                <td><span className={r.status === 'resolved' ? 'badge-success' : r.status === 'expired' ? 'badge-danger' : 'badge-warning'}>{r.status === 'at_risk' ? 'At risk' : r.status === 'expired' ? 'Expired' : 'Resolved'}</span></td>
                <td className="text-xs">{formatDateSL(r.first_flagged_at)}</td>
                <td className="text-xs">{r.resolution_note ?? '–'}</td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </div>

      {/* Change expiry / flag a batch */}
      <Modal isOpen={action?.kind === 'expiry'} onClose={close} title={action?.batch ? `Expiry date – ${action.batch.batch_no}` : 'Flag a batch as near-expiry'}
        subtitle="Set a shorter shelf life when produce will not keep, or correct a wrong date">
        <div className="space-y-4">
          {!action?.batch && (
            <div>
              <label className="form-label">Batch *</label>
              <select className="form-select" value={pickBatchId} onChange={e => { setPickBatchId(e.target.value); const b = allBatches.find(x => x.id === e.target.value); setDate(b?.expected_expiry_date ? String(b.expected_expiry_date).slice(0, 10) : ''); }}>
                <option value="">Select a batch…</option>
                {allBatches.map(b => <option key={b.id} value={b.id}>{b.batch_no} – {b.crop_categories?.name} ({b.available_qty_kg} kg)</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="form-label">New expiry date *</label>
            <input type="date" className="form-input" value={date} min={batch?.received_date ? String(batch.received_date).slice(0, 10) : undefined} onChange={e => setDate(e.target.value)} />
            {date && date < todayStr() && <p className="text-xs text-amber-600 mt-1">This date has passed – the batch will count as expired and can be written off.</p>}
          </div>
          <div>
            <label className="form-label">Reason</label>
            <textarea className="form-input" rows={2} value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Ripening faster than expected" />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-surface-100">
            <button className="btn-secondary" onClick={close}>Cancel</button>
            <button className="btn-primary" disabled={expiryMutation.isPending} onClick={submitExpiry}>{expiryMutation.isPending ? 'Saving…' : 'Save expiry date'}</button>
          </div>
        </div>
      </Modal>

      {/* Clearance price */}
      <Modal isOpen={action?.kind === 'clearance'} onClose={close} title={`Clearance price – ${action?.batch?.batch_no ?? ''}`} subtitle="Lower the selling price so the batch sells before it spoils">
        <div className="space-y-4">
          <div>
            <label className="form-label">Discount (%) *</label>
            <input type="number" min="1" max="90" step="1" className="form-input" value={discount} onChange={e => setDiscount(e.target.value)} />
          </div>
          {batch && newPrice !== null && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm">
              Selling price per kg: <b>LKR {Number(batch.selling_price_lkr).toLocaleString()}</b> → <b className="text-amber-700">LKR {newPrice.toLocaleString()}</b>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2 border-t border-surface-100">
            <button className="btn-secondary" onClick={close}>Cancel</button>
            <button className="btn-primary" disabled={clearanceMutation.isPending} onClick={submitClearance}>{clearanceMutation.isPending ? 'Applying…' : 'Apply clearance price'}</button>
          </div>
        </div>
      </Modal>

      {/* Write off */}
      <Modal isOpen={action?.kind === 'writeoff'} onClose={close} title={`Write off – ${action?.batch?.batch_no ?? ''}`} subtitle={`Available: ${action?.batch?.available_qty_kg ?? 0} kg`}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Quantity (kg) *</label>
              <input type="number" min="0.1" step="0.1" max={action?.batch?.available_qty_kg} className="form-input" value={qty} onChange={e => setQty(e.target.value)} />
            </div>
            <div>
              <label className="form-label">Reason *</label>
              <select className="form-select" value={wasteReason} onChange={e => setWasteReason(e.target.value)}>
                {WASTE_REASONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="form-label">Notes</label>
            <textarea className="form-input" rows={2} value={reason} onChange={e => setReason(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-surface-100">
            <button className="btn-secondary" onClick={close}>Cancel</button>
            <button className="btn-danger" disabled={writeOffMutation.isPending} onClick={submitWriteOff}>{writeOffMutation.isPending ? 'Recording…' : 'Record wastage'}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
