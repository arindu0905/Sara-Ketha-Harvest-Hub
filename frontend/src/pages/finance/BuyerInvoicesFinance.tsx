import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatLKR } from '../../utils/lkrFormat';
import { printDocument } from '../../utils/printDocument';
import { invoicesApi } from '../../services/api';
import { FileText, DollarSign, CheckCircle, Clock, CreditCard, X, Search, Download, FileSpreadsheet, Receipt } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import toast from 'react-hot-toast';

const balanceOf = (inv: any) => Math.max(0, (parseFloat(inv.total_amount_lkr) || 0) - (parseFloat(inv.amount_paid_lkr) || 0));

export const BuyerInvoicesFinance: React.FC = () => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [recordModalOpen, setRecordModalOpen] = useState(false);
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [receiptsFor, setReceiptsFor] = useState<any>(null);
  const [receiptList, setReceiptList] = useState<any[]>([]);

  // Form states for payment recording
  const [paymentMethod, setPaymentMethod] = useState('bank_transfer');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [referenceNo, setReferenceNo] = useState('');
  const [notes, setNotes] = useState('');

  const { data: invRes, isLoading, refetch } = useQuery({
    queryKey: ['finance-buyer-invoices'],
    queryFn: () => invoicesApi.getAll({}),
  });

  const invoices = invRes?.data?.data || [];

  const filteredInvoices = invoices.filter((inv: any) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      inv.invoice_no?.toLowerCase().includes(term) ||
      inv.purchase_orders?.order_no?.toLowerCase().includes(term) ||
      inv.buyers?.company_name?.toLowerCase().includes(term) ||
      inv.buyers?.contact_person?.toLowerCase().includes(term)
    );
  });

  const recordPaymentMutation = useMutation({
    mutationFn: (data: any) => invoicesApi.recordPayment(selectedInvoice.id, data),
    onSuccess: (r: any) => {
      queryClient.invalidateQueries({ queryKey: ['finance-buyer-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['buyer-invoices'] });
      toast.success(r?.data?.message || 'Payment recorded');
      queryClient.invalidateQueries({ queryKey: ['outstanding-payments'] });
      setRecordModalOpen(false);
      setSelectedInvoice(null);
      refetch();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to record payment');
    },
  });

  const handleOpenRecordModal = (inv: any) => {
    setSelectedInvoice(inv);
    setPaymentAmount(balanceOf(inv).toFixed(2));
    setReferenceNo(`REF-${Date.now().toString().slice(-6)}`);
    setNotes('');
    setRecordModalOpen(true);
  };

  const handleOpenReceiptModal = async (inv: any) => {
    try {
      const res = await invoicesApi.getReceipts();
      setReceiptList((res.data.data || []).filter((r: any) => r.invoice_id === inv.id));
      setReceiptsFor(inv);
    } catch (e: any) { toast.error(e?.response?.data?.message || 'Could not load receipts'); }
  };
  const printReceipt = (inv: any, r: any) => printDocument({
    title: 'Payment Receipt', number: r.receipt_no, subtitle: `Invoice ${inv.invoice_no} · Order ${inv.purchase_orders?.order_no ?? ''}`,
    sections: [
      { heading: 'Received from', rows: [{ label: 'Buyer', value: inv.buyers?.company_name || r.party_name || '' }] },
      { heading: 'Payment', rows: [
        { label: 'Amount received', value: formatLKR(r.amount_lkr) }, { label: 'Balance after payment', value: formatLKR(r.balance_after_lkr) },
        { label: 'Method', value: String(r.payment_method ?? '').replace(/_/g, ' ') }, { label: 'Reference', value: r.reference_no || '—' }, { label: 'Date', value: r.payment_date },
      ] },
    ],
  });

  const handleRecordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(paymentAmount);
    if (!amt || amt <= 0) { toast.error('Please enter a valid payment amount'); return; }
    if (selectedInvoice && amt > balanceOf(selectedInvoice) + 0.001) {
      toast.error(`Amount exceeds the outstanding balance of ${formatLKR(balanceOf(selectedInvoice))}`); return;
    }
    recordPaymentMutation.mutate({
      amount_lkr: parseFloat(paymentAmount),
      payment_method: paymentMethod,
      payment_date: new Date().toISOString().split('T')[0],
      reference_no: referenceNo,
      notes: notes,
    });
  };

  // CSV Export Function
  const exportReceiptCSV = (inv: any) => {
    const headers = ['Receipt No', 'Invoice No', 'Order Ref', 'Buyer Name', 'Amount (LKR)', 'Payment Method', 'Reference No', 'Payment Date', 'Status'];
    const dataRow = [
      `"REC-${inv.invoice_no?.replace(/^INV-/, '') || Date.now()}"`,
      `"${inv.invoice_no || ''}"`,
      `"${inv.purchase_orders?.order_no || 'N/A'}"`,
      `"${inv.buyers?.company_name || inv.buyers?.contact_person || 'Buyer'}"`,
      `"${inv.total_amount_lkr || 0}"`,
      `"${inv.payment_method || 'Bank Transfer'}"`,
      `"${inv.reference_no || 'REF-ONLINE'}"`,
      `"${inv.payment_date || new Date().toISOString().split('T')[0]}"`,
      `"${inv.status || 'paid'}"`
    ];

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), dataRow.join(',')].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Payment_Receipt_${inv.invoice_no || 'INV'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Payment receipt exported to CSV file');
  };

  // PDF / Printable Receipt Export Function
  const exportReceiptPDF = (inv: any) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return toast.error('Please allow popups to export printable PDF receipt');

    const amountLkr = inv.total_amount_lkr ? parseFloat(inv.total_amount_lkr).toLocaleString() : '0';
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Payment Receipt - ${inv.invoice_no}</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; color: #0f172a; background: #f8fafc; }
          .receipt { max-width: 600px; margin: 0 auto; background: #ffffff; border: 2px solid #e2e8f0; border-radius: 16px; padding: 36px; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05); }
          .header { text-align: center; border-bottom: 2px solid #10b981; padding-bottom: 18px; margin-bottom: 24px; }
          .header h1 { font-size: 22px; color: #047857; margin: 0 0 4px 0; text-transform: uppercase; letter-spacing: 1px; }
          .header p { color: #64748b; margin: 0; font-size: 13px; font-weight: 500; }
          .stamp { display: inline-block; background-color: #d1fae5; color: #065f46; border: 1px solid #a7f3d0; padding: 6px 16px; border-radius: 9999px; font-weight: 800; font-size: 12px; letter-spacing: 0.5px; margin-bottom: 20px; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px 24px; margin-bottom: 24px; text-align: left; }
          .field { border-bottom: 1px border #f1f5f9; padding-bottom: 8px; }
          .label { font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700; letter-spacing: 0.5px; margin-bottom: 2px; }
          .value { font-size: 14px; font-weight: 700; color: #1e293b; }
          .amount-box { background: #f0fdf4; border: 2px border #bbf7d0; border-radius: 12px; padding: 20px; text-align: center; margin-top: 16px; margin-bottom: 24px; }
          .amount-label { font-size: 12px; color: #166534; font-weight: 700; text-transform: uppercase; margin-bottom: 4px; }
          .amount-val { font-size: 32px; font-weight: 900; color: #047857; font-family: monospace; }
          .footer { text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 16px; margin-top: 24px; }
          @media print {
            body { padding: 0; background: none; }
            .receipt { border: none; box-shadow: none; padding: 20px; }
          }
        </style>
      </head>
      <body>
        <div class="receipt">
          <div class="header">
            <h1>🌾 Sara Ketha Harvest Hub</h1>
            <p>Agricultural Collection Centre • Official Payment Receipt</p>
          </div>
          <div style="text-align: right;">
            <span class="stamp">✓ OFFICIAL RECEIPT — PAID</span>
          </div>
          <div class="grid">
            <div class="field">
              <div class="label">Invoice Number</div>
              <div class="value">${inv.invoice_no}</div>
            </div>
            <div class="field">
              <div class="label">Order Reference</div>
              <div class="value">${inv.purchase_orders?.order_no || 'N/A'}</div>
            </div>
            <div class="field">
              <div class="label">Buyer Account</div>
              <div class="value">${inv.buyers?.company_name || inv.buyers?.contact_person || 'Buyer'}</div>
            </div>
            <div class="field">
              <div class="label">Payment Date</div>
              <div class="value">${inv.payment_date || new Date().toLocaleDateString('en-LK', { dateStyle: 'medium' })}</div>
            </div>
            <div class="field">
              <div class="label">Payment Method</div>
              <div class="value" style="text-transform: capitalize;">${(inv.payment_method || 'Bank Transfer').replace(/_/g, ' ')}</div>
            </div>
            <div class="field">
              <div class="label">Transaction Reference</div>
              <div class="value">${inv.reference_no || 'REF-' + Date.now().toString().slice(-6)}</div>
            </div>
          </div>
          <div class="amount-box">
            <div class="amount-label">Total Amount Paid</div>
            <div class="amount-val">LKR ${amountLkr}</div>
          </div>
          <div class="footer">
            <p>Verified and processed via HarvestHub Payments Platform. Thank you for your business!</p>
          </div>
        </div>
        <script>
          window.onload = function() { window.print(); };
        </script>
      </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
    toast.success('Generating PDF payment receipt...');
  };

  // Aggregated Summary
  const totalInvoiced = invoices.reduce((sum: number, inv: any) => sum + (parseFloat(inv.total_amount_lkr) || 0), 0);
  const totalPaid = invoices.reduce((sum: number, inv: any) => sum + (parseFloat(inv.amount_paid_lkr) || 0), 0);
  const totalPending = invoices.filter((inv: any) => inv.status !== 'cancelled').reduce((sum: number, inv: any) => sum + balanceOf(inv), 0);

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <FileText className="text-primary-600 w-6 h-6" /> Buyer Invoices & Payments
          </h1>
          <p className="page-subtitle">Record buyer payments, view official receipts, and export payment records as PDF or CSV</p>
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-primary-100 text-primary-600 flex items-center justify-center font-bold">
            <DollarSign size={24} />
          </div>
          <div>
            <p className="text-xs font-semibold text-surface-500 uppercase tracking-wider">Total Invoiced</p>
            <p className="text-xl font-extrabold text-surface-900 font-display">LKR {totalInvoiced.toLocaleString()}</p>
          </div>
        </div>

        <div className="card p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold">
            <CheckCircle size={24} />
          </div>
          <div>
            <p className="text-xs font-semibold text-surface-500 uppercase tracking-wider">Payments Collected</p>
            <p className="text-xl font-extrabold text-emerald-700 font-display">LKR {totalPaid.toLocaleString()}</p>
          </div>
        </div>

        <div className="card p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center font-bold">
            <Clock size={24} />
          </div>
          <div>
            <p className="text-xs font-semibold text-surface-500 uppercase tracking-wider">Outstanding Receivables</p>
            <p className="text-xl font-extrabold text-amber-700 font-display">LKR {totalPending.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="card p-4 flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="relative w-full sm:w-80">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
          <input
            type="text"
            placeholder="Search by invoice no, order, or buyer..."
            className="form-input text-xs pl-9 py-2 w-full"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="text-xs text-surface-500 font-medium">
          Showing <span className="font-bold text-surface-800">{filteredInvoices.length}</span> invoice(s)
        </div>
      </div>

      {/* Invoices Table */}
      {isLoading ? (
        <div className="card p-6 space-y-3">
          {[1, 2, 3, 4].map(i => <div key={i} className="skeleton h-16 rounded-xl" />)}
        </div>
      ) : filteredInvoices.length === 0 ? (
        <div className="card py-12 text-center">
          <div className="empty-state max-w-sm mx-auto">
            <FileText className="w-12 h-12 text-surface-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-surface-800 mb-1">No Invoices Found</h3>
            <p className="text-surface-500 text-xs">There are no billing invoices matching your search criteria.</p>
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
                  <th>Buyer Account</th>
                  <th>Total</th>
                  <th>Paid</th>
                  <th>Balance</th>
                  <th>Due Date</th>
                  <th>Status</th>
                  <th className="text-right">Action / Receipt</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.map((inv: any) => {
                  const isPaid = inv.status === 'paid';

                  return (
                    <tr key={inv.id} className="hover:bg-surface-50/80 transition-colors">
                      <td className="font-mono font-bold text-surface-900 text-sm">{inv.invoice_no}</td>
                      <td className="text-xs font-medium text-surface-700">
                        {inv.purchase_orders?.order_no || '—'}
                      </td>
                      <td>
                        <div className="font-semibold text-surface-900 text-sm">
                          {inv.buyers?.company_name || inv.buyers?.contact_person || 'Buyer'}
                        </div>
                        {inv.buyers?.buyer_code && (
                          <div className="text-2xs text-surface-400">Code: {inv.buyers.buyer_code}</div>
                        )}
                      </td>
                      <td className="font-bold text-primary-700 font-display text-sm">
                        LKR {inv.total_amount_lkr ? parseFloat(inv.total_amount_lkr).toLocaleString() : '0'}
                      </td>
                      <td className="text-emerald-700 text-sm">{formatLKR(parseFloat(inv.amount_paid_lkr) || 0, 0)}</td>
                      <td className={`font-semibold text-sm ${balanceOf(inv) > 0 ? 'text-amber-700' : 'text-surface-400'}`}>{formatLKR(balanceOf(inv), 0)}</td>
                      <td className="text-xs text-surface-600">
                        {inv.due_date ? new Date(inv.due_date).toLocaleDateString('en-LK', { dateStyle: 'medium' }) : '—'}
                      </td>
                      <td>
                        <span className={`badge text-xs px-2.5 py-1 ${isPaid ? 'badge-success' : inv.status === 'overdue' ? 'badge-danger' : inv.status === 'partially_paid' ? 'badge-info' : inv.status === 'cancelled' ? 'badge-neutral' : 'badge-warning'}`}>
                          {String(inv.status || 'issued').replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {(parseFloat(inv.amount_paid_lkr) || 0) > 0 && (
                            <button onClick={() => handleOpenReceiptModal(inv)}
                              className="btn-secondary btn-sm inline-flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100" title="View & print receipts">
                              <Receipt size={13} /> Receipts
                            </button>
                          )}
                          {!isPaid && inv.status !== 'cancelled' && (
                            <button onClick={() => handleOpenRecordModal(inv)} className="btn-primary btn-sm inline-flex items-center gap-1.5 shadow-sm">
                              <CreditCard size={14} /> Record Payment
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── Record Payment Modal ───────────────────────────────────────────── */}
      {recordModalOpen && selectedInvoice && (
        <div className="fixed inset-0 bg-surface-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-scale-up">
            <div className="p-5 border-b border-surface-100 flex justify-between items-center bg-surface-50">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-primary-100 text-primary-700 flex items-center justify-center font-bold">
                  <CreditCard size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-surface-900 text-base">Record Buyer Payment</h3>
                  <p className="text-2xs text-surface-500">Invoice #{selectedInvoice.invoice_no}</p>
                </div>
              </div>
              <button
                onClick={() => setRecordModalOpen(false)}
                className="text-surface-400 hover:text-surface-600 p-1 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleRecordSubmit} className="p-6 space-y-4">
              <div className="bg-surface-50 p-3.5 rounded-xl text-xs space-y-1">
                <div className="flex justify-between text-surface-600">
                  <span>Buyer:</span>
                  <span className="font-bold text-surface-800">
                    {selectedInvoice.buyers?.company_name || selectedInvoice.buyers?.contact_person || 'Buyer'}
                  </span>
                </div>
                <div className="flex justify-between text-surface-600">
                  <span>Invoice Amount:</span>
                  <span className="font-bold text-primary-700 font-display">
                    LKR {parseFloat(selectedInvoice.total_amount_lkr).toLocaleString()}
                  </span>
                </div>
              </div>

              <div>
                <label className="form-label text-xs font-semibold text-surface-700">Payment Amount (LKR)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  className="form-input text-sm py-2 font-mono font-bold"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                />
              </div>

              <div>
                <label className="form-label text-xs font-semibold text-surface-700">Payment Method</label>
                <select
                  className="form-select text-xs py-2"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                >
                  <option value="bank_transfer">Bank Transfer / EFT</option>
                  <option value="cash">Cash Payment</option>
                  <option value="cheque">Cheque Deposit</option>
                  <option value="card">Credit / Debit Card</option>
                </select>
              </div>

              <div>
                <label className="form-label text-xs font-semibold text-surface-700">Reference / Transaction No</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. REF-BANK-98123"
                  className="form-input text-xs py-2 font-mono"
                  value={referenceNo}
                  onChange={(e) => setReferenceNo(e.target.value)}
                />
              </div>

              <div>
                <label className="form-label text-xs font-semibold text-surface-700">Notes / Remarks (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="Additional payment details..."
                  className="form-input text-xs py-2"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setRecordModalOpen(false)}
                  className="btn-secondary btn-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={recordPaymentMutation.isPending}
                  className="btn-primary btn-sm flex items-center gap-1.5 shadow-md"
                >
                  <CheckCircle size={15} />
                  {recordPaymentMutation.isPending ? 'Saving...' : 'Confirm & Save Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {receiptsFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setReceiptsFor(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-5" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-surface-900 mb-1">Receipts · {receiptsFor.invoice_no}</h3>
            <p className="text-xs text-surface-500 mb-3">Paid {formatLKR(parseFloat(receiptsFor.amount_paid_lkr) || 0)} of {formatLKR(parseFloat(receiptsFor.total_amount_lkr) || 0)}</p>
            {receiptList.length === 0 ? <p className="text-sm text-surface-400 py-4 text-center">No receipts found</p> : (
              <div className="divide-y divide-surface-100">{receiptList.map(r => (
                <div key={r.id} className="flex items-center justify-between py-2">
                  <div><p className="text-sm font-mono font-semibold">{r.receipt_no}</p>
                    <p className="text-xs text-surface-500">{r.payment_date} · {String(r.payment_method ?? '').replace(/_/g, ' ')} · balance {formatLKR(r.balance_after_lkr, 0)}</p></div>
                  <div className="flex items-center gap-2"><span className="font-bold text-emerald-700">{formatLKR(r.amount_lkr)}</span>
                    <button className="btn-secondary btn-sm" onClick={() => printReceipt(receiptsFor, r)}>Print</button></div>
                </div>))}</div>
            )}
            <div className="flex justify-end mt-4"><button className="btn-secondary btn-sm" onClick={() => setReceiptsFor(null)}>Close</button></div>
          </div>
        </div>
      )}

      {/* ─── View Payment Receipt Modal ─────────────────────────────────────── */}
      <Modal
        isOpen={receiptModalOpen && !!selectedInvoice}
        onClose={() => setReceiptModalOpen(false)}
        title="Official Payment Receipt"
        subtitle={selectedInvoice ? `Invoice #${selectedInvoice.invoice_no}` : ''}
        maxWidth="max-w-xl"
      >
        {selectedInvoice && (
          <div className="space-y-5">
            {/* Receipt Preview Box */}
            <div className="bg-gradient-to-b from-white to-emerald-50/30 border-2 border-emerald-200 rounded-2xl p-6 space-y-4 shadow-sm relative">
              <div className="flex justify-between items-start border-b border-emerald-100 pb-3">
                <div>
                  <h3 className="font-extrabold text-lg text-emerald-900 uppercase tracking-wide">Sara Ketha Harvest Hub</h3>
                  <p className="text-2xs text-surface-500">Official Buyer Payment Receipt & Voucher</p>
                </div>
                <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full font-extrabold text-2xs uppercase border border-emerald-300">
                  ✓ Verified Paid
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-surface-500 text-2xs block uppercase font-semibold">Invoice Number</span>
                  <span className="font-mono font-bold text-surface-900">{selectedInvoice.invoice_no}</span>
                </div>
                <div>
                  <span className="text-surface-500 text-2xs block uppercase font-semibold">Order Reference</span>
                  <span className="font-mono font-bold text-surface-900">{selectedInvoice.purchase_orders?.order_no || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-surface-500 text-2xs block uppercase font-semibold">Buyer Company</span>
                  <span className="font-bold text-surface-900">{selectedInvoice.buyers?.company_name || selectedInvoice.buyers?.contact_person || 'Buyer'}</span>
                </div>
                <div>
                  <span className="text-surface-500 text-2xs block uppercase font-semibold">Payment Date</span>
                  <span className="font-medium text-surface-800">{selectedInvoice.payment_date || new Date().toLocaleDateString('en-LK')}</span>
                </div>
                <div>
                  <span className="text-surface-500 text-2xs block uppercase font-semibold">Payment Method</span>
                  <span className="font-medium text-surface-800 capitalize">{(selectedInvoice.payment_method || 'Bank Transfer').replace(/_/g, ' ')}</span>
                </div>
                <div>
                  <span className="text-surface-500 text-2xs block uppercase font-semibold">Transaction Ref</span>
                  <span className="font-mono text-surface-800">{selectedInvoice.reference_no || 'REF-ONLINE'}</span>
                </div>
              </div>

              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
                <span className="text-2xs text-emerald-800 uppercase font-bold block">Total Amount Settled</span>
                <span className="text-2xl font-black text-emerald-700 font-mono">
                  LKR {parseFloat(selectedInvoice.total_amount_lkr || 0).toLocaleString()}
                </span>
              </div>
            </div>

            {/* Export Buttons */}
            <div className="flex flex-col sm:flex-row justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => exportReceiptCSV(selectedInvoice)}
                className="btn-secondary flex items-center justify-center gap-1.5 text-xs"
              >
                <FileSpreadsheet size={15} /> Export as CSV
              </button>
              <button
                type="button"
                onClick={() => exportReceiptPDF(selectedInvoice)}
                className="btn-primary flex items-center justify-center gap-1.5 text-xs shadow-md"
              >
                <Download size={15} /> Export / Print PDF Receipt
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
