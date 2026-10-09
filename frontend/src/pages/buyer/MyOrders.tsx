import React, { useState, useMemo } from 'react';
import { DoneBy } from '../../components/ui/DoneBy';
import { useQuery } from '@tanstack/react-query';
import { Link, useLocation } from 'react-router-dom';
import { ordersApi } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { ShoppingCart, ChevronRight, Search, RefreshCw, Filter, Package, CheckCircle2, Clock, XCircle, ArrowRight } from 'lucide-react';
import { formatCategoryName } from '../../utils/categoryUtils';

export const MyOrders: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  const rolePrefix = location.pathname.startsWith('/inventory') || user?.role === 'inventory_manager'
    ? '/inventory'
    : location.pathname.startsWith('/manager') || user?.role === 'manager'
    ? '/manager'
    : location.pathname.startsWith('/admin') || user?.role === 'administrator'
    ? '/admin'
    : '/buyer';
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const { data: ordersRes, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['buyer-orders', statusFilter],
    queryFn: () => ordersApi.getAll(statusFilter !== 'all' ? { status: statusFilter } : {}),
  });

  const orders = ordersRes?.data?.data || [];

  const filteredOrders = useMemo(() => {
    if (!searchTerm.trim()) return orders;
    const term = searchTerm.toLowerCase();
    return orders.filter((o: any) => {
      const matchNo = o.order_no?.toLowerCase().includes(term);
      const matchItems = o.purchase_order_items?.some((item: any) =>
        item.crop_categories?.name?.toLowerCase().includes(term) ||
        item.crop_categories?.name_sinhala?.toLowerCase().includes(term)
      );
      return matchNo || matchItems;
    });
  }, [orders, searchTerm]);

  // Statistics calculation
  const totalCount = orders.length;
  const pendingCount = orders.filter((o: any) => ['submitted', 'under_review', 'stock_reserved'].includes(o.status)).length;
  const approvedCount = orders.filter((o: any) => ['approved', 'dispatched', 'completed', 'paid'].includes(o.status)).length;
  const totalValue = orders.reduce((sum: number, o: any) => sum + (parseFloat(o.total_amount_lkr) || 0), 0);

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
    return <span className={conf.cls}>{conf.label}</span>;
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Package className="text-primary-600 w-6 h-6" /> {user?.role === 'buyer' ? 'My Purchase Orders' : 'Purchase Orders'}
          </h1>
          <p className="page-subtitle">Track, view, and manage all agricultural purchase orders in real-time</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="btn-secondary btn-sm flex items-center gap-1.5"
            title="Refresh Orders"
          >
            <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} /> Refresh
          </button>
          {user?.role === 'buyer' && (
            <Link to="/buyer/orders/new" className="btn-primary btn-sm flex items-center gap-1.5 shadow-md shadow-primary-600/15">
              <ShoppingCart size={15} /> New Order
            </Link>
          )}
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4 flex items-center gap-3.5">
          <div className="w-11 h-11 bg-primary-50 rounded-xl flex items-center justify-center text-primary-600">
            <Package size={20} />
          </div>
          <div>
            <p className="text-2xs text-surface-500 font-semibold uppercase tracking-wider">Total Orders</p>
            <p className="text-xl font-extrabold text-surface-900 font-display">{totalCount}</p>
          </div>
        </div>

        <div className="card p-4 flex items-center gap-3.5">
          <div className="w-11 h-11 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600">
            <Clock size={20} />
          </div>
          <div>
            <p className="text-2xs text-surface-500 font-semibold uppercase tracking-wider">Pending / Review</p>
            <p className="text-xl font-extrabold text-amber-600 font-display">{pendingCount}</p>
          </div>
        </div>

        <div className="card p-4 flex items-center gap-3.5">
          <div className="w-11 h-11 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
            <CheckCircle2 size={20} />
          </div>
          <div>
            <p className="text-2xs text-surface-500 font-semibold uppercase tracking-wider">Approved / Active</p>
            <p className="text-xl font-extrabold text-emerald-600 font-display">{approvedCount}</p>
          </div>
        </div>

        <div className="card p-4 flex items-center gap-3.5">
          <div className="w-11 h-11 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
            <span className="text-base font-bold">LKR</span>
          </div>
          <div>
            <p className="text-2xs text-surface-500 font-semibold uppercase tracking-wider">Total Value</p>
            <p className="text-lg font-extrabold text-surface-900 font-display">
              {totalValue > 0 ? `LKR ${totalValue.toLocaleString()}` : 'LKR 0'}
            </p>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="card p-4">
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          {/* Status Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
            {[
              { id: 'all', label: 'All Orders' },
              { id: 'submitted', label: 'Submitted' },
              { id: 'under_review', label: 'Under Review' },
              { id: 'approved', label: 'Approved' },
              { id: 'stock_reserved', label: 'Stock Reserved' },
              { id: 'completed', label: 'Completed' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  statusFilter === tab.id
                    ? 'bg-primary-600 text-white shadow-sm'
                    : 'bg-surface-100 text-surface-600 hover:bg-surface-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-64">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
            <input
              type="text"
              placeholder="Search by order no or crop..."
              className="form-input text-xs pl-9 py-2 w-full"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Orders List / Table */}
      {isLoading ? (
        <div className="card p-6 space-y-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="skeleton h-16 rounded-xl" />
          ))}
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="card py-16 text-center">
          <div className="empty-state max-w-md mx-auto">
            <div className="w-16 h-16 bg-primary-50 rounded-2xl flex items-center justify-center text-primary-600 mx-auto mb-4">
              <ShoppingCart size={32} />
            </div>
            <h3 className="text-lg font-bold text-surface-800 mb-1">
              {searchTerm || statusFilter !== 'all' ? 'No Matching Orders' : 'No Purchase Orders Yet'}
            </h3>
            <p className="text-surface-500 text-sm mb-6">
              {searchTerm || statusFilter !== 'all'
                ? 'Try adjusting your search criteria or status filter to find what you need.'
                : 'Get started by creating your first purchase order to reserve fresh produce directly from farmers.'}
            </p>
            {user?.role === 'buyer' && (
              <div className="flex items-center justify-center gap-3">
                <Link to={`${rolePrefix}/orders/new`} className="btn-primary btn-sm flex items-center gap-1.5">
                  <ShoppingCart size={15} /> Create First Order
                </Link>
                <Link to="/buyer/marketplace" className="btn-secondary btn-sm flex items-center gap-1.5">
                  Browse Marketplace <ArrowRight size={14} />
                </Link>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Order Reference</th>
                  <th>Crops & Items</th>
                  <th>Total Amount</th>
                  <th>Status</th>
                  {user?.role !== 'buyer' && <th>Approved by</th>}
                  <th>Order Date</th>
                  <th>Delivery Date</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((o: any) => {
                  const itemsCount = o.purchase_order_items?.length || 0;
                  const itemSummaries = (o.purchase_order_items || [])
                    .slice(0, 2)
                    .map((it: any) => `${formatCategoryName(it.crop_categories || {})} (${it.requested_qty_kg}kg)`)
                    .join(', ');

                  return (
                    <tr key={o.id} className="hover:bg-surface-50/80 transition-colors">
                      <td>
                        <div className="font-bold text-surface-900 font-mono text-sm">{o.order_no}</div>
                        <div className="text-2xs text-surface-400">ID: {o.id.substring(0, 8)}...</div>
                      </td>
                      <td>
                        <div className="font-medium text-surface-800 text-sm">
                          {itemsCount > 0 ? `${itemsCount} item${itemsCount > 1 ? 's' : ''}` : '0 items'}
                        </div>
                        {itemSummaries && (
                          <div className="text-xs text-surface-500 truncate max-w-xs">{itemSummaries}</div>
                        )}
                      </td>
                      <td>
                        <div className="font-bold text-surface-900 font-display">
                          {o.total_amount_lkr ? `LKR ${parseFloat(o.total_amount_lkr).toLocaleString()}` : '—'}
                        </div>
                      </td>
                      <td>{statusBadge(o.status)}</td>
                      {user?.role !== 'buyer' && <td><DoneBy items={[[null, o.approver ?? o.reviewer, o.approved_at ?? o.reviewed_at]]} /></td>}
                      <td className="text-xs text-surface-500 font-medium">
                        {new Date(o.created_at).toLocaleDateString('en-LK', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </td>
                      <td className="text-xs text-surface-600">
                        {o.requested_date
                          ? new Date(o.requested_date).toLocaleDateString('en-LK', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })
                          : '—'}
                      </td>
                      <td className="text-right">
                        <Link
                          to={`${rolePrefix}/orders/${o.id}`}
                          className="btn-ghost p-1.5 text-primary-700 hover:bg-primary-50 rounded-lg inline-flex items-center gap-1 text-xs font-semibold"
                        >
                          View <ChevronRight size={15} />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
