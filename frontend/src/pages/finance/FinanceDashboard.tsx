import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { farmerPaymentsApi, invoicesApi } from '../../services/api';
import { StatCard } from '../../components/ui/StatCard';
import { DollarSign, FileText, Clock, ChevronRight, ArrowDownCircle, AlertTriangle } from 'lucide-react';
import { formatLKR } from '../../utils/lkrFormat';

export const FinanceDashboard: React.FC = () => {
  const { data: paymentsRes, isLoading: lp } = useQuery({ queryKey: ['finance-payments-dash'], queryFn: () => farmerPaymentsApi.getAll({}) });
  const { data: outRes, isLoading: lo } = useQuery({ queryKey: ['outstanding-payments'], queryFn: () => invoicesApi.getOutstanding() });

  const payments: any[] = paymentsRes?.data?.data || [];
  const totals = outRes?.data?.data?.totals || {};
  const toApprove = payments.filter(p => p.status === 'calculated').length;
  const toPay = payments.filter(p => p.status === 'approved').length;
  const disbursed = payments.filter(p => p.status === 'paid').reduce((s, p) => s + Number(p.net_amount_lkr || 0), 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header"><div><h1 className="page-title">Finance Dashboard</h1><p className="page-subtitle">Disbursements, receivables and approvals</p></div></div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Disbursed to farmers" value={formatLKR(disbursed, 0)} icon={<DollarSign size={22} />} loading={lp} />
        <StatCard title="Awaiting approval / payout" value={`${toApprove} / ${toPay}`} icon={<Clock size={22} />} iconBg="bg-yellow-100" iconColor="text-yellow-600" loading={lp} />
        <StatCard title="Receivable from buyers" value={formatLKR(totals.receivable_lkr ?? 0, 0)} icon={<ArrowDownCircle size={22} />} iconBg="bg-blue-100" iconColor="text-blue-600" loading={lo} />
        <StatCard title="Overdue items" value={totals.overdue_count ?? 0} icon={<AlertTriangle size={22} />} iconBg="bg-red-100" iconColor="text-red-600" loading={lo} />
      </div>

      {(toApprove > 0 || toPay > 0) && (
        <div className="alert alert-info"><Clock size={16} className="flex-shrink-0" />
          <p className="text-sm">{toApprove} calculation(s) need approval and {toPay} approved payment(s) are ready to disburse. <Link to="/finance/approve" className="underline">Open approvals →</Link></p></div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="card-header"><h2 className="text-sm font-semibold">Recent farmer payments</h2>
            <Link to="/finance/history" className="text-xs text-primary-600 flex items-center gap-1">View all <ChevronRight size={14} /></Link></div>
          {payments.length === 0 ? <div className="empty-state py-8"><p className="text-surface-400 text-sm">No payment records</p></div> : (
            <div className="divide-y divide-surface-50">{payments.slice(0, 6).map(p => (
              <div key={p.id} className="flex items-center justify-between p-4">
                <div><p className="text-sm font-semibold text-surface-800">{p.payment_no}</p><p className="text-xs text-surface-500">{p.farmers?.full_name}</p></div>
                <div className="text-right"><p className="text-sm font-bold text-primary-700">{formatLKR(p.net_amount_lkr, 0)}</p>
                  <span className={`badge text-xs ${p.status === 'paid' ? 'badge-success' : 'badge-warning'}`}>{String(p.status).replace(/_/g, ' ')}</span></div>
              </div>))}</div>
          )}
        </div>
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-surface-800 mb-3">Finance tools</h2>
          <div className="grid grid-cols-2 gap-3">
            {[['Calculate payments', '/finance/pending'], ['Approve & disburse', '/finance/approve'], ['Buyer invoices', '/finance/invoices'], ['Outstanding payments', '/finance/outstanding'], ['Financial reports', '/finance/reports'], ['Management reports', '/finance/management-reports']].map(([l, p]) => (
              <Link key={p} to={p} className="p-4 bg-surface-50 rounded-xl hover:bg-primary-50 hover:text-primary-700 transition-colors text-center text-xs font-medium text-surface-700 flex items-center justify-center gap-1"><FileText size={14} />{l}</Link>))}
          </div>
        </div>
      </div>
    </div>
  );
};
