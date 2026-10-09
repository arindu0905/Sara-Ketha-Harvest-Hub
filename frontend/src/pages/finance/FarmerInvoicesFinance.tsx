import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { farmerPaymentsApi } from '../../services/api';
import { FileText, DollarSign, CheckCircle, Clock, Search, Download, FileSpreadsheet, Receipt, UserCheck } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import toast from 'react-hot-toast';

export const FarmerInvoicesFinance: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<any>(null);

  const { data: payRes, isLoading } = useQuery({
    queryKey: ['finance-farmer-invoices'],
    queryFn: () => farmerPaymentsApi.getInvoices({}),
  });

  const payments = payRes?.data?.data || [];

  const filteredPayments = payments.filter((p: any) => {
    const matchesSearch =
      !searchTerm.trim() ||
      p.payment_no?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.farmers?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.produce_collections?.collection_no?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const handleOpenReceiptModal = (p: any) => {
    setSelectedPayment(p);
    setReceiptModalOpen(true);
  };

  // CSV Export for Farmer Payment Receipt
  const exportReceiptCSV = (p: any) => {
    const headers = ['Voucher No', 'Collection No', 'Farmer Name', 'Bank Name', 'Gross Amount (LKR)', 'Deductions (LKR)', 'Net Amount (LKR)', 'Status', 'Date'];
    const dataRow = [
      `"${p.payment_no || ''}"`,
      `"${p.produce_collections?.collection_no || 'N/A'}"`,
      `"${p.farmers?.full_name || 'Farmer'}"`,
      `"${p.farmers?.bank_name || 'Cash'}"`,
      `"${p.gross_amount_lkr || 0}"`,
      `"${p.total_deductions_lkr || 0}"`,
      `"${p.net_amount_lkr || 0}"`,
      `"${p.status || 'calculated'}"`,
      `"${p.created_at ? new Date(p.created_at).toLocaleDateString('en-LK') : ''}"`
    ];

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), dataRow.join(',')].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Farmer_Payment_Receipt_${p.payment_no || 'PAY'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Farmer payment receipt exported as CSV file');
  };

  // PDF / Printable Receipt Export for Farmer Payment
  const exportReceiptPDF = (p: any) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return toast.error('Please allow popups to export printable PDF receipt');

    const grossLkr = p.gross_amount_lkr ? parseFloat(p.gross_amount_lkr).toLocaleString() : '0';
    const deductionsLkr = p.total_deductions_lkr ? parseFloat(p.total_deductions_lkr).toLocaleString() : '0';
    const netLkr = p.net_amount_lkr ? parseFloat(p.net_amount_lkr).toLocaleString() : '0';

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Farmer Payment Receipt - ${p.payment_no}</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; color: #0f172a; background: #f8fafc; }
          .receipt { max-width: 620px; margin: 0 auto; background: #ffffff; border: 2px solid #059669; border-radius: 16px; padding: 36px; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05); }
          .header { text-align: center; border-bottom: 2px solid #10b981; padding-bottom: 18px; margin-bottom: 24px; }
          .header h1 { font-size: 22px; color: #047857; margin: 0 0 4px 0; text-transform: uppercase; letter-spacing: 1px; }
          .header p { color: #64748b; margin: 0; font-size: 13px; font-weight: 500; }
          .stamp { display: inline-block; background-color: #d1fae5; color: #065f46; border: 1px solid #a7f3d0; padding: 6px 16px; border-radius: 9999px; font-weight: 800; font-size: 12px; letter-spacing: 0.5px; margin-bottom: 20px; text-transform: uppercase; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px 24px; margin-bottom: 24px; text-align: left; }
          .field { border-bottom: 1px border #f1f5f9; padding-bottom: 8px; }
          .label { font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700; letter-spacing: 0.5px; margin-bottom: 2px; }
          .value { font-size: 14px; font-weight: 700; color: #1e293b; }
          .breakdown-table { width: 100%; border-collapse: collapse; margin-top: 16px; margin-bottom: 24px; font-size: 13px; }
          .breakdown-table th { background: #f1f5f9; padding: 10px; text-align: left; font-size: 11px; text-transform: uppercase; color: #475569; }
          .breakdown-table td { padding: 10px; border-bottom: 1px solid #e2e8f0; }
          .amount-box { background: #ecfdf5; border: 2px border #a7f3d0; border-radius: 12px; padding: 20px; text-align: center; margin-top: 16px; margin-bottom: 24px; }
          .amount-label { font-size: 12px; color: #065f46; font-weight: 700; text-transform: uppercase; margin-bottom: 4px; }
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
            <p>Farmer Produce Payment Voucher & Official Receipt</p>
          </div>
          <div style="text-align: right;">
            <span class="stamp">✓ STATUS: ${p.status || 'CALCULATED'}</span>
          </div>
          <div class="grid">
            <div class="field">
              <div class="label">Voucher Number</div>
              <div class="value">${p.payment_no}</div>
            </div>
            <div class="field">
              <div class="label">Collection Reference</div>
              <div class="value">${p.produce_collections?.collection_no || 'N/A'}</div>
            </div>
            <div class="field">
              <div class="label">Farmer Name</div>
              <div class="value">${p.farmers?.full_name || 'Farmer'}</div>
            </div>
            <div class="field">
              <div class="label">Bank Account / Disburse</div>
              <div class="value">${p.farmers?.bank_name ? `${p.farmers.bank_name} (${p.farmers.account_number || 'Acc'})` : 'Cash Settlement'}</div>
            </div>
            <div class="field">
              <div class="label">Accepted Net Weight</div>
              <div class="value">${p.accepted_qty_kg || '0'} kg</div>
            </div>
            <div class="field">
              <div class="label">Quality Grade</div>
              <div class="value" style="text-transform: capitalize;">${(p.grade || 'grade_a').replace(/_/g, ' ')}</div>
            </div>
          </div>

          <table class="breakdown-table">
            <thead>
              <tr>
                <th>Description</th>
                <th style="text-align: right;">Amount (LKR)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Gross Produce Amount (${p.accepted_qty_kg || 0} kg @ LKR ${p.price_per_kg_lkr || 0}/kg)</td>
                <td style="text-align: right; font-weight: bold;">LKR ${grossLkr}</td>
              </tr>
              <tr>
                <td style="color: #dc2626;">Itemized Deductions (Transport / Packaging / Charges)</td>
                <td style="text-align: right; font-weight: bold; color: #dc2626;">- LKR ${deductionsLkr}</td>
              </tr>
            </tbody>
          </table>

          <div class="amount-box">
            <div class="amount-label">Net Farmer Disbursement</div>
            <div class="amount-val">LKR ${netLkr}</div>
          </div>
          <div class="footer">
            <p>Authorized and issued by Finance Department, Sara Ketha Harvest Hub.</p>
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
    toast.success('Generating PDF farmer payment receipt...');
  };

  // Aggregated Summary
  const totalGross = payments.reduce((sum: number, p: any) => sum + (parseFloat(p.gross_amount_lkr) || 0), 0);
  const totalNet = payments.reduce((sum: number, p: any) => sum + (parseFloat(p.net_amount_lkr) || 0), 0);
  const totalDeductions = payments.reduce((sum: number, p: any) => sum + (parseFloat(p.total_deductions_lkr) || 0), 0);

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <FileText className="text-primary-600 w-6 h-6" /> Farmer Invoices & Payment Receipts
          </h1>
          <p className="page-subtitle">Review farmer payment vouchers, inspect breakdown receipts, and export PDF or CSV statements</p>
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-primary-100 text-primary-600 flex items-center justify-center font-bold">
            <DollarSign size={24} />
          </div>
          <div>
            <p className="text-xs font-semibold text-surface-500 uppercase tracking-wider">Gross Produce Value</p>
            <p className="text-xl font-extrabold text-surface-900 font-display">LKR {totalGross.toLocaleString()}</p>
          </div>
        </div>

        <div className="card p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold">
            <CheckCircle size={24} />
          </div>
          <div>
            <p className="text-xs font-semibold text-surface-500 uppercase tracking-wider">Net Disbursed to Farmers</p>
            <p className="text-xl font-extrabold text-emerald-700 font-display">LKR {totalNet.toLocaleString()}</p>
          </div>
        </div>

        <div className="card p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center font-bold">
            <Clock size={24} />
          </div>
          <div>
            <p className="text-xs font-semibold text-surface-500 uppercase tracking-wider">Total Deductions Withheld</p>
            <p className="text-xl font-extrabold text-red-600 font-display">LKR {totalDeductions.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="card p-4 flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-80">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
            <input
              type="text"
              placeholder="Search by voucher no, collection, or farmer..."
              className="form-input text-xs pl-9 py-2 w-full"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="form-select text-xs py-2 w-full sm:w-40"
          >
            <option value="all">All Statuses</option>
            <option value="calculated">Calculated</option>
            <option value="approved">Approved</option>
            <option value="paid">Paid / Settled</option>
          </select>
        </div>
        <div className="text-xs text-surface-500 font-medium">
          Showing <span className="font-bold text-surface-800">{filteredPayments.length}</span> voucher(s)
        </div>
      </div>

      {/* Invoices Table */}
      {isLoading ? (
        <div className="card p-6 space-y-3">
          {[1, 2, 3, 4].map(i => <div key={i} className="skeleton h-16 rounded-xl" />)}
        </div>
      ) : filteredPayments.length === 0 ? (
        <div className="card py-12 text-center">
          <div className="empty-state max-w-sm mx-auto">
            <FileText className="w-12 h-12 text-surface-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-surface-800 mb-1">No Farmer Invoices Found</h3>
            <p className="text-surface-500 text-xs">No farmer payment vouchers match your search criteria.</p>
          </div>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Voucher No</th>
                  <th>Collection No</th>
                  <th>Farmer Name</th>
                  <th>Gross Amount</th>
                  <th>Deductions</th>
                  <th>Net Amount</th>
                  <th>Status</th>
                  <th className="text-right">Action / Receipt</th>
                </tr>
              </thead>
              <tbody>
                {filteredPayments.map((p: any) => {
                  const isPaid = p.status === 'paid';

                  return (
                    <tr key={p.id} className="hover:bg-surface-50/80 transition-colors">
                      <td className="font-mono font-bold text-surface-900 text-sm">{p.payment_no}</td>
                      <td className="text-xs font-medium text-surface-700">
                        {p.produce_collections?.collection_no || '—'}
                      </td>
                      <td>
                        <div className="font-semibold text-surface-900 text-sm">
                          {p.farmers?.full_name || 'Farmer'}
                        </div>
                        {p.farmers?.bank_name && (
                          <div className="text-2xs text-surface-400">{p.farmers.bank_name}</div>
                        )}
                      </td>
                      <td className="font-semibold text-surface-800 text-xs font-mono">
                        LKR {p.gross_amount_lkr ? parseFloat(p.gross_amount_lkr).toLocaleString() : '0'}
                      </td>
                      <td className="text-xs font-bold text-red-600 font-mono">
                        {p.total_deductions_lkr ? `- LKR ${parseFloat(p.total_deductions_lkr).toLocaleString()}` : '—'}
                      </td>
                      <td className="font-bold text-emerald-700 font-display text-sm">
                        LKR {p.net_amount_lkr ? parseFloat(p.net_amount_lkr).toLocaleString() : '0'}
                      </td>
                      <td>
                        <span className={`badge text-xs px-2.5 py-1 ${isPaid ? 'badge-success' : p.status === 'approved' ? 'badge-info' : 'badge-warning'}`}>
                          {p.status}
                        </span>
                      </td>
                      <td className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenReceiptModal(p)}
                            className="btn-secondary btn-sm inline-flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100"
                            title="View & export receipt"
                          >
                            <Receipt size={13} /> View Receipt
                          </button>
                          <button
                            onClick={() => exportReceiptPDF(p)}
                            className="btn-ghost p-1.5 text-surface-500 hover:text-primary-600 rounded-md"
                            title="Export PDF Receipt"
                          >
                            <Download size={14} />
                          </button>
                          <button
                            onClick={() => exportReceiptCSV(p)}
                            className="btn-ghost p-1.5 text-surface-500 hover:text-emerald-600 rounded-md"
                            title="Export CSV Data"
                          >
                            <FileSpreadsheet size={14} />
                          </button>
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

      {/* ─── View Farmer Payment Receipt Modal ─────────────────────────────────────── */}
      <Modal
        isOpen={receiptModalOpen && !!selectedPayment}
        onClose={() => setReceiptModalOpen(false)}
        title="Farmer Payment Voucher & Receipt"
        subtitle={selectedPayment ? `Voucher #${selectedPayment.payment_no}` : ''}
        maxWidth="max-w-xl"
      >
        {selectedPayment && (
          <div className="space-y-5">
            {/* Receipt Preview Box */}
            <div className="bg-gradient-to-b from-white to-emerald-50/30 border-2 border-emerald-200 rounded-2xl p-6 space-y-4 shadow-sm relative">
              <div className="flex justify-between items-start border-b border-emerald-100 pb-3">
                <div>
                  <h3 className="font-extrabold text-lg text-emerald-900 uppercase tracking-wide">Sara Ketha Harvest Hub</h3>
                  <p className="text-2xs text-surface-500">Official Farmer Payment Settlement Receipt</p>
                </div>
                <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full font-extrabold text-2xs uppercase border border-emerald-300">
                  ✓ {selectedPayment.status || 'CALCULATED'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-surface-500 text-2xs block uppercase font-semibold">Voucher Number</span>
                  <span className="font-mono font-bold text-surface-900">{selectedPayment.payment_no}</span>
                </div>
                <div>
                  <span className="text-surface-500 text-2xs block uppercase font-semibold">Collection Reference</span>
                  <span className="font-mono font-bold text-surface-900">{selectedPayment.produce_collections?.collection_no || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-surface-500 text-2xs block uppercase font-semibold">Farmer Name</span>
                  <span className="font-bold text-surface-900">{selectedPayment.farmers?.full_name || 'Farmer'}</span>
                </div>
                <div>
                  <span className="text-surface-500 text-2xs block uppercase font-semibold">Bank & Account</span>
                  <span className="font-medium text-surface-800">{selectedPayment.farmers?.bank_name ? `${selectedPayment.farmers.bank_name} (${selectedPayment.farmers.account_number || 'Acc'})` : 'Cash Settlement'}</span>
                </div>
                <div>
                  <span className="text-surface-500 text-2xs block uppercase font-semibold">Accepted Weight</span>
                  <span className="font-bold text-primary-700">{selectedPayment.accepted_qty_kg || '0'} kg</span>
                </div>
                <div>
                  <span className="text-surface-500 text-2xs block uppercase font-semibold">Quality Grade</span>
                  <span className="font-medium text-surface-800 capitalize">{(selectedPayment.grade || 'grade_a').replace(/_/g, ' ')}</span>
                </div>
              </div>

              {/* Table Breakdown */}
              <div className="bg-white border border-surface-200 rounded-xl overflow-hidden p-3.5 space-y-2 text-xs">
                <div className="flex justify-between text-surface-600">
                  <span>Gross Produce Value:</span>
                  <span className="font-bold text-surface-900">LKR {parseFloat(selectedPayment.gross_amount_lkr || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-surface-600">
                  <span>Itemized Deductions Withheld:</span>
                  <span className="font-bold text-red-600">- LKR {parseFloat(selectedPayment.total_deductions_lkr || 0).toLocaleString()}</span>
                </div>
                <div className="pt-2 border-t border-surface-200 flex justify-between items-baseline font-bold text-sm">
                  <span className="text-surface-900">Net Farmer Settlement:</span>
                  <span className="text-emerald-700 font-display text-base">LKR {parseFloat(selectedPayment.net_amount_lkr || 0).toLocaleString()}</span>
                </div>
              </div>

              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
                <span className="text-2xs text-emerald-800 uppercase font-bold block">Net Payment Payable</span>
                <span className="text-2xl font-black text-emerald-700 font-mono">
                  LKR {parseFloat(selectedPayment.net_amount_lkr || 0).toLocaleString()}
                </span>
              </div>
            </div>

            {/* Export Buttons */}
            <div className="flex flex-col sm:flex-row justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => exportReceiptCSV(selectedPayment)}
                className="btn-secondary flex items-center justify-center gap-1.5 text-xs"
              >
                <FileSpreadsheet size={15} /> Export as CSV
              </button>
              <button
                type="button"
                onClick={() => exportReceiptPDF(selectedPayment)}
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
