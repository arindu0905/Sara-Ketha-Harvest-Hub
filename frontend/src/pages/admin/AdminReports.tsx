import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { reportsApi } from '../../services/api';
import { BarChart3, RefreshCw, DollarSign, TrendingUp, Package, AlertTriangle } from 'lucide-react';

export const AdminReports: React.FC = () => {
  const { data: dashResponse, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['admin-reports-dashboard'],
    queryFn: () => reportsApi.getDashboard(),
  });

  const { data: finResponse } = useQuery({
    queryKey: ['admin-reports-financial'],
    queryFn: () => reportsApi.getFinancial(),
  });

  const stats = dashResponse?.data?.data;
  const financial = finResponse?.data?.data;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <BarChart3 className="text-primary-600" size={28} /> Reports & Analytics
          </h1>
          <p className="page-subtitle">System-wide operational statistics, collections summaries, and financial reports</p>
        </div>

        <button onClick={() => refetch()} disabled={isFetching} className="btn-secondary flex items-center gap-2">
          <RefreshCw size={16} className={isFetching ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 rounded-xl bg-primary-100 text-primary-600">
              <TrendingUp size={22} />
            </div>
            <div>
              <div className="text-xs font-semibold text-surface-500 uppercase">Monthly Revenue</div>
              <div className="text-2xl font-bold text-surface-900">
                {isLoading ? '...' : `Rs. ${(stats?.monthly_revenue_lkr || 0).toLocaleString()}`}
              </div>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 rounded-xl bg-earth-100 text-earth-600">
              <DollarSign size={22} />
            </div>
            <div>
              <div className="text-xs font-semibold text-surface-500 uppercase">Farmer Payouts</div>
              <div className="text-2xl font-bold text-surface-900">
                {isLoading ? '...' : `Rs. ${(stats?.monthly_farmer_payments_lkr || 0).toLocaleString()}`}
              </div>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 rounded-xl bg-blue-100 text-blue-600">
              <Package size={22} />
            </div>
            <div>
              <div className="text-xs font-semibold text-surface-500 uppercase">Stock Available</div>
              <div className="text-2xl font-bold text-surface-900">
                {isLoading ? '...' : `${Math.round(stats?.available_stock_kg || 0).toLocaleString()} kg`}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card p-6">
        <h3 className="text-lg font-bold text-surface-900 mb-4">Financial Summary</h3>
        {financial?.monthly?.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-50 border-b border-surface-200 text-xs font-semibold text-surface-600 uppercase">
                  <th className="py-3 px-4">Month</th>
                  <th className="py-3 px-4">Total Revenue</th>
                  <th className="py-3 px-4">Farmer Payouts</th>
                  <th className="py-3 px-4">Net Margin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100 text-sm">
                {financial.monthly.map((m: any, idx: number) => (
                  <tr key={idx} className="hover:bg-surface-50">
                    <td className="py-3 px-4 font-semibold text-surface-900">{m.month_name}</td>
                    <td className="py-3 px-4 text-emerald-700 font-medium">Rs. {Number(m.revenue || 0).toLocaleString()}</td>
                    <td className="py-3 px-4 text-amber-700 font-medium">Rs. {Number(m.farmer_payouts || 0).toLocaleString()}</td>
                    <td className="py-3 px-4 text-blue-700 font-bold">Rs. {Number(m.profit || 0).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center text-surface-400 text-sm">
            No monthly financial data aggregated yet.
          </div>
        )}
      </div>
    </div>
  );
};
