import React, { useState } from 'react';
import { DoneBy } from '../../components/ui/DoneBy';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { farmerPaymentsApi } from '../../services/api';
import { Modal } from '../../components/ui/Modal';
import { CheckCircle, DollarSign, XCircle, Banknote } from 'lucide-react';
import { formatLKR } from '../../utils/lkrFormat';
import { apiErrorMessage } from '../../utils/apiError';
import { printDocument } from '../../utils/printDocument';

type Tab = 'calculated' | 'approved';
const METHODS = [['bank_transfer', 'Bank transfer'], ['cash', 'Cash'], ['cheque', 'Cheque'], ['mobile_payment', 'Mobile payment']];

export const ApprovePayments: React.FC = () => {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('calculated');
  const [rejecting, setRejecting] = useState<any>(null);
  const [reason, setReason] = useState('');
  const [paying, setPaying] = useState<any>(null);
  const [pay, setPay] = useState({ payment_method: 'bank_transfer', payment_date: new Date().toISOString().slice(0, 10), reference_no: '' });

  const { data: calcRes, isLoading: l1 } = useQuery({ queryKey: ['finance-payments', 'calculated'], queryFn: () => farmerPaymentsApi.getAll({ status: 'calculated' }) });
  const { data: apprRes, isLoading: l2 } = useQuery({ queryKey: ['finance-payments', 'approved'], queryFn: () => farmerPaymentsApi.getAll({ status: 'approved' }) });
  const toApprove: any[] = calcRes?.data?.data || [];
  const toPay: any[] = apprRes?.data?.data || [];
  const rows = tab === 'calculated' ? toApprove : toPay;
  const isLoading = tab === 'calculated' ? l1 : l2;

  const refresh = () => ['finance-payments', 'finance-pending-collections', 'finance-all-payments-history', 'collections', 'outstanding-payments']
    .forEach(k => qc.invalidateQueries({ queryKey: [k] }));

  const approve = useMutation({
    mutationFn: (id: string) => farmerPaymentsApi.approve(id),
    onSuccess: () => { toast.success('Payment approved – it is now ready to disburse'); refresh(); },
    onError: (e) => toast.error(apiErrorMessage(e, 'Failed to approve payment')),
  });
  const reject = useMutation({
    mutationFn: () => farmerPaymentsApi.reject(rejecting.id, reason.trim()),
    onSuccess: () => { toast.success('Payment sent back for recalculation'); setRejecting(null); setReason(''); refresh(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
  const markPaid = useMutation({
    mutationFn: () => farmerPaymentsApi.markPaid(paying.id, { ...pay, reference_no: pay.reference_no || undefined }),
    onSuccess: async () => {
      toast.success('Payment disbursed and receipt issued');
      const p = paying; setPaying(null); refresh();
      try {
        const r = (await farmerPaymentsApi.getReceipt(p.id)).data.data;
        if (window.confirm('Print the payout receipt now?')) printPayoutReceipt(r);
      } catch { /* receipt viewable later from history */ }
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div><h1 className="page-title">Approve & Disburse Payments</h1>
          <p className="page-subtitle">Approve calculated payments, then record the payout. Rejected payments go back for recalculation.</p></div>
      </div>

      <div className="flex gap-2">
        <button className={tab === 'calculated' ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'} onClick={() => setTab('calculated')}>To approve ({toApprove.length})</button>
        <button className={tab === 'approved' ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'} onClick={() => setTab('approved')}>Ready to pay ({toPay.length})</button>
      </div>

      {isLoading ? <div className="card p-6 space-y-3">{[1, 2, 3].map(i => <div key={i} className="skeleton h-14 rounded-xl" />)}</div> : rows.length === 0 ? (
        <div className="card"><div className="empty-state"><DollarSign className="w-8 h-8 text-surface-300 mb-2" /><p className="text-surface-400 text-sm">{tab === 'calculated' ? 'No calculated payments awaiting approval' : 'No approved payments awaiting payout'}</p></div></div>
      ) : (
        <div className="card overflow-hidden"><div className="table-container"><table className="table">
          <thead><tr><th>Payment</th><th>Farmer</th><th>Bank / account</th><th>Gross</th><th>Deductions</th><th>Net</th><th>Done by</th><th>Actions</th></tr></thead>
          <tbody>{rows.map(p => (
            <tr key={p.id}>
              <td className="font-semibold">{p.payment_no}<br /><span className="text-xs text-surface-400 capitalize">{p.grade?.replace('_', ' ')} · {p.accepted_qty_kg} kg × {formatLKR(p.price_per_kg_lkr)}</span></td>
              <td>{p.farmers?.full_name}<br /><span className="text-xs text-surface-400">{p.farmers?.farmer_code}</span></td>
              <td className="text-xs">{p.farmers?.bank_name || 'Cash'}<br />{p.farmers?.account_holder_name}</td>
              <td>{formatLKR(p.gross_amount_lkr)}</td>
              <td className="text-red-600">{Number(p.total_deductions_lkr) ? `− ${formatLKR(p.total_deductions_lkr)}` : '—'}</td>
              <td className="font-bold text-primary-700">{formatLKR(p.net_amount_lkr)}</td>
              <td><DoneBy items={[['Calculated', p.calculator, p.calculated_at], ['Approved', p.approver, p.approved_at]]} /></td>
              <td><div className="flex gap-2">
                {tab === 'calculated' ? (<>
                  <button onClick={() => approve.mutate(p.id)} disabled={approve.isPending} className="btn-primary btn-sm flex items-center gap-1"><CheckCircle size={14} /> Approve</button>
                  <button onClick={() => setRejecting(p)} className="btn-secondary btn-sm flex items-center gap-1 text-red-600"><XCircle size={14} /> Reject</button>
                </>) : (
                  <button onClick={() => setPaying(p)} className="btn-primary btn-sm flex items-center gap-1"><Banknote size={14} /> Mark paid</button>
                )}
              </div></td>
            </tr>))}</tbody>
        </table></div></div>
      )}

      <Modal isOpen={!!rejecting} onClose={() => setRejecting(null)} title="Reject payment calculation" subtitle={rejecting?.payment_no}>
        <div className="space-y-4">
          <div><label className="form-label">Reason *</label>
            <textarea className="form-input" rows={3} value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Wrong grade price applied" />
            {reason.length > 0 && reason.trim().length < 5 && <p className="form-error">Please give at least 5 characters</p>}</div>
          <div className="flex justify-end gap-2"><button className="btn-secondary" onClick={() => setRejecting(null)}>Cancel</button>
            <button className="btn-danger" disabled={reason.trim().length < 5 || reject.isPending} onClick={() => reject.mutate()}>Reject payment</button></div>
        </div>
      </Modal>

      <Modal isOpen={!!paying} onClose={() => setPaying(null)} title="Record payout" subtitle={paying ? `${paying.payment_no} · ${formatLKR(paying.net_amount_lkr)} to ${paying.farmers?.full_name}` : ''}>
        <div className="space-y-4">
          <div><label className="form-label">Method</label>
            <select className="form-select" value={pay.payment_method} onChange={e => setPay({ ...pay, payment_method: e.target.value })}>
              {METHODS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
          <div><label className="form-label">Payment date</label>
            <input type="date" className="form-input" value={pay.payment_date} max={new Date().toISOString().slice(0, 10)} onChange={e => setPay({ ...pay, payment_date: e.target.value })} /></div>
          <div><label className="form-label">Reference no. (transfer / cheque)</label>
            <input className="form-input" value={pay.reference_no} onChange={e => setPay({ ...pay, reference_no: e.target.value })} /></div>
          <div className="flex justify-end gap-2"><button className="btn-secondary" onClick={() => setPaying(null)}>Cancel</button>
            <button className="btn-primary" disabled={markPaid.isPending || !pay.payment_date} onClick={() => markPaid.mutate()}>{markPaid.isPending ? 'Saving…' : 'Confirm payout'}</button></div>
        </div>
      </Modal>
    </div>
  );
};

/** Printable payout receipt (shared with PaymentHistory & the farmer's payments page). */
export function printPayoutReceipt(r: any) {
  const p = r.farmer_payments || {};
  const f = p.farmers || {};
  printDocument({
    title: 'Payment Receipt', number: r.receipt_no,
    subtitle: `Issued ${new Date(r.issued_at).toLocaleString('en-LK')}`,
    sections: [
      { heading: 'Paid to', rows: [{ label: 'Farmer', value: `${f.full_name ?? r.party_name} (${f.farmer_code ?? ''})` }, ...(f.bank_name ? [{ label: 'Bank', value: `${f.bank_name} ${f.account_number_masked ?? ''}` }] : [])] },
      { heading: 'Payment', rows: [
        { label: 'Payment no.', value: p.payment_no ?? '' },
        { label: 'Collection', value: p.produce_collections?.collection_no ?? '' },
        { label: 'Quantity × price', value: `${p.accepted_qty_kg ?? ''} kg × ${formatLKR(p.price_per_kg_lkr)}` },
        { label: 'Gross', value: formatLKR(p.gross_amount_lkr) },
        { label: 'Deductions', value: formatLKR(p.total_deductions_lkr) },
        { label: 'Net paid', value: formatLKR(r.amount_lkr) },
        { label: 'Method', value: String(r.payment_method ?? '').replace(/_/g, ' ') },
        { label: 'Reference', value: r.reference_no ?? '—' },
        { label: 'Payment date', value: r.payment_date },
      ] },
    ],
    table: p.farmer_payment_deductions?.length ? { headers: ['Deduction', 'Amount'], rows: p.farmer_payment_deductions.map((d: any) => [d.description, formatLKR(d.amount_lkr)]) } : undefined,
  });
}
