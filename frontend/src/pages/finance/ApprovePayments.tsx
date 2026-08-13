import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { farmerPaymentsApi } from '../../services/api';
import { CheckCircle, DollarSign } from 'lucide-react';
import toast from 'react-hot-toast';

export const ApprovePayments: React.FC = () => {
  const queryClient = useQueryClient();

  const { data: paymentsRes, isLoading } = useQuery({
    queryKey: ['finance-calculated-payments'],
    queryFn: () => farmerPaymentsApi.getAll({ status: 'calculated' }),
  });

  const payments = paymentsRes?.data?.data || [];

  const approveMutation = useMutation({
    mutationFn: (id: string) => farmerPaymentsApi.approve(id),
    onSuccess: () => {
      toast.success('Payment approved!');
      queryClient.invalidateQueries({ queryKey: ['finance-calculated-payments'] });
    },
    onError: () => toast.error('Failed to approve payment'),
  });

  const paidMutation = useMutation({
    mutationFn: ({ id, method }: { id: string; method: string }) => farmerPaymentsApi.markPaid(id, { payment_method: method, payment_date: new Date().toISOString() }),
    onSuccess: () => {
      toast.success('Payment marked as paid!');
      queryClient.invalidateQueries({ queryKey: ['finance-calculated-payments'] });
    },
    onError: () => toast.error('Failed to mark paid'),
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Approve & Disburse Payments</h1>
          <p className="page-subtitle">{payments.length} payments pending approval/disbursement</p>
        </div>
      </div>

      {isLoading ? (
        <div className="card p-6 space-y-3">{[1, 2, 3].map(i => <div key={i} className="skeleton h-14 rounded-xl" />)}</div>
      ) : payments.length === 0 ? (
        <div className="card"><div className="empty-state"><DollarSign className="w-8 h-8 text-surface-300 mb-2" /><p className="text-surface-400 text-sm">No calculated payments awaiting action</p></div></div>
      ) : (
        <div className="card overflow-hidden">
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Payment No</th>
                  <th>Farmer</th>
                  <th>Bank / Account</th>
                  <th>Net Amount</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p: any) => (
                  <tr key={p.id}>
                    <td className="font-semibold">{p.payment_no}</td>
                    <td>{p.farmers?.full_name}<br /><span className="text-xs text-surface-400">{p.farmers?.farmer_code}</span></td>
                    <td className="text-xs">{p.farmers?.bank_name || 'Cash'}<br />{p.farmers?.account_holder_name}</td>
                    <td className="font-bold text-primary-700">LKR {p.net_amount_lkr?.toLocaleString()}</td>
                    <td><span className="badge-warning text-xs">{p.status}</span></td>
                    <td>
                      <div className="flex gap-2">
                        {p.status === 'calculated' && (
                          <button onClick={() => approveMutation.mutate(p.id)} disabled={approveMutation.isPending} className="btn-secondary btn-sm">
                            Approve
                          </button>
                        )}
                        <button onClick={() => paidMutation.mutate({ id: p.id, method: 'bank_transfer' })} disabled={paidMutation.isPending} className="btn-primary btn-sm">
                          <CheckCircle size={14} /> Mark Paid
                        </button>
                      </div>
                    </td>
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
