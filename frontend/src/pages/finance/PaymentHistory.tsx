import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { farmerPaymentsApi } from '../../services/api';
import { DollarSign } from 'lucide-react';

export const PaymentHistory: React.FC = () => {
  const { data: paymentsRes, isLoading } = useQuery({
    queryKey: ['finance-all-payments-history'],
    queryFn: () => farmerPaymentsApi.getAll({}),
  });

  const payments = paymentsRes?.data?.data || [];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Payment History</h1>
          <p className="page-subtitle">Full record of all farmer payments</p>
        </div>
      </div>

      {isLoading ? (
        <div className="card p-6 space-y-3">{[1, 2, 3].map(i => <div key={i} className="skeleton h-14 rounded-xl" />)}</div>
      ) : payments.length === 0 ? (
        <div className="card"><div className="empty-state"><DollarSign className="w-8 h-8 text-surface-300 mb-2" /><p className="text-surface-400 text-sm">No payment history found</p></div></div>
      ) : (
        <div className="card overflow-hidden">
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Payment No</th>
                  <th>Farmer</th>
                  <th>Gross (LKR)</th>
                  <th>Deductions (LKR)</th>
                  <th>Net (LKR)</th>
                  <th>Method</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p: any) => (
                  <tr key={p.id}>
                    <td className="font-semibold">{p.payment_no}</td>
                    <td>{p.farmers?.full_name}</td>
                    <td>{p.gross_amount_lkr?.toLocaleString()}</td>
                    <td className="text-red-600">{p.total_deductions_lkr ? `- ${p.total_deductions_lkr.toLocaleString()}` : '—'}</td>
                    <td className="font-bold text-primary-700">{p.net_amount_lkr?.toLocaleString()}</td>
                    <td className="capitalize text-xs">{p.payment_method?.replace(/_/g, ' ') || '—'}</td>
                    <td>
                      <span className={`badge text-xs ${p.status === 'paid' ? 'badge-success' : p.status === 'approved' ? 'badge-info' : 'badge-warning'}`}>
                        {p.status}
                      </span>
                    </td>
                    <td className="text-xs text-surface-500">{new Date(p.created_at).toLocaleDateString('en-LK')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
