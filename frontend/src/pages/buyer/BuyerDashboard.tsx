import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ordersApi, invoicesApi } from '../../services/api';
import { formatLKR } from '../../utils/lkrFormat';
import { StatCard } from '../../components/ui/StatCard';
import { ShoppingCart, FileText, DollarSign, ChevronRight, Package } from 'lucide-react';

export const BuyerDashboard: React.FC = () => {
  const { data: ordersRes, isLoading } = useQuery({ queryKey: ['buyer-orders-dash'], queryFn: () => ordersApi.getAll({ limit: '5' }) });
  const { data: invoicesRes } = useQuery({ queryKey: ['buyer-invoices-dash'], queryFn: () => invoicesApi.getAll({}) });

  const orders = ordersRes?.data?.data || [];
  const invoices = invoicesRes?.data?.data || [];
  const totalOrders = ordersRes?.data?.meta?.total || 0;
  const open = invoices.filter((i: any) => !['paid', 'cancelled'].includes(i.status));
  const balance = (i: any) => Math.max(0, Number(i.total_amount_lkr || 0) - Number(i.amount_paid_lkr || 0));
  const totalOutstanding = open.reduce((s: number, i: any) => s + balance(i), 0);
  const totalSpent = invoices.reduce((s: number, i: any) => s + Number(i.amount_paid_lkr || 0), 0);
  const overdue = open.filter((i: any) => i.due_date && new Date(i.due_date) < new Date()).length;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div><h1 className="page-title">Buyer Dashboard</h1><p className="page-subtitle">Your purchasing overview</p></div>
        <Link to="/buyer/orders/new" className="btn-primary btn-sm"><ShoppingCart size={14} /> New Order</Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Orders" value={totalOrders} icon={<ShoppingCart size={22} />} iconBg="bg-primary-100" iconColor="text-primary-600" loading={isLoading} />
        <StatCard title="Outstanding balance" value={formatLKR(totalOutstanding, 0)} subtitle={overdue ? `${overdue} overdue` : `${open.length} open invoice(s)`} icon={<FileText size={22} />} iconBg="bg-yellow-100" iconColor="text-yellow-600" />
        <StatCard title="Total paid" value={formatLKR(totalSpent, 0)} icon={<DollarSign size={22} />} iconBg="bg-blue-100" iconColor="text-blue-600" />
        <StatCard title="Active Orders" value={orders.filter((o: any) => !['completed', 'cancelled', 'rejected', 'delivered'].includes(o.status)).length} icon={<Package size={22} />} iconBg="bg-earth-100" iconColor="text-earth-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="card-header"><h2 className="text-sm font-semibold">Recent Orders</h2><Link to="/buyer/orders" className="text-xs text-primary-600 flex items-center gap-1">View all <ChevronRight size={14} /></Link></div>
          {orders.length === 0 ? <div className="empty-state py-8"><p className="text-surface-400 text-sm">No orders yet</p></div> : (
            <div className="divide-y divide-surface-50">{orders.slice(0, 5).map((o: any) => (
              <Link key={o.id} to={`/buyer/orders/${o.id}`} className="flex items-center justify-between p-4 hover:bg-surface-50 transition-colors">
                <div><p className="text-sm font-semibold text-surface-800">{o.order_no}</p><p className="text-xs text-surface-500">{new Date(o.created_at).toLocaleDateString('en-LK')}</p></div>
                <span className={`badge text-xs ${o.status === 'completed' ? 'badge-success' : o.status === 'cancelled' ? 'badge-danger' : 'badge-info'}`}>{o.status?.replace(/_/g, ' ')}</span>
              </Link>
            ))}</div>
          )}
        </div>

        <div className="card p-5">
          <h2 className="text-sm font-semibold text-surface-800 mb-3">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-3">
            {[{ label: 'Browse Products', icon: '🛒', path: '/buyer/marketplace' }, { label: 'Place Order', icon: '📋', path: '/buyer/orders/new' }, { label: 'My Orders', icon: '📦', path: '/buyer/orders' }, { label: 'Invoices', icon: '💰', path: '/buyer/invoices' }].map(a => (
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
