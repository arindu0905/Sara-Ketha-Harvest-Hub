import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { invoicesApi } from '../../services/api';
import { FileText } from 'lucide-react';

export const BuyerInvoices: React.FC = () => {
  const { data: invRes, isLoading } = useQuery({ queryKey: ['buyer-invoices'], queryFn: () => invoicesApi.getAll({}) });
  const invoices = invRes?.data?.data || [];

  const statusBadge = (s: string) => {
    const m: Record<string, string> = { draft: 'badge-neutral', issued: 'badge-info', paid: 'badge-success', overdue: 'badge-danger', cancelled: 'badge-danger' };
    return <span className={m[s] || 'badge-neutral'}>{s}</span>;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header"><div><h1 className="page-title">My Invoices</h1><p className="page-subtitle">View and manage your invoices</p></div></div>
      {isLoading ? <div className="card p-6 space-y-3">{[1,2,3].map(i => <div key={i} className="skeleton h-14 rounded-xl" />)}</div>
      : invoices.length === 0 ? <div className="card"><div className="empty-state"><FileText className="w-8 h-8 text-surface-300 mb-2" /><p className="text-surface-400 text-sm">No invoices yet</p></div></div>
      : (
        <div className="card overflow-hidden"><div className="table-container"><table className="table">
          <thead><tr><th>Invoice No</th><th>Order</th><th>Amount</th><th>Due Date</th><th>Status</th></tr></thead>
          <tbody>{invoices.map((inv: any) => (
            <tr key={inv.id}><td className="font-semibold">{inv.invoice_no}</td><td className="text-sm">{inv.purchase_orders?.order_no || '—'}</td>
            <td className="font-bold text-primary-700">LKR {inv.total_amount_lkr?.toLocaleString()}</td>
            <td className="text-sm">{inv.due_date ? new Date(inv.due_date).toLocaleDateString('en-LK') : '—'}</td>
            <td>{statusBadge(inv.status)}</td></tr>
          ))}</tbody>
        </table></div></div>
      )}
    </div>
  );
};
