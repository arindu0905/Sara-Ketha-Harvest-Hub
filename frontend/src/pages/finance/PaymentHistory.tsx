import React, { useMemo, useState } from 'react';
import { DoneBy } from '../../components/ui/DoneBy';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { farmerPaymentsApi } from '../../services/api';
import { DollarSign, Receipt } from 'lucide-react';
import { formatLKR, formatDateSL } from '../../utils/lkrFormat';
import { apiErrorMessage } from '../../utils/apiError';
import { printPayoutReceipt } from './ApprovePayments';

const BADGE: Record<string, string> = { paid: 'badge-success', approved: 'badge-info', calculated: 'badge-warning', pending_calculation: 'badge-neutral', failed: 'badge-danger', disputed: 'badge-danger' };

export const PaymentHistory: React.FC = () => {
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const { data: res, isLoading } = useQuery({ queryKey: ['finance-all-payments-history'], queryFn: () => farmerPaymentsApi.getAll({}) });
  const all: any[] = res?.data?.data || [];

  const payments = useMemo(() => all.filter(p =>
    (!status || p.status === status) &&
    (!search.trim() || `${p.payment_no} ${p.farmers?.full_name} ${p.farmers?.farmer_code}`.toLowerCase().includes(search.trim().toLowerCase()))), [all, status, search]);
  const paidTotal = payments.filter(p => p.status === 'paid').reduce((s, p) => s + Number(p.net_amount_lkr || 0), 0);

  const showReceipt = async (id: string) => {
    try { printPayoutReceipt((await farmerPaymentsApi.getReceipt(id)).data.data); }
    catch (e) { toast.error(apiErrorMessage(e, 'Receipt not available')); }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header"><div><h1 className="page-title">Payment History</h1><p className="page-subtitle">Full record of farmer payments · paid in view: {formatLKR(paidTotal, 0)}</p></div></div>
      <div className="card p-4 flex flex-wrap gap-3">
        <input className="form-input w-64" placeholder="Search payment no or farmer…" value={search} onChange={e => setSearch(e.target.value)} />
        <select className="form-select w-auto" value={status} onChange={e => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {['pending_calculation', 'calculated', 'approved', 'paid', 'failed', 'disputed'].map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
        </select>
      </div>

      {isLoading ? <div className="card p-6 space-y-3">{[1, 2, 3].map(i => <div key={i} className="skeleton h-14 rounded-xl" />)}</div> : payments.length === 0 ? (
        <div className="card"><div className="empty-state"><DollarSign className="w-8 h-8 text-surface-300 mb-2" /><p className="text-surface-400 text-sm">No payments match</p></div></div>
      ) : (
        <div className="card overflow-hidden"><div className="table-container"><table className="table">
          <thead><tr><th>Payment</th><th>Farmer</th><th>Gross</th><th>Deductions</th><th>Net</th><th>Method</th><th>Status</th><th>Done by</th><th>Date</th><th></th></tr></thead>
          <tbody>{payments.map(p => (
            <tr key={p.id}>
              <td className="font-semibold">{p.payment_no}</td>
              <td>{p.farmers?.full_name}</td>
              <td>{formatLKR(p.gross_amount_lkr, 0)}</td>
              <td className="text-red-600">{Number(p.total_deductions_lkr) ? `− ${formatLKR(p.total_deductions_lkr, 0)}` : '—'}</td>
              <td className="font-bold text-primary-700">{formatLKR(p.net_amount_lkr, 0)}</td>
              <td className="capitalize text-xs">{p.payment_method?.replace(/_/g, ' ') || '—'}</td>
              <td><span className={`${BADGE[p.status] || 'badge-neutral'} text-xs`}>{String(p.status).replace(/_/g, ' ')}</span></td>
              <td><DoneBy items={[['Calculated', p.calculator, p.calculated_at], ['Approved', p.approver, p.approved_at], ['Paid', p.payer, p.paid_at]]} /></td>
              <td className="text-xs text-surface-500">{formatDateSL(p.paid_at || p.created_at)}</td>
              <td>{p.status === 'paid' && <button className="btn-ghost btn-sm flex items-center gap-1" onClick={() => showReceipt(p.id)}><Receipt size={14} /> Receipt</button>}</td>
            </tr>))}</tbody>
        </table></div></div>
      )}
    </div>
  );
};
