import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { invoicesApi } from '../../services/api';
import { StatCard } from '../../components/ui/StatCard';
import { ArrowDownCircle, ArrowUpCircle, AlertTriangle } from 'lucide-react';
import { formatLKR, formatDateSL } from '../../utils/lkrFormat';
import { useAuth } from '../../contexts/AuthContext';

/** E4-US5 – outstanding receivables (buyers) and payables (farmers), oldest/most overdue first. */
export const OutstandingPayments: React.FC = () => {
  const { user } = useAuth();
  const [kind, setKind] = useState<'all' | 'buyer_invoice' | 'farmer_payout'>('all');
  const { data: res, isLoading } = useQuery({ queryKey: ['outstanding-payments'], queryFn: () => invoicesApi.getOutstanding() });
  const items: any[] = res?.data?.data?.items || [];
  const totals = res?.data?.data?.totals || {};
  const rows = items.filter(i => kind === 'all' || i.kind === kind);
  const invoicePath = user?.role === 'manager' ? '#' : '/finance/invoices';

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header"><div><h1 className="page-title">Outstanding Payments</h1><p className="page-subtitle">Money owed to the hub and money owed to farmers</p></div></div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="Receivable from buyers" value={formatLKR(totals.receivable_lkr ?? 0, 0)} icon={<ArrowDownCircle size={22} />} iconBg="bg-green-100" iconColor="text-green-600" loading={isLoading} />
        <StatCard title="Payable to farmers" value={formatLKR(totals.payable_lkr ?? 0, 0)} icon={<ArrowUpCircle size={22} />} iconBg="bg-orange-100" iconColor="text-orange-600" loading={isLoading} />
        <StatCard title="Overdue items" value={totals.overdue_count ?? 0} icon={<AlertTriangle size={22} />} iconBg="bg-red-100" iconColor="text-red-600" loading={isLoading} />
      </div>
      <div className="flex gap-2">
        {([['all', 'All'], ['buyer_invoice', 'Buyer invoices'], ['farmer_payout', 'Farmer payouts']] as const).map(([v, l]) => (
          <button key={v} className={kind === v ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'} onClick={() => setKind(v)}>{l}</button>))}
      </div>
      {isLoading ? <div className="card p-6"><div className="skeleton h-40 rounded-xl" /></div> : rows.length === 0 ? (
        <div className="card"><div className="empty-state"><p className="text-surface-400 text-sm">Nothing outstanding</p></div></div>
      ) : (
        <div className="card overflow-hidden"><div className="table-container"><table className="table">
          <thead><tr><th>Type</th><th>Reference</th><th>Party</th><th>Status</th><th>Outstanding</th><th>Due</th><th>Overdue</th></tr></thead>
          <tbody>{rows.map((r, i) => (
            <tr key={`${r.kind}-${r.id ?? i}`} className={Number(r.days_overdue) > 0 ? 'bg-red-50/50' : ''}>
              <td><span className={r.kind === 'buyer_invoice' ? 'badge-success' : 'badge-warning'}>{r.kind === 'buyer_invoice' ? 'Receivable' : 'Payable'}</span></td>
              <td className="font-mono text-xs font-semibold">{r.kind === 'buyer_invoice' ? <Link to={invoicePath} className="hover:underline">{r.reference}</Link> : r.reference}</td>
              <td>{r.party}</td>
              <td className="capitalize text-xs">{String(r.status).replace(/_/g, ' ')}</td>
              <td className="font-bold">{formatLKR(r.outstanding_lkr, 0)}</td>
              <td className="text-xs">{r.due_date ? formatDateSL(r.due_date) : '—'}</td>
              <td>{Number(r.days_overdue) > 0 ? <span className="badge-danger">{r.days_overdue}d</span> : <span className="text-surface-400">—</span>}</td>
            </tr>))}</tbody>
        </table></div></div>
      )}
    </div>
  );
};
