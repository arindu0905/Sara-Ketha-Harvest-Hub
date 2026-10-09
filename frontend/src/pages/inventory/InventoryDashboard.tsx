import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { inventoryApi } from '../../services/api';
import { StatCard } from '../../components/ui/StatCard';
import { Package, AlertTriangle, Trash2, Banknote, Lock } from 'lucide-react';
import { formatLKR } from '../../utils/lkrFormat';

export const InventoryDashboard: React.FC = () => {
  const { data: summaryRes, isLoading } = useQuery({ queryKey: ['inventory-summary'], queryFn: () => inventoryApi.getSummary() });
  const { data: expiryRes } = useQuery({ queryKey: ['inventory-expiry'], queryFn: () => inventoryApi.getExpiry() });
  const { data: wasteRes } = useQuery({ queryKey: ['inventory-wastage-dash'], queryFn: () => inventoryApi.getWastage({ limit: '1' }) });

  const summary: any[] = summaryRes?.data?.data || [];
  const expiry = expiryRes?.data?.data?.summary;
  const waste = wasteRes?.data?.meta?.totals;
  const totalStock = summary.reduce((s, c) => s + (c.total_available || 0), 0);
  const totalReserved = summary.reduce((s, c) => s + (c.total_reserved || 0), 0);
  const low = summary.filter(c => c.low_stock);
  const chart = summary.map(c => ({ name: c.name, Available: Math.round(c.total_available), Reserved: Math.round(c.total_reserved) }));

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div><h1 className="page-title">Inventory Dashboard</h1><p className="page-subtitle">Live stock, expiry risk and wastage</p></div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard title="Available stock" value={`${Math.round(totalStock).toLocaleString()} kg`} icon={<Package size={22} />} loading={isLoading} />
        <StatCard title="Reserved for orders" value={`${Math.round(totalReserved).toLocaleString()} kg`} icon={<Lock size={22} />} iconBg="bg-blue-100" iconColor="text-blue-600" />
        <StatCard title="Near expiry / expired" value={expiry?.near_expiry_batches + expiry?.expired_batches || 0} subtitle={expiry ? `${expiry.critical_batches} critical` : undefined} icon={<AlertTriangle size={22} />} iconBg="bg-yellow-100" iconColor="text-yellow-600" />
        <StatCard title="Value at risk" value={formatLKR(expiry?.total_value_at_risk_lkr ?? 0, 0)} icon={<Banknote size={22} />} iconBg="bg-orange-100" iconColor="text-orange-600" />
        <StatCard title="Wasted (all time)" value={`${Math.round(waste?.total_kg ?? 0).toLocaleString()} kg`} subtitle={formatLKR(waste?.total_value_lkr ?? 0, 0)} icon={<Trash2 size={22} />} iconBg="bg-red-100" iconColor="text-red-600" />
      </div>

      {expiry && (expiry.near_expiry_batches > 0 || expiry.expired_batches > 0) && (
        <div className="alert alert-warning">
          <AlertTriangle size={16} className="flex-shrink-0" />
          <div>
            <p className="font-medium">
              {expiry.expired_batches > 0 && `${expiry.expired_batches} expired batch(es) need write-off. `}
              {expiry.near_expiry_batches - expiry.expired_batches > 0 && `${expiry.near_expiry_batches - expiry.expired_batches} batch(es) expire within ${expiry.threshold_days} days.`}
            </p>
            <Link to="/inventory/near-expiry" className="text-xs underline">Review expiry risk →</Link>
          </div>
        </div>
      )}
      {low.length > 0 && (
        <div className="alert alert-info">
          <Package size={16} className="flex-shrink-0" />
          <p className="text-sm">Low stock: {low.map(c => c.name).join(', ')}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="card-header"><h2 className="text-sm font-semibold">Stock by category (kg)</h2></div>
          <div className="p-4 h-72">
            {chart.length === 0 ? <p className="text-sm text-surface-400 text-center pt-16">No stock recorded yet</p> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chart}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} />
                  <Tooltip /><Legend />
                  <Bar dataKey="Available" fill="#16a34a" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Reserved" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h2 className="text-sm font-semibold">Grade breakdown</h2></div>
          {summary.length === 0 ? <div className="empty-state py-6"><p className="text-surface-400 text-sm">No inventory data</p></div> : (
            <div className="divide-y divide-surface-50">
              {summary.map(cat => (
                <div key={cat.category_id} className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-surface-800">{cat.name} {cat.low_stock && <span className="badge-warning ml-1">low</span>}</p>
                    <div className="flex gap-2 mt-1 flex-wrap">
                      {Object.entries(cat.by_grade || {}).map(([g, qty]: any) => (
                        <span key={g} className="text-xs badge-neutral capitalize">{g.replace(/_/g, ' ')}: {Math.round(qty)} kg</span>
                      ))}
                    </div>
                  </div>
                  <span className="text-lg font-bold text-primary-700">{Math.round(cat.total_available).toLocaleString()} kg</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card p-5">
        <h2 className="text-sm font-semibold text-surface-800 mb-3">Quick actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[{ label: 'View inventory', path: '/inventory/stock' }, { label: 'Near expiry', path: '/inventory/near-expiry' }, { label: 'Warehouses', path: '/inventory/warehouses' }, { label: 'Wastage', path: '/inventory/wastage' }].map(a => (
            <Link key={a.path} to={a.path} className="p-4 bg-surface-50 rounded-xl hover:bg-primary-50 hover:text-primary-700 transition-colors text-center text-xs font-medium text-surface-700">{a.label}</Link>
          ))}
        </div>
      </div>
    </div>
  );
};
