import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { farmerPaymentsApi, invoicesApi } from '../../services/api';
import { StatCard } from '../../components/ui/StatCard';
import { DollarSign, FileText, CheckCircle, Clock, ChevronRight } from 'lucide-react';

export const FinanceDashboard: React.FC = () => {
  const { data: paymentsRes, isLoading: lp } = useQuery({
    queryKey: ['finance-payments-dash'],
    queryFn: () => farmerPaymentsApi.getAll({}),
  });

  const { data: invoicesRes, isLoading: li } = useQuery({
    queryKey: ['finance-invoices-dash'],
    queryFn: () => invoicesApi.getAll({}),
  });

  const payments = paymentsRes?.data?.data || [];
  const invoices = invoicesRes?.data?.data || [];

  const pendingPayments = payments.filter((p: any) => p.status === 'calculated' || p.status === 'pending_approval');
  const approvedPayments = payments.filter((p: any) => p.status === 'approved');
  const totalDisbursed = payments.filter((p: any) => p.status === 'paid').reduce((s: number, p: any) => s + (p.net_amount_lkr || 0), 0);
  const totalInvoiced = invoices.reduce((s: number, i: any) => s + (i.total_amount_lkr || 0), 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Finance Dashboard</h1>
          <p className="page-subtitle">Financial operations & disbursement management</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Disbursed" value={`LKR ${totalDisbursed.toLocaleString()}`} icon={<DollarSign size={22} />} iconBg="bg-primary-100" iconColor="text-primary-600" loading={lp} />
        <StatCard title="Pending Approvals" value={approvedPayments.length} icon={<Clock size={22} />} iconBg="bg-yellow-100" iconColor="text-yellow-600" />
        <StatCard title="Total Invoiced" value={`LKR ${totalInvoiced.toLocaleString()}`} icon={<FileText size={22} />} iconBg="bg-blue-100" iconColor="text-blue-600" loading={li} />
        <StatCard title="Total Payments" value={payments.length} icon={<CheckCircle size={22} />} iconBg="bg-earth-100" iconColor="text-earth-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="card-header">
            <h2 className="text-sm font-semibold">Recent Farmer Payments</h2>
            <Link to="/finance/history" className="text-xs text-primary-600 flex items-center gap-1">View all <ChevronRight size={14} /></Link>
          </div>
          {payments.length === 0 ? (
            <div className="empty-state py-8"><p className="text-surface-400 text-sm">No payment records</p></div>
          ) : (
            <div className="divide-y divide-surface-50">
              {payments.slice(0, 5).map((p: any) => (
                <div key={p.id} className="flex items-center justify-between p-4 hover:bg-surface-50 transition-colors">
                  <div>
                    <p className="text-sm font-semibold text-surface-800">{p.payment_no}</p>
                    <p className="text-xs text-surface-500">{p.farmers?.full_name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-primary-700">LKR {p.net_amount_lkr?.toLocaleString()}</p>
                    <span className={`badge text-xs ${p.status === 'paid' ? 'badge-success' : 'badge-warning'}`}>{p.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card p-5">
          <h2 className="text-sm font-semibold text-surface-800 mb-3">Finance Tools</h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Pending Collections', icon: '⏳', path: '/finance/pending' },
              { label: 'Approve Payments', icon: '✅', path: '/finance/approve' },
              { label: 'Buyer Invoices', icon: '📑', path: '/finance/invoices' },
              { label: 'Financial Reports', icon: '📊', path: '/finance/reports' },
            ].map(a => (
              <Link key={a.path} to={a.path} className="flex flex-col items-center gap-2 p-4 bg-surface-50 rounded-xl hover:bg-primary-50 hover:text-primary-700 transition-colors text-center">
                <span className="text-2xl">{a.icon}</span>
                <span className="text-xs font-medium text-surface-700">{a.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
