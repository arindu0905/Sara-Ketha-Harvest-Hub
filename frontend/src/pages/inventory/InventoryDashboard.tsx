import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { inventoryApi } from '../../services/api';
import { StatCard } from '../../components/ui/StatCard';
import { Package, AlertTriangle, BarChart3, Warehouse, ChevronRight } from 'lucide-react';

export const InventoryDashboard: React.FC = () => {
  const { data: summaryRes, isLoading } = useQuery({ queryKey: ['inventory-summary'], queryFn: () => inventoryApi.getSummary() });
  const { data: nearExpiryRes } = useQuery({ queryKey: ['inventory-near-expiry'], queryFn: () => inventoryApi.getAll({ near_expiry: 'true', limit: '5' }) });
  const { data: allRes } = useQuery({ queryKey: ['inventory-all-stat'], queryFn: () => inventoryApi.getAll({ limit: '1' }) });

  const summary = summaryRes?.data?.data || [];
  const nearExpiry = nearExpiryRes?.data?.data || [];
  const totalBatches = allRes?.data?.meta?.total || 0;
  const totalStock = summary.reduce((s: number, c: any) => s + (c.total_available || 0), 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div><h1 className="page-title">Inventory Dashboard</h1><p className="page-subtitle">Stock management overview</p></div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Stock" value={`${totalStock.toLocaleString()} kg`} icon={<Package size={22} />} iconBg="bg-primary-100" iconColor="text-primary-600" loading={isLoading} />
        <StatCard title="Active Batches" value={totalBatches} icon={<BarChart3 size={22} />} iconBg="bg-blue-100" iconColor="text-blue-600" />
        <StatCard title="Near Expiry" value={nearExpiry.length} icon={<AlertTriangle size={22} />} iconBg="bg-yellow-100" iconColor="text-yellow-600" />
        <StatCard title="Categories" value={summary.length} icon={<Warehouse size={22} />} iconBg="bg-earth-100" iconColor="text-earth-600" />
      </div>

      {nearExpiry.length > 0 && (
        <div className="alert-warning">
          <AlertTriangle size={16} className="flex-shrink-0" />
          <div><p className="font-medium">{nearExpiry.length} batch(es) expiring within 7 days</p>
            <Link to="/inventory/near-expiry" className="text-xs underline">View details →</Link></div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="card-header"><h2 className="text-sm font-semibold">Stock by Category</h2></div>
          {summary.length === 0 ? <div className="empty-state py-6"><p className="text-surface-400 text-sm">No inventory data</p></div> : (
            <div className="divide-y divide-surface-50">
              {summary.map((cat: any, i: number) => (
                <div key={i} className="p-4 flex items-center justify-between hover:bg-surface-50 transition-colors">
                  <div><p className="text-sm font-medium text-surface-800">{cat.name}</p>
                    <div className="flex gap-2 mt-1">{Object.entries(cat.by_grade || {}).map(([g, qty]: any) => (
                      <span key={g} className="text-xs badge-neutral capitalize">{g.replace(/_/g, ' ')}: {qty} kg</span>
                    ))}</div>
                  </div>
                  <span className="text-lg font-bold text-primary-700">{cat.total_available?.toLocaleString()} kg</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card p-5">
          <h2 className="text-sm font-semibold text-surface-800 mb-3">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-3">
            {[{ label: 'View Inventory', icon: '📦', path: '/inventory/stock' }, { label: 'Near Expiry', icon: '⏰', path: '/inventory/near-expiry' }, { label: 'Warehouses', icon: '🏭', path: '/inventory/warehouses' }, { label: 'Wastage', icon: '🗑️', path: '/inventory/wastage' }].map(a => (
              <Link key={a.path} to={a.path} className="flex flex-col items-center gap-2 p-4 bg-surface-50 rounded-xl hover:bg-primary-50 hover:text-primary-700 transition-colors text-center">
                <span className="text-2xl">{a.icon}</span><span className="text-xs font-medium text-surface-700">{a.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
