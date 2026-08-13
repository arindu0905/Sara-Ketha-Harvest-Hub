import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ordersApi } from '../../services/api';
import { ArrowLeft, Package, FileText, Truck, DollarSign } from 'lucide-react';

export const OrderDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: orderRes, isLoading } = useQuery({ queryKey: ['order-detail', id], queryFn: () => ordersApi.getById(id!), enabled: !!id });
  const order = orderRes?.data?.data;

  if (isLoading) return <div className="card p-8"><div className="skeleton h-64 rounded-xl" /></div>;
  if (!order) return <div className="card"><div className="empty-state"><p>Order not found</p></div></div>;

  const statusBadge = (s: string) => {
    const m: Record<string, string> = { submitted: 'badge-info', approved: 'badge-success', completed: 'badge-success', cancelled: 'badge-danger', stock_reserved: 'badge-earth', paid: 'badge-info' };
    return <span className={m[s] || 'badge-neutral'}>{s?.replace(/_/g, ' ')}</span>;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="btn-ghost p-2 rounded-xl"><ArrowLeft size={18} /></button>
          <div><h1 className="page-title">{order.order_no}</h1><p className="page-subtitle">Order details</p></div>
        </div>
        {statusBadge(order.status)}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="card-header"><h3 className="text-sm font-semibold flex items-center gap-2"><Package size={16} /> Order Info</h3></div>
          <div className="card-body space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-surface-500">Buyer</span><span className="font-medium">{order.buyers?.company_name || order.buyers?.contact_person}</span></div>
            <div className="flex justify-between"><span className="text-surface-500">Requested Date</span><span className="font-medium">{order.requested_date ? new Date(order.requested_date).toLocaleDateString('en-LK') : '—'}</span></div>
            <div className="flex justify-between"><span className="text-surface-500">Delivery Address</span><span className="font-medium text-right max-w-xs">{order.delivery_address || '—'}</span></div>
            {order.total_amount_lkr && <div className="flex justify-between border-t border-surface-100 pt-2"><span className="font-semibold">Total Amount</span><span className="font-bold text-primary-700">LKR {order.total_amount_lkr.toLocaleString()}</span></div>}
            {order.notes && <p className="text-xs text-surface-400 italic mt-2">"{order.notes}"</p>}
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h3 className="text-sm font-semibold">Order Items ({order.purchase_order_items?.length || 0})</h3></div>
          <div className="table-container"><table className="table">
            <thead><tr><th>Crop</th><th>Grade</th><th>Qty</th><th>Unit Price</th><th>Total</th></tr></thead>
            <tbody>{(order.purchase_order_items || []).map((item: any) => (
              <tr key={item.id}><td>{item.crop_categories?.name || '—'}</td><td className="capitalize">{item.grade?.replace(/_/g,' ') || 'Any'}</td>
              <td>{item.requested_qty_kg} kg</td><td>{item.unit_price_lkr ? `LKR ${item.unit_price_lkr}` : '—'}</td>
              <td>{item.total_price_lkr ? `LKR ${item.total_price_lkr.toLocaleString()}` : '—'}</td></tr>
            ))}</tbody>
          </table></div>
        </div>
      </div>

      {(order.invoices?.length > 0 || order.delivery_schedules?.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {order.invoices?.length > 0 && (
            <div className="card">
              <div className="card-header"><h3 className="text-sm font-semibold flex items-center gap-2"><FileText size={16} /> Invoices</h3></div>
              <div className="card-body space-y-2">{order.invoices.map((inv: any) => (
                <div key={inv.id} className="flex justify-between text-sm bg-surface-50 p-3 rounded-xl">
                  <span className="font-medium">{inv.invoice_no}</span>
                  <div className="text-right"><p className="font-bold">LKR {inv.total_amount_lkr?.toLocaleString()}</p><span className={`badge text-xs ${inv.status === 'paid' ? 'badge-success' : 'badge-warning'}`}>{inv.status}</span></div>
                </div>
              ))}</div>
            </div>
          )}
          {order.delivery_schedules?.length > 0 && (
            <div className="card">
              <div className="card-header"><h3 className="text-sm font-semibold flex items-center gap-2"><Truck size={16} /> Deliveries</h3></div>
              <div className="card-body space-y-2">{order.delivery_schedules.map((d: any) => (
                <div key={d.id} className="flex justify-between text-sm bg-surface-50 p-3 rounded-xl">
                  <span className="font-medium">{d.schedule_no}</span>
                  <div><span className={`badge text-xs ${d.status === 'delivered' ? 'badge-success' : 'badge-info'}`}>{d.status}</span><p className="text-xs text-surface-400 mt-1">{d.scheduled_date && new Date(d.scheduled_date).toLocaleDateString('en-LK')}</p></div>
                </div>
              ))}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
