import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { reportsApi } from '../../services/api';
import { BarChart3, TrendingUp, DollarSign, RefreshCw, ArrowUpRight, Wallet, Receipt } from 'lucide-react';

const PERIOD_OPTIONS = [
  { label: 'Last 30 days',  value: '30' },
  { label: 'Last 90 days',  value: '90' },
  { label: 'Last 365 days', value: '365' },
  { label: 'This Year',     value: 'year' },
];

function formatLKR(val: number) {
  if (!val || val === 0) return 'LKR 0.00';
  return `LKR ${val.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Simple bar chart using CSS
function BarChart({ data, maxVal }: { data: { label: string; revenue: number; payouts: number }[]; maxVal: number }) {
  if (!data.length) return null;
  return (
    <div className="space-y-2">
      {data.map((d, i) => (
        <div key={i} className="grid grid-cols-[60px_1fr_1fr] gap-2 items-center">
          <span className="text-xs text-surface-500 text-right">{d.label}</span>
          <div className="flex items-center gap-1 h-5">
            <div
              className="h-full bg-emerald-500/80 rounded-sm transition-all"
              style={{ width: maxVal > 0 ? `${(d.revenue / maxVal) * 100}%` : '0%', minWidth: d.revenue > 0 ? '3px' : '0' }}
              title={`Revenue: ${formatLKR(d.revenue)}`}
            />
          </div>
          <div className="flex items-center gap-1 h-5">
            <div
              className="h-full bg-amber-400/80 rounded-sm transition-all"
              style={{ width: maxVal > 0 ? `${(d.payouts / maxVal) * 100}%` : '0%', minWidth: d.payouts > 0 ? '3px' : '0' }}
              title={`Payouts: ${formatLKR(d.payouts)}`}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export const FinancialReports: React.FC = () => {
  const [period, setPeriod] = useState('365');
  const queryClient = useQueryClient();

  const params = period === 'year'
    ? { year: new Date().getFullYear().toString() }
    : { days: period };

  const { data: finRes, isLoading, dataUpdatedAt } = useQuery({
    queryKey: ['financial-reports-data', params],
    queryFn: () => reportsApi.getFinancial(params),
  });

  const report = finRes?.data?.data;

  // Correctly read the flat keys that the backend now returns
  const totalInvoiced      = report?.total_invoiced      ?? report?.totals?.total_revenue  ?? 0;
  const totalDisbursements = report?.total_disbursements ?? report?.totals?.total_payouts  ?? 0;
  const totalDeductions    = report?.total_deductions    ?? report?.totals?.total_deductions ?? 0;
  const netMargin          = report?.net_margin          ?? report?.totals?.total_profit    ?? 0;
  const monthly: any[]     = report?.monthly ?? [];

  const maxVal = Math.max(...monthly.map((m: any) => Math.max(m.revenue ?? 0, m.farmer_payouts ?? 0)), 1);

  const chartData = monthly.map((m: any) => ({
    label: m.month_name,
    revenue: m.revenue ?? 0,
    payouts: m.farmer_payouts ?? 0,
    profit: m.profit ?? 0,
  }));

  const lastUpdated = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString('en-LK', { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Financial Reports</h1>
          <p className="page-subtitle">Revenue, farmer disbursements, deductions and margin analytics</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {lastUpdated && <span className="text-xs text-surface-400">Updated: {lastUpdated}</span>}
          <button
            onClick={() => queryClient.invalidateQueries({ queryKey: ['financial-reports-data'] })}
            className="btn-ghost p-2 rounded-xl text-surface-500 hover:text-surface-800"
          >
            <RefreshCw size={15} />
          </button>
          <div className="flex gap-1 bg-surface-100 rounded-xl p-1">
            {PERIOD_OPTIONS.map(p => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${period === p.value ? 'bg-white shadow-sm text-primary-700' : 'text-surface-500 hover:text-surface-700'}`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: 'Total Buyer Revenue',
            value: totalInvoiced,
            icon: <Receipt size={18} />,
            color: 'text-emerald-700',
            bg: 'bg-emerald-50 border-emerald-100',
            dot: 'text-emerald-500',
          },
          {
            label: 'Farmer Disbursements',
            value: totalDisbursements,
            icon: <Wallet size={18} />,
            color: 'text-amber-700',
            bg: 'bg-amber-50 border-amber-100',
            dot: 'text-amber-500',
          },
          {
            label: 'Deductions Collected',
            value: totalDeductions,
            icon: <DollarSign size={18} />,
            color: 'text-blue-700',
            bg: 'bg-blue-50 border-blue-100',
            dot: 'text-blue-500',
          },
          {
            label: 'Net Margin',
            value: netMargin,
            icon: <TrendingUp size={18} />,
            color: netMargin >= 0 ? 'text-purple-700' : 'text-red-700',
            bg: netMargin >= 0 ? 'bg-purple-50 border-purple-100' : 'bg-red-50 border-red-100',
            dot: netMargin >= 0 ? 'text-purple-500' : 'text-red-500',
          },
        ].map(kpi => (
          <div key={kpi.label} className={`card border p-5 ${kpi.bg}`}>
            {isLoading ? (
              <div className="space-y-2">
                <div className="h-4 w-20 bg-surface-200 rounded animate-pulse" />
                <div className="h-7 w-32 bg-surface-200 rounded animate-pulse" />
              </div>
            ) : (
              <>
                <div className={`flex items-center gap-1.5 mb-2 ${kpi.dot}`}>
                  {kpi.icon}
                  <p className="text-xs font-medium text-surface-500">{kpi.label}</p>
                </div>
                <p className={`text-xl font-extrabold ${kpi.color}`}>{formatLKR(kpi.value)}</p>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Monthly Chart */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-semibold text-surface-900 flex items-center gap-2">
            <BarChart3 size={16} className="text-primary-600" />
            Monthly Breakdown
          </h3>
          <div className="flex items-center gap-4 text-xs text-surface-500">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-emerald-500/80 rounded-sm inline-block" />Buyer Revenue</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-amber-400/80 rounded-sm inline-block" />Farmer Payouts</span>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {[...Array(6)].map((_, i) => <div key={i} className="h-5 bg-surface-100 rounded animate-pulse" />)}
          </div>
        ) : monthly.length === 0 ? (
          <div className="text-center py-8 text-surface-400">
            <BarChart3 size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">No financial data for the selected period.</p>
          </div>
        ) : (
          <div className="grid grid-cols-[60px_1fr_1fr] gap-2 mb-2">
            <span />
            <span className="text-xs font-semibold text-surface-500">Revenue →</span>
            <span className="text-xs font-semibold text-surface-500">Payouts →</span>
          </div>
        )}

        {!isLoading && <BarChart data={chartData} maxVal={maxVal} />}
      </div>

      {/* Monthly detail table */}
      {!isLoading && monthly.length > 0 && (
        <div className="card overflow-hidden">
          <div className="p-4 border-b border-surface-100">
            <h3 className="font-semibold text-surface-900 text-sm">Month-by-Month Summary</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-50">
                <tr>
                  {['Month', 'Buyer Revenue', 'Farmer Payouts', 'Deductions', 'Net Margin'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-50">
                {chartData.map((row, i) => (
                  <tr key={i} className="hover:bg-surface-50/50">
                    <td className="px-4 py-3 font-medium text-surface-800">{row.label}</td>
                    <td className="px-4 py-3 text-emerald-700 font-semibold">{formatLKR(row.revenue)}</td>
                    <td className="px-4 py-3 text-amber-700">{formatLKR(row.payouts)}</td>
                    <td className="px-4 py-3 text-blue-700">
                      {formatLKR((monthly[i] as any)?.deductions ?? 0)}
                    </td>
                    <td className={`px-4 py-3 font-bold ${row.profit >= 0 ? 'text-purple-700' : 'text-red-600'}`}>
                      {formatLKR(row.profit)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-surface-50 border-t-2 border-surface-200">
                <tr>
                  <td className="px-4 py-3 font-bold text-surface-900">TOTAL</td>
                  <td className="px-4 py-3 font-bold text-emerald-700">{formatLKR(totalInvoiced)}</td>
                  <td className="px-4 py-3 font-bold text-amber-700">{formatLKR(totalDisbursements)}</td>
                  <td className="px-4 py-3 font-bold text-blue-700">{formatLKR(totalDeductions)}</td>
                  <td className={`px-4 py-3 font-bold ${netMargin >= 0 ? 'text-purple-700' : 'text-red-600'}`}>
                    {formatLKR(netMargin)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
