import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { invoicesApi } from '../../services/api';
import { FileText, CreditCard, CheckCircle, Clock, X, DollarSign, Eye } from 'lucide-react';
import toast from 'react-hot-toast';

export const BuyerInvoices: React.FC = () => {
  const queryClient = useQueryClient();
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);

  // Form states for online payment
  const [paymentMethod, setPaymentMethod] = useState('bank_transfer');
  const [referenceNo, setReferenceNo] = useState('');
  const [notes, setNotes] = useState('');

  const { data: invRes, isLoading, refetch } = useQuery({
    queryKey: ['buyer-invoices'],
    queryFn: () => invoicesApi.getAll({}),
  });

  const invoices = invRes?.data?.data || [];

  const payInvoiceMutation = useMutation({
    mutationFn: (data: any) => invoicesApi.recordPayment(selectedInvoice.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['buyer-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['buyer-orders'] });
      toast.success('Payment submitted successfully! Your invoice is now marked as paid.');
      setPayModalOpen(false);
      setSelectedInvoice(null);
      refetch();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to submit payment');
    },
  });

  const handleOpenPayModal = (inv: any) => {
    setSelectedInvoice(inv);
    setReferenceNo(`PAY-${Date.now().toString().slice(-6)}`);
    setNotes('');
    setPayModalOpen(true);
  };

  const handlePaySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    payInvoiceMutation.mutate({
      amount_lkr: parseFloat(selectedInvoice.total_amount_lkr),
      payment_method: paymentMethod,
      payment_date: new Date().toISOString().split('T')[0],
      reference_no: referenceNo,
      notes: notes || 'Paid online via buyer portal',
    });
  };

  const statusBadge = (s: string) => {
    switch (s) {
      case 'paid':
        return <span className="badge-success text-xs font-semibold px-2.5 py-1">Paid</span>;
      case 'issued':
        return <span className="badge-info text-xs font-semibold px-2.5 py-1">Issued</span>;
      case 'overdue':
        return <span className="badge-danger text-xs font-semibold px-2.5 py-1">Overdue</span>;
      default:
        return <span className="badge-neutral text-xs font-semibold px-2.5 py-1">{s}</span>;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <FileText className="text-primary-600 w-6 h-6" /> My Invoices
          </h1>
          <p className="page-subtitle">View and manage your purchase invoices, due dates, and online payments</p>
        </div>
      </div>

      {/* Invoices List / Table */}
      {isLoading ? (
        <div className="card p-6 space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-16 rounded-xl" />
          ))}
        </div>
      ) : invoices.length === 0 ? (
        <div className="card py-12 text-center">
          <div className="empty-state max-w-sm mx-auto">
            <FileText className="w-12 h-12 text-surface-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-surface-800 mb-1">No Invoices Yet</h3>
            <p className="text-surface-500 text-xs">
              Invoices for your approved purchase orders will appear here once issued by the finance team.
            </p>
          </div>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Invoice No</th>
                  <th>Order Reference</th>
                  <th>Total Amount</th>
                  <th>Due Date</th>
                  <th>Status</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv: any) => {
                  const isPaid = inv.status === 'paid';

                  return (
                    <tr key={inv.id} className="hover:bg-surface-50/80 transition-colors">
                      <td className="font-mono font-bold text-surface-900 text-sm">{inv.invoice_no}</td>
                      <td className="text-xs font-medium text-surface-700">
                        {inv.purchase_orders?.order_no || '—'}
                      </td>
                      <td className="font-bold text-primary-700 font-display text-sm">
                        LKR {inv.total_amount_lkr ? parseFloat(inv.total_amount_lkr).toLocaleString() : '0'}
                      </td>
                      <td className="text-xs text-surface-600">
                        {inv.due_date ? new Date(inv.due_date).toLocaleDateString('en-LK', { dateStyle: 'medium' }) : '—'}
                      </td>
                      <td>{statusBadge(inv.status)}</td>
                      <td className="text-right">
                        {isPaid ? (
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-700 font-semibold px-2.5 py-1 bg-emerald-50 rounded-lg">
                            <CheckCircle size={14} /> Paid
                          </span>
                        ) : (
                          <button
                            onClick={() => handleOpenPayModal(inv)}
                            className="btn-primary btn-sm inline-flex items-center gap-1.5 shadow-sm"
                          >
                            <CreditCard size={14} /> Pay Now
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pay Now Modal */}
      {payModalOpen && selectedInvoice && (
        <div className="fixed inset-0 bg-surface-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-scale-up">
            <div className="p-5 border-b border-surface-100 flex justify-between items-center bg-surface-50">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-primary-100 text-primary-700 flex items-center justify-center font-bold">
                  <CreditCard size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-surface-900 text-base">Pay Invoice</h3>
                  <p className="text-2xs text-surface-500">Invoice #{selectedInvoice.invoice_no}</p>
                </div>
              </div>
              <button
                onClick={() => setPayModalOpen(false)}
                className="text-surface-400 hover:text-surface-600 p-1 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handlePaySubmit} className="p-6 space-y-4">
              <div className="bg-primary-50/70 p-4 rounded-2xl space-y-1.5 border border-primary-100">
                <div className="flex justify-between text-xs text-surface-600">
                  <span>Order Reference:</span>
                  <span className="font-bold text-surface-800">{selectedInvoice.purchase_orders?.order_no || '—'}</span>
                </div>
                <div className="flex justify-between items-baseline pt-1 border-t border-primary-100">
                  <span className="text-xs font-bold text-surface-700">Amount Due:</span>
                  <span className="text-xl font-extrabold text-primary-700 font-display">
                    LKR {parseFloat(selectedInvoice.total_amount_lkr).toLocaleString()}
                  </span>
                </div>
              </div>

              <div>
                <label className="form-label text-xs font-semibold text-surface-700">Payment Option</label>
                <select
                  className="form-select text-xs py-2"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                >
                  <option value="bank_transfer">Direct Bank Transfer / Online EFT</option>
                  <option value="card">Credit / Debit Card</option>
                  <option value="cheque">Cheque Deposit</option>
                  <option value="cash">Cash Payment at Hub</option>
                </select>
              </div>

              <div>
                <label className="form-label text-xs font-semibold text-surface-700">Payment Reference / Transfer ID</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. TRX-991823"
                  className="form-input text-xs py-2 font-mono"
                  value={referenceNo}
                  onChange={(e) => setReferenceNo(e.target.value)}
                />
              </div>

              <div>
                <label className="form-label text-xs font-semibold text-surface-700">Payment Notes (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="Add any transfer notes..."
                  className="form-input text-xs py-2"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setPayModalOpen(false)}
                  className="btn-secondary btn-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={payInvoiceMutation.isPending}
                  className="btn-primary btn-sm flex items-center gap-1.5 shadow-md"
                >
                  <CheckCircle size={15} />
                  {payInvoiceMutation.isPending ? 'Processing...' : 'Submit Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
