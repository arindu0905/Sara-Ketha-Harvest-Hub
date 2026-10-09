import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ordersApi } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { ArrowLeft, Package, FileText, Truck, DollarSign, Calendar, MapPin, Building2, AlertCircle, XCircle, CheckCircle2, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import { OrderFeedback } from '../../components/OrderFeedback';
import { formatCategoryName } from '../../utils/categoryUtils';

export const OrderDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  const { data: orderRes, isLoading, refetch } = useQuery({
    queryKey: ['order-detail', id],
    queryFn: () => ordersApi.getById(id!),
    enabled: !!id,
  });

  const rawOrder = orderRes?.data?.data;
  const order = rawOrder?.data || rawOrder;

  const approveMutation = useMutation({
    mutationFn: () => ordersApi.updateStatus(id!, 'approved'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order-detail', id] });
      queryClient.invalidateQueries({ queryKey: ['buyer-orders'] });
      toast.success('Order approved and stock reserved (FEFO)');
      refetch();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to approve order');
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (reason: string) => ordersApi.cancel(id!, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order-detail', id] });
      queryClient.invalidateQueries({ queryKey: ['buyer-orders'] });
      queryClient.invalidateQueries({ queryKey: ['buyer-orders-dash'] });
      toast.success('Order cancelled successfully');
      setCancelModalOpen(false);
      refetch();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to cancel order');
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in max-w-5xl mx-auto p-4">
        <div className="skeleton h-12 w-64 rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="skeleton h-64 rounded-2xl" />
          <div className="skeleton h-64 rounded-2xl" />
        </div>
      </div>
    );
  }

  const backPath = user?.role === 'inventory_manager' ? '/inventory/orders' : user?.role === 'administrator' ? '/admin/orders' : user?.role === 'manager' ? '/manager/orders' : '/buyer/orders';

  if (!order) {
    return (
      <div className="card max-w-xl mx-auto my-12 p-8 text-center">
        <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-surface-900 mb-1">Order Not Found</h2>
        <p className="text-surface-500 text-sm mb-4">The requested purchase order could not be located.</p>
        <button onClick={() => navigate(backPath)} className="btn-primary btn-sm mx-auto">
          Return to Orders
        </button>
      </div>
    );
  }

  const statusBadge = (s: string) => {
    const m: Record<string, { cls: string; label: string }> = {
      submitted: { cls: 'badge-info', label: 'Submitted' },
      under_review: { cls: 'badge-warning', label: 'Under Review' },
      approved: { cls: 'badge-success', label: 'Approved' },
      stock_reserved: { cls: 'badge-earth', label: 'Stock Reserved' },
      dispatched: { cls: 'badge-purple', label: 'Dispatched' },
      completed: { cls: 'badge-success', label: 'Completed' },
      paid: { cls: 'badge-info', label: 'Paid' },
      cancelled: { cls: 'badge-danger', label: 'Cancelled' },
    };
    const conf = m[s] || { cls: 'badge-neutral', label: s?.replace(/_/g, ' ') };
    return <span className={`badge ${conf.cls} text-xs font-semibold px-3 py-1`}>{conf.label}</span>;
  };

  const canCancel = (user?.role === 'buyer'
    ? ['submitted', 'under_review', 'approved', 'stock_reserved', 'payment_pending']
    : ['submitted', 'under_review']).includes(order.status) &&
    ['buyer', 'inventory_manager', 'administrator'].includes(user?.role || '');
  const canApprove = ['submitted', 'under_review'].includes(order.status) &&
    (!user || user.role === 'inventory_manager' || user.role === 'administrator');

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl mx-auto pb-12">
      {/* Header */}
      <div className="page-header">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(backPath)}
            className="btn-ghost p-2 rounded-xl text-surface-600 hover:text-surface-900"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="page-title flex items-center gap-2">
              <Package className="text-primary-600 w-6 h-6" /> {order.order_no}
            </h1>
            <p className="page-subtitle">
              Created on {new Date(order.created_at).toLocaleDateString('en-LK', { dateStyle: 'long' })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {statusBadge(order.status)}
          {canApprove && (
            <button
              disabled={approveMutation.isPending}
              onClick={() => approveMutation.mutate()}
              className="btn-primary btn-sm flex items-center gap-1.5 shadow-md shadow-primary-600/15"
              title="Accept order and reserve stock from inventory database"
            >
              <CheckCircle2 size={16} /> {approveMutation.isPending ? 'Accepting Order...' : 'Accept Order'}
            </button>
          )}
          {canCancel && (
            <button
              onClick={() => setCancelModalOpen(true)}
              className="btn-danger btn-sm flex items-center gap-1.5 shadow-md shadow-red-600/15"
              title="Reject order and update status in database"
            >
              <XCircle size={16} /> Reject Order
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Order Items & Delivery Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Order Items Table */}
          <div className="card overflow-hidden">
            <div className="card-header border-b border-surface-100 p-4">
              <h3 className="text-base font-bold text-surface-900 flex items-center gap-2">
                <Package size={18} className="text-primary-600" /> Order Items (
                {order.purchase_order_items?.length || 0})
              </h3>
            </div>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Produce</th>
                    <th>Grade</th>
                    <th>Quantity</th>
                    <th>Unit Price</th>
                    <th className="text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(order.purchase_order_items || []).map((item: any) => (
                    <tr key={item.id}>
                      <td>
                        <div className="font-semibold text-surface-900">
                          {formatCategoryName(item.crop_categories || {})}
                        </div>
                        {item.crop_varieties?.name && (
                          <div className="text-2xs text-surface-500">Variety: {item.crop_varieties.name}</div>
                        )}
                      </td>
                      <td className="capitalize">
                        <span className="badge-neutral text-2xs px-2 py-0.5 rounded">
                          {item.grade?.replace(/_/g, ' ') || 'Standard'}
                        </span>
                      </td>
                      <td className="font-semibold text-surface-800">{item.requested_qty_kg} kg</td>
                      <td>{item.unit_price_lkr ? `LKR ${parseFloat(item.unit_price_lkr).toLocaleString()}` : '—'}</td>
                      <td className="text-right font-bold text-surface-900 font-display">
                        {item.total_price_lkr
                          ? `LKR ${parseFloat(item.total_price_lkr).toLocaleString()}`
                          : item.unit_price_lkr
                          ? `LKR ${(item.requested_qty_kg * item.unit_price_lkr).toLocaleString()}`
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Delivery & Destination Details */}
          <div className="card p-6 space-y-4">
            <h3 className="text-base font-bold text-surface-900 flex items-center gap-2 border-b border-surface-100 pb-3">
              <MapPin size={18} className="text-primary-600" /> Delivery & Destination
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div className="bg-surface-50 p-3.5 rounded-xl space-y-1">
                <span className="text-xs text-surface-500 font-medium flex items-center gap-1">
                  <Calendar size={13} /> Requested Delivery Date
                </span>
                <p className="font-semibold text-surface-800">
                  {order.requested_date
                    ? new Date(order.requested_date).toLocaleDateString('en-LK', { dateStyle: 'full' })
                    : 'Flexible / As soon as available'}
                </p>
              </div>

              <div className="bg-surface-50 p-3.5 rounded-xl space-y-1">
                <span className="text-xs text-surface-500 font-medium flex items-center gap-1">
                  <Building2 size={13} /> Collection Centre Hub
                </span>
                <p className="font-semibold text-surface-800">
                  {order.collection_centres?.name || 'Central Agricultural Hub'}
                </p>
              </div>
            </div>

            {order.delivery_address && (
              <div className="space-y-1 text-sm pt-2">
                <span className="text-xs text-surface-500 font-medium">Delivery Address:</span>
                <p className="font-medium text-surface-800 bg-surface-50 p-3 rounded-xl">
                  {order.delivery_address}
                </p>
              </div>
            )}

            {order.notes && (
              <div className="space-y-1 text-sm">
                <span className="text-xs text-surface-500 font-medium">Special Instructions / Notes:</span>
                <p className="italic text-surface-700 bg-surface-50 p-3 rounded-xl text-xs">
                  "{order.notes}"
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right 1 Col: Financial Summary & Invoices */}
        <div className="space-y-6">
          <div className="card p-6 space-y-4">
            <h3 className="text-base font-bold text-surface-900 border-b border-surface-100 pb-3 flex items-center gap-2">
              <DollarSign size={18} className="text-primary-600" /> Order Summary
            </h3>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between text-surface-600">
                <span>Order Status:</span>
                <span className="capitalize font-semibold text-surface-800">{order.status?.replace(/_/g, ' ')}</span>
              </div>
              <div className="flex justify-between text-surface-600">
                <span>Buyer Account:</span>
                <span className="font-semibold text-surface-800">
                  {order.buyers?.company_name || order.buyers?.contact_person || 'Buyer'}
                </span>
              </div>
              <div className="flex justify-between text-surface-600">
                <span>Contact Phone:</span>
                <span className="font-semibold text-surface-800">{order.buyers?.phone || '—'}</span>
              </div>

              <div className="pt-3 border-t border-surface-200 flex justify-between items-baseline">
                <span className="text-sm font-bold text-surface-900">Total Amount:</span>
                <span className="text-xl font-extrabold text-primary-700 font-display">
                  {order.total_amount_lkr
                    ? `LKR ${parseFloat(order.total_amount_lkr).toLocaleString()}`
                    : '—'}
                </span>
              </div>
            </div>
          </div>

          {/* Invoices and Delivery Tracking if available */}
          {order.invoices?.length > 0 && (
            <div className="card p-5 space-y-3">
              <h4 className="text-sm font-bold text-surface-900 flex items-center gap-2">
                <FileText size={16} className="text-primary-600" /> Related Invoices
              </h4>
              {order.invoices.map((inv: any) => (
                <div key={inv.id} className="flex justify-between items-center text-sm bg-surface-50 p-3 rounded-xl">
                  <div>
                    <div className="font-semibold text-surface-900">{inv.invoice_no}</div>
                    <div className="text-2xs text-surface-500">Status: {inv.status}</div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-primary-700">LKR {inv.total_amount_lkr?.toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          <OrderFeedback orderId={order.id} status={order.status} isBuyer={user?.role === 'buyer'} />

          {order.delivery_schedules?.length > 0 && (
            <div className="card p-5 space-y-3">
              <h4 className="text-sm font-bold text-surface-900 flex items-center gap-2">
                <Truck size={16} className="text-primary-600" /> Delivery Dispatch
              </h4>
              {order.delivery_schedules.map((d: any) => (
                <div key={d.id} className="flex justify-between items-center text-sm bg-surface-50 p-3 rounded-xl">
                  <div>
                    <div className="font-semibold text-surface-900">{d.schedule_no}</div>
                    <span className="badge-info text-2xs px-2 py-0.5 rounded">{d.status}</span>
                  </div>
                  <div className="text-right text-xs text-surface-600">
                    {d.scheduled_date && new Date(d.scheduled_date).toLocaleDateString('en-LK')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Cancel/Reject Order Modal */}
      {cancelModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="card max-w-md w-full p-6 space-y-4 shadow-2xl animate-scale-up">
            <h3 className="text-lg font-bold text-surface-900 flex items-center gap-2 text-red-600">
              <AlertCircle size={20} /> Reject Purchase Order
            </h3>
            <p className="text-xs text-surface-600 leading-relaxed">
              Are you sure you want to reject order <strong>{order.order_no}</strong>? This action will update the database status to cancelled and release any stock allocations.
            </p>
            <div>
              <label className="form-label text-xs">Reason for Rejection / Cancellation (Optional)</label>
              <textarea
                className="form-input text-xs"
                rows={3}
                placeholder="Provide a brief reason for rejecting..."
                value={cancelReason}
                onChange={e => setCancelReason(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCancelModalOpen(false)}
                className="btn-secondary btn-sm"
              >
                Keep Order
              </button>
              <button
                type="button"
                disabled={cancelMutation.isPending}
                onClick={() => cancelMutation.mutate(cancelReason)}
                className="btn-danger btn-sm"
              >
                {cancelMutation.isPending ? 'Rejecting...' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
