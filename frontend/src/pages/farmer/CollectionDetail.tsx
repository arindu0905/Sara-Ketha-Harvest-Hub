import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { collectionsApi } from '../../services/api';
import { ArrowLeft, Package, Scale, CheckSquare, DollarSign, Clock, User, MapPin } from 'lucide-react';

export const CollectionDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: collectionRes, isLoading } = useQuery({
    queryKey: ['collection-detail', id],
    queryFn: () => collectionsApi.getById(id!),
    enabled: !!id,
  });

  const collection = collectionRes?.data?.data;

  const statusColor = (status: string) => {
    const map: Record<string, string> = {
      arrived: 'badge-info', weighed: 'badge-info', under_inspection: 'badge-warning',
      accepted: 'badge-success', partially_accepted: 'badge-earth', rejected: 'badge-danger',
      added_to_inventory: 'badge-success', payment_pending: 'badge-warning', completed: 'badge-success',
    };
    return map[status] || 'badge-neutral';
  };

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="page-header"><div className="skeleton h-8 w-64 rounded" /></div>
        <div className="card p-8"><div className="skeleton h-64 rounded-xl" /></div>
      </div>
    );
  }

  if (!collection) {
    return (
      <div className="space-y-6">
        <div className="page-header">
          <button onClick={() => navigate(-1)} className="btn-secondary btn-sm"><ArrowLeft size={14} /> Back</button>
        </div>
        <div className="card"><div className="empty-state"><p className="text-surface-500">Collection not found</p></div></div>
      </div>
    );
  }

  const inspection = collection.quality_inspections?.[0];
  const payment = collection.farmer_payments?.[0];
  const batch = collection.inventory_batches?.[0];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="btn-ghost p-2 rounded-xl"><ArrowLeft size={18} /></button>
          <div>
            <h1 className="page-title">{collection.collection_no}</h1>
            <p className="page-subtitle">Collection details and tracking</p>
          </div>
        </div>
        <span className={statusColor(collection.status)}>{collection.status?.replace(/_/g, ' ')}</span>
      </div>

      {/* Timeline Steps */}
      <div className="card p-6">
        <h3 className="text-sm font-semibold text-surface-800 mb-4">Progress Timeline</h3>
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          {['arrived', 'weighed', 'inspected', 'inventory', 'payment'].map((step, i) => {
            const completed = ['arrived'].includes(step) ? true
              : step === 'weighed' ? !!collection.weighed_at
              : step === 'inspected' ? !!inspection
              : step === 'inventory' ? !!batch
              : step === 'payment' ? payment?.status === 'paid'
              : false;
            return (
              <React.Fragment key={step}>
                {i > 0 && <div className={`h-0.5 w-8 flex-shrink-0 ${completed ? 'bg-primary-500' : 'bg-surface-200'}`} />}
                <div className={`flex items-center gap-2 px-3 py-2 rounded-full text-xs font-medium flex-shrink-0 ${completed ? 'bg-primary-100 text-primary-700' : 'bg-surface-100 text-surface-400'}`}>
                  {completed ? '✓' : (i + 1)} {step.charAt(0).toUpperCase() + step.slice(1)}
                </div>
              </React.Fragment>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Basic Info */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-sm font-semibold text-surface-800 flex items-center gap-2"><Package size={16} /> Collection Info</h3>
          </div>
          <div className="card-body space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-surface-500">Crop</span>
              <span className="font-medium">{collection.crop_categories?.name} {collection.crop_varieties?.name ? `(${collection.crop_varieties.name})` : ''}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-surface-500">Farmer</span>
              <span className="font-medium">{collection.farmers?.full_name}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-surface-500">Centre</span>
              <span className="font-medium">{collection.collection_centres?.name}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-surface-500">Arrived</span>
              <span className="font-medium">{collection.arrived_at ? new Date(collection.arrived_at).toLocaleString('en-LK') : '—'}</span>
            </div>
          </div>
        </div>

        {/* Weighing */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-sm font-semibold text-surface-800 flex items-center gap-2"><Scale size={16} /> Weighing</h3>
          </div>
          <div className="card-body space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-surface-500">Gross Weight</span>
              <span className="font-medium">{collection.gross_weight_kg ? `${collection.gross_weight_kg} kg` : '—'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-surface-500">Container Weight</span>
              <span className="font-medium">{collection.container_weight_kg ? `${collection.container_weight_kg} kg` : '—'}</span>
            </div>
            <div className="flex justify-between text-sm border-t border-surface-100 pt-2">
              <span className="text-surface-700 font-semibold">Net Weight</span>
              <span className="font-bold text-primary-700">{collection.net_weight_kg ? `${collection.net_weight_kg} kg` : '—'}</span>
            </div>
            {collection.weighed_at && (
              <div className="flex justify-between text-sm">
                <span className="text-surface-500">Weighed At</span>
                <span className="text-xs">{new Date(collection.weighed_at).toLocaleString('en-LK')}</span>
              </div>
            )}
          </div>
        </div>

        {/* Quality Inspection */}
        {inspection && (
          <div className="card">
            <div className="card-header">
              <h3 className="text-sm font-semibold text-surface-800 flex items-center gap-2"><CheckSquare size={16} /> Quality Inspection</h3>
            </div>
            <div className="card-body space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-surface-500">Grade</span>
                <span className={`badge text-xs capitalize ${inspection.grade === 'rejected' ? 'badge-danger' : inspection.grade === 'grade_a' ? 'badge-success' : 'badge-warning'}`}>
                  {inspection.grade?.replace(/_/g, ' ')}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-surface-500">Accepted Qty</span>
                <span className="font-medium text-primary-700">{inspection.accepted_qty_kg} kg</span>
              </div>
              {inspection.rejected_qty_kg > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-surface-500">Rejected Qty</span>
                  <span className="font-medium text-red-600">{inspection.rejected_qty_kg} kg</span>
                </div>
              )}
              {inspection.inspection_notes && (
                <p className="text-xs text-surface-500 italic mt-2">"{inspection.inspection_notes}"</p>
              )}
            </div>
          </div>
        )}

        {/* Payment */}
        {payment && (
          <div className="card">
            <div className="card-header">
              <h3 className="text-sm font-semibold text-surface-800 flex items-center gap-2"><DollarSign size={16} /> Payment</h3>
            </div>
            <div className="card-body space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-surface-500">Payment No</span>
                <span className="font-medium">{payment.payment_no}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-surface-500">Gross Amount</span>
                <span className="font-medium">LKR {payment.gross_amount_lkr?.toLocaleString('en-LK')}</span>
              </div>
              {payment.total_deductions_lkr > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-surface-500">Deductions</span>
                  <span className="font-medium text-red-600">- LKR {payment.total_deductions_lkr?.toLocaleString('en-LK')}</span>
                </div>
              )}
              <div className="flex justify-between text-sm border-t border-surface-100 pt-2">
                <span className="text-surface-700 font-semibold">Net Amount</span>
                <span className="font-bold text-primary-700 text-lg">LKR {payment.net_amount_lkr?.toLocaleString('en-LK')}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-surface-500">Status</span>
                <span className={`badge text-xs ${payment.status === 'paid' ? 'badge-success' : payment.status === 'approved' ? 'badge-info' : 'badge-warning'}`}>
                  {payment.status}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
