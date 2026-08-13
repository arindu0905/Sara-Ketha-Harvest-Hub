import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ordersApi } from '../../services/api';
import { ShoppingCart, ChevronRight } from 'lucide-react';

export const MyOrders: React.FC = () => {
  const { data: ordersRes, isLoading } = useQuery({ queryKey: ['buyer-orders'], queryFn: () => ordersApi.getAll({}) });
  const orders = ordersRes?.data?.data || [];

  const statusBadge = (s: string) => {
    const m: Record<string, string> = { submitted: 'badge-info', approved: 'badge-success', completed: 'badge-success', cancelled: 'badge-danger', stock_reserved: 'badge-earth', under_review: 'badge-warning', paid: 'badge-info', dispatched: 'badge-purple' };
    return <span className={m[s] || 'badge-neutral'}>{s?.replace(/_/g, ' ')}</span>;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div><h1 className="page-title">My Orders</h1><p className="page-subtitle">{orders.length} orders</p></div>
        <Link to="/buyer/orders/new" className="btn-primary btn-sm"><ShoppingCart size={14} /> New Order</Link>
      </div>

      {isLoading ? <div className="card p-6 space-y-3">{[1,2,3].map(i => <div key={i} className="skeleton h-14 rounded-xl" />)}</div>
      : orders.length === 0 ? <div className="card"><div className="empty-state"><ShoppingCart className="w-8 h-8 text-surface-300 mb-2" /><p className="text-surface-400 text-sm">No orders yet</p></div></div>
      : (
        <div className="card overflow-hidden"><div className="table-container"><table className="table">
          <thead><tr><th>Order No</th><th>Items</th><th>Total</th><th>Status</th><th>Date</th><th></th></tr></thead>
          <tbody>{orders.map((o: any) => (
            <tr key={o.id}>
              <td className="font-semibold">{o.order_no}</td>
              <td>{o.purchase_order_items?.length || 0} items</td>
              <td>{o.total_amount_lkr ? `LKR ${o.total_amount_lkr.toLocaleString()}` : '—'}</td>
              <td>{statusBadge(o.status)}</td>
              <td className="text-xs text-surface-500">{new Date(o.created_at).toLocaleDateString('en-LK')}</td>
              <td><Link to={`/buyer/orders/${o.id}`} className="btn-ghost p-1"><ChevronRight size={16} /></Link></td>
            </tr>
          ))}</tbody>
        </table></div></div>
      )}
    </div>
  );
};
