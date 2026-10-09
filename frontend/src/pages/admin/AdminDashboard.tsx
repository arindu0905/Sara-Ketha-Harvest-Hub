import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { reportsApi } from '../../services/api';
import { StatCard } from '../../components/ui/StatCard';
import {
  Users, Leaf, Package, CheckCircle, XCircle,
  Warehouse, AlertTriangle, DollarSign, FileText,
  ShoppingCart, TrendingUp, Banknote
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer
} from 'recharts';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';

export const AdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const { t, formatDate } = useLanguage();

  const { data: dashData, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => reportsApi.getDashboard(),
    refetchInterval: 60000,
  });

  const { data: financialData } = useQuery({
    queryKey: ['reports', 'financial'],
    queryFn: () => reportsApi.getFinancial(),
  });

  const stats = dashData?.data?.data;
  const monthly = financialData?.data?.data?.monthly || [];

  const collectionChartData = monthly.map((m: { month_name: string; revenue: number; farmer_payouts: number; profit: number }) => ({
    month: m.month_name,
    revenue: m.revenue,
    payouts: m.farmer_payouts,
    profit: m.profit,
  }));

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('admin_dashboard_title')}</h1>
          <p className="page-subtitle">{t('welcome_back')}, {user?.full_name || 'Admin'} · {t('system_overview')}</p>
        </div>
        <div className="text-sm text-surface-500 bg-surface-100 rounded-xl px-4 py-2">
          {formatDate(new Date())}
        </div>
      </div>

      {/* Stat Cards — Row 1 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title={t('registered_farmers')} value={stats?.active_farmers ?? '—'} icon={<Users size={22} />} iconBg="bg-primary-100" iconColor="text-primary-600" loading={isLoading} subtitle={t('active_accounts')} />
        <StatCard title={t('active_crops')} value={stats?.active_crops ?? '—'} icon={<Leaf size={22} />} iconBg="bg-green-100" iconColor="text-green-600" loading={isLoading} />
        <StatCard title={t('todays_collections')} value={stats?.today_collections ?? '—'} icon={<Package size={22} />} iconBg="bg-blue-100" iconColor="text-blue-600" loading={isLoading} />
        <StatCard title={t('available_stock')} value={stats?.available_stock_kg ? Math.round(stats.available_stock_kg).toLocaleString() : '—'} icon={<Warehouse size={22} />} iconBg="bg-purple-100" iconColor="text-purple-600" loading={isLoading} />
      </div>

      {/* Stat Cards — Row 2 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title={t('today_accepted')} value={stats?.today_accepted_kg ? stats.today_accepted_kg.toFixed(1) : '—'} icon={<CheckCircle size={22} />} iconBg="bg-primary-100" iconColor="text-primary-700" loading={isLoading} />
        <StatCard title={t('today_rejected')} value={stats?.today_rejected_kg ? stats.today_rejected_kg.toFixed(1) : '—'} icon={<XCircle size={22} />} iconBg="bg-red-100" iconColor="text-red-600" loading={isLoading} />
        <StatCard title={t('near_expiry')} value={stats?.near_expiry_batches ?? '—'} icon={<AlertTriangle size={22} />} iconBg="bg-yellow-100" iconColor="text-yellow-600" loading={isLoading} />
        <StatCard title={t('pending_farmer_payments')} value={stats?.pending_farmer_payments ?? '—'} icon={<DollarSign size={22} />} iconBg="bg-orange-100" iconColor="text-orange-600" loading={isLoading} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title={t('outstanding_invoices')} value={stats?.outstanding_invoices ?? '—'} icon={<FileText size={22} />} iconBg="bg-red-100" iconColor="text-red-600" loading={isLoading} />
        <StatCard title={t('active_orders')} value={stats?.active_orders ?? '—'} icon={<ShoppingCart size={22} />} iconBg="bg-blue-100" iconColor="text-blue-600" loading={isLoading} />
        <StatCard title={t('monthly_revenue')} value={stats?.monthly_revenue_lkr ? `LKR ${(stats.monthly_revenue_lkr / 1000).toFixed(1)}K` : '—'} icon={<TrendingUp size={22} />} iconBg="bg-primary-100" iconColor="text-primary-600" loading={isLoading} />
        <StatCard title={t('monthly_payouts')} value={stats?.monthly_farmer_payments_lkr ? `LKR ${(stats.monthly_farmer_payments_lkr / 1000).toFixed(1)}K` : '—'} icon={<Banknote size={22} />} iconBg="bg-earth-100" iconColor="text-earth-600" loading={isLoading} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Chart */}
        <div className="card p-6 lg:col-span-2">
          <h2 className="text-base font-semibold text-surface-800 mb-4">{t('revenue_vs_payouts')}</h2>
          {collectionChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={collectionChartData}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#16a34a" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="payGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#d97720" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#d97720" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#94a3b8' }} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={v => `${(v/1000).toFixed(0)}K`} />
                <Tooltip formatter={(v: number) => [`LKR ${v.toLocaleString()}`, '']} />
                <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#16a34a" strokeWidth={2} fill="url(#revGrad)" />
                <Area type="monotone" dataKey="payouts" name="Farmer Payouts" stroke="#d97720" strokeWidth={2} fill="url(#payGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-64 text-surface-400 text-sm">No financial data available yet</div>
          )}
        </div>

        {/* Quick actions */}
        <div className="card p-6">
          <h2 className="text-base font-semibold text-surface-800 mb-4">{t('quick_actions')}</h2>
          <div className="space-y-2">
            {[
              { label: t('manage_users'), path: '/admin/users', icon: '👥' },
              { label: t('price_management'), path: '/admin/prices', icon: '💰' },
              { label: t('view_audit_logs'), path: '/admin/audit-logs', icon: '🔐' },
              { label: t('system_settings'), path: '/admin/settings', icon: '⚙️' },
              { label: t('view_reports'), path: '/admin/reports', icon: '📊' },
              { label: t('collection_centres'), path: '/admin/centres', icon: '🏢' },
            ].map(action => (
              <a key={action.path} href={action.path} className="flex items-center gap-3 p-3 rounded-xl hover:bg-surface-50 transition-colors group">
                <span className="text-lg">{action.icon}</span>
                <span className="text-sm font-medium text-surface-700 group-hover:text-primary-600 transition-colors">{action.label}</span>
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* System-Wide Department Operations & Direct Portals */}
      <div className="card p-6 space-y-4">
        <div>
          <h2 className="text-base font-bold text-surface-900 flex items-center gap-2">
            <span>🛡️</span> System-Wide Department Portals & Live Operations
          </h2>
          <p className="text-xs text-surface-500">
            As Administrator, you have unrestricted global superuser access to operate and manage all processes across the platform.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
          {[
            {
              title: 'Collection Centre Hub',
              desc: 'Farmer arrivals, weighing, and intake registry',
              icon: '📦',
              path: '/officer/dashboard',
              badge: 'Intake & Weighing',
              color: 'hover:border-primary-400',
            },
            {
              title: 'Quality Inspection',
              desc: 'Grading A/B/C, lab test checks, and rejection logs',
              icon: '🔍',
              path: '/inspector/dashboard',
              badge: 'Quality Control',
              color: 'hover:border-blue-400',
            },
            {
              title: 'Warehouse & Inventory',
              desc: 'Stock batches, transfers, near-expiry and spoilage',
              icon: '🏬',
              path: '/inventory/dashboard',
              badge: 'Inventory Control',
              color: 'hover:border-purple-400',
            },
            {
              title: 'Buyer & Orders',
              desc: 'Marketplace produce, purchase orders, and sales',
              icon: '🛒',
              path: '/buyer/dashboard',
              badge: 'Commercial Sales',
              color: 'hover:border-emerald-400',
            },
            {
              title: 'Finance & Payouts',
              desc: 'Farmer payment vouchers, deductions, and invoices',
              icon: '💳',
              path: '/finance/dashboard',
              badge: 'Treasury & Billing',
              color: 'hover:border-amber-400',
            },
            {
              title: 'Transport & Fleet',
              desc: 'Vehicles, registered drivers, and shipment dispatches',
              icon: '🚚',
              path: '/transport/dashboard',
              badge: 'Logistics & Fleet',
              color: 'hover:border-teal-400',
            },
            {
              title: 'Farmer Operations',
              desc: 'Registered farmer directory, crop records, and delivery slots',
              icon: '🌾',
              path: '/farmer/dashboard',
              badge: 'Agronomy Hub',
              color: 'hover:border-green-400',
            },
            {
              title: 'Produce Auctions',
              desc: 'Surplus lots, auction monitoring, and bidding',
              icon: '⚖️',
              path: '/admin/auction/approval',
              badge: 'Live Marketplace',
              color: 'hover:border-orange-400',
            },
          ].map(p => (
            <a
              key={p.path}
              href={p.path}
              className={`border border-surface-200 rounded-2xl p-4 transition-all bg-surface-50/50 hover:bg-white hover:shadow-md group ${p.color}`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-2xl">{p.icon}</span>
                <span className="text-2xs font-semibold text-primary-700 bg-primary-50 px-2 py-0.5 rounded-full border border-primary-100">
                  {p.badge}
                </span>
              </div>
              <h3 className="text-sm font-bold text-surface-900 group-hover:text-primary-600 transition-colors">
                {p.title}
              </h3>
              <p className="text-xs text-surface-500 mt-1 leading-relaxed">{p.desc}</p>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
};
