import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { farmerPaymentsApi } from '../../services/api';
import { useLanguage } from '../../contexts/LanguageContext';
import { formatCategoryForLanguage } from '../../utils/categoryUtils';
import { DollarSign, CheckCircle, Clock, Receipt } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiErrorMessage } from '../../utils/apiError';
import { printPayoutReceipt } from '../finance/ApprovePayments';

export const MyPayments: React.FC = () => {
  const { t, language, formatDate } = useLanguage();

  const { data: paymentsRes, isLoading } = useQuery({
    queryKey: ['farmer-my-payments'],
    queryFn: () => farmerPaymentsApi.getAll({}),
  });

  const payments = paymentsRes?.data?.data || [];
  const showReceipt = async (id: string) => {
    try { printPayoutReceipt((await farmerPaymentsApi.getReceipt(id)).data.data); }
    catch (e) { toast.error(apiErrorMessage(e, 'Receipt not available yet')); }
  };
  const totalPaid = payments.filter((p: any) => p.status === 'paid').reduce((s: number, p: any) => s + (p.net_amount_lkr || 0), 0);
  const totalPending = payments.filter((p: any) => p.status !== 'paid').reduce((s: number, p: any) => s + (p.net_amount_lkr || 0), 0);

  const statusBadge = (status: string) => {
    switch (status) {
      case 'paid': return <span className="badge-success"><CheckCircle size={12} /> {t('paid_amount')}</span>;
      case 'approved': return <span className="badge-info">Approved – payout soon</span>;
      case 'calculated': return <span className="badge-warning"><Clock size={12} /> Awaiting approval</span>;
      default: return <span className="badge-neutral">{String(status).replace(/_/g, ' ')}</span>;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('payments')}</h1>
          <p className="page-subtitle">{t('payments_subtitle') || 'Track your payment history'}</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="stat-card">
          <div className="stat-icon bg-primary-100 text-primary-600"><DollarSign size={22} /></div>
          <div>
            <p className="text-xs font-medium text-surface-500">{t('paid_amount')}</p>
            <p className="text-xl font-bold text-surface-900">LKR {totalPaid.toLocaleString('en-LK')}</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon bg-yellow-100 text-yellow-600"><Clock size={22} /></div>
          <div>
            <p className="text-xs font-medium text-surface-500">{t('pending_payment')}</p>
            <p className="text-xl font-bold text-surface-900">LKR {totalPending.toLocaleString('en-LK')}</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon bg-blue-100 text-blue-600"><CheckCircle size={22} /></div>
          <div>
            <p className="text-xs font-medium text-surface-500">{t('recent_payments')}</p>
            <p className="text-xl font-bold text-surface-900">{payments.length}</p>
          </div>
        </div>
      </div>

      {/* Payments Table */}
      {isLoading ? (
        <div className="card p-6 space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="skeleton h-14 rounded-xl" />)}
        </div>
      ) : payments.length === 0 ? (
        <div className="card">
          <div className="empty-state py-8">
            <div className="w-16 h-16 bg-surface-100 rounded-2xl flex items-center justify-center mb-4">
              <DollarSign className="w-8 h-8 text-surface-400" />
            </div>
            <h3 className="text-lg font-semibold text-surface-700 mb-2">{t('no_payments_yet')}</h3>
            <p className="text-surface-400 text-sm">{t('no_payments_desc') || 'Your payments will appear here after your produce is collected and inspected.'}</p>
          </div>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('payment_no') || 'Payment No'}</th>
                  <th>{t('collection_no') || 'Collection'}</th>
                  <th>{t('my_crops')}</th>
                  <th>{t('accepted_qty') || 'Qty (kg)'}</th>
                  <th>{t('paid_amount') || 'Net Amount'}</th>
                  <th>{t('status')}</th>
                  <th>{t('effective_date') || 'Date'}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p: any) => (
                  <tr key={p.id}>
                    <td className="font-semibold text-surface-900">{p.payment_no}</td>
                    <td className="text-sm">{p.produce_collections?.collection_no || '—'}</td>
                    <td className="text-sm">{formatCategoryForLanguage(p.produce_collections?.crop_categories, language) || '—'}</td>
                    <td>{p.accepted_qty_kg}</td>
                    <td className="font-bold text-primary-700">LKR {p.net_amount_lkr?.toLocaleString('en-LK')}</td>
                    <td>{statusBadge(p.status)}</td>
                    <td className="text-xs text-surface-500">{formatDate(p.created_at)}</td>
                    <td>{p.status === 'paid' && <button className="btn-ghost btn-sm flex items-center gap-1" onClick={() => showReceipt(p.id)}><Receipt size={14} /> {t('receipts')}</button>}</td>
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
