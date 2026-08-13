import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { reportsApi } from '../../services/api';
import { BarChart3, TrendingUp, DollarSign } from 'lucide-react';

export const FinancialReports: React.FC = () => {
  const { data: finRes, isLoading } = useQuery({
    queryKey: ['financial-reports-data'],
    queryFn: () => reportsApi.getFinancial({}),
  });

  const report = finRes?.data?.data;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Financial Reports</h1>
          <p className="page-subtitle">Revenue, farmer disbursements, and margin analytics</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="stat-card">
          <div className="stat-icon bg-primary-100 text-primary-600"><DollarSign size={22} /></div>
          <div>
            <p className="text-xs font-medium text-surface-500">Total Disbursements</p>
            <p className="text-2xl font-bold text-surface-900">LKR {(report?.total_disbursements || 0).toLocaleString()}</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon bg-blue-100 text-blue-600"><TrendingUp size={22} /></div>
          <div>
            <p className="text-xs font-medium text-surface-500">Total Invoiced Sales</p>
            <p className="text-2xl font-bold text-surface-900">LKR {(report?.total_invoiced || 0).toLocaleString()}</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon bg-earth-100 text-earth-600"><BarChart3 size={22} /></div>
          <div>
            <p className="text-xs font-medium text-surface-500">Net Gross Margin</p>
            <p className="text-2xl font-bold text-surface-900">LKR {((report?.total_invoiced || 0) - (report?.total_disbursements || 0)).toLocaleString()}</p>
          </div>
        </div>
      </div>

      <div className="card p-6">
        <h3 className="text-sm font-semibold text-surface-800 mb-4">Financial Summary</h3>
        {isLoading ? (
          <div className="skeleton h-32 rounded-xl" />
        ) : (
          <div className="space-y-3 text-sm">
            <div className="flex justify-between py-2 border-b border-surface-50">
              <span className="text-surface-600">Total Produce Purchased (Farmer Payments)</span>
              <span className="font-semibold text-surface-900">LKR {(report?.total_disbursements || 0).toLocaleString()}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-surface-50">
              <span className="text-surface-600">Total Produce Sold (Buyer Invoices)</span>
              <span className="font-semibold text-surface-900">LKR {(report?.total_invoiced || 0).toLocaleString()}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-surface-50">
              <span className="text-surface-600">Deductions Collected</span>
              <span className="font-semibold text-surface-900">LKR {(report?.total_deductions || 0).toLocaleString()}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
