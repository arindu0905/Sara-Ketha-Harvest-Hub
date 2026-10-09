import React, { useState } from 'react';
import { roleBasePath } from '../../utils/roleBase';
import { useAuth } from '../../contexts/AuthContext';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { inventoryApi, warehousesApi } from '../../services/api';
import { ArrowLeft, Package, Scale, Clock, Loader2, MapPin, Warehouse, Box } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import toast from 'react-hot-toast';

export const BatchDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');

  const { data: batchRes, isLoading } = useQuery({
    queryKey: ['batch-detail', id],
    queryFn: () => inventoryApi.getById(id!),
    enabled: !!id,
  });
  const batch = batchRes?.data?.data;

  // Adjust stock form
  const adjustForm = useForm<{ reason: string; quantity_kg: string; notes: string }>({ defaultValues: { reason: 'spoilage' } });
  const adjustMutation = useMutation({
    mutationFn: (data: { quantity_kg: number; reason: string; notes?: string }) => inventoryApi.recordWastage(id!, data),
    onSuccess: () => {
      toast.success('Wastage recorded');
      queryClient.invalidateQueries({ queryKey: ['batch-detail', id] });
      ['inventory-summary', 'inventory-list', 'inventory-wastage', 'inventory-expiry'].forEach(k => queryClient.invalidateQueries({ queryKey: [k] }));
      adjustForm.reset();
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed'),
  });

  // Assign location form
  const assignForm = useForm<{ warehouse_id: string; storage_location_id: string; notes: string }>();
  const assignMutation = useMutation({
    mutationFn: (data: { warehouse_id: string; storage_location_id?: string; notes?: string }) =>
      inventoryApi.assignLocation(id!, data),
    onSuccess: () => {
      toast.success('Physical location assigned');
      queryClient.invalidateQueries({ queryKey: ['batch-detail', id] });
      setShowAssignModal(false);
      assignForm.reset();
      setSelectedWarehouseId('');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to assign location'),
  });

  // Load warehouses for the assign modal
  const { data: whRes } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => warehousesApi.getAll({}),
    enabled: showAssignModal,
  });
  const warehouses = whRes?.data?.data || [];
  const selectedWarehouse = warehouses.find((w: any) => w.id === selectedWarehouseId);
  const activeLocations = (selectedWarehouse?.storage_locations || []).filter((l: any) => l.is_active);

  if (isLoading) return <div className="card p-8"><div className="skeleton h-64 rounded-xl" /></div>;
  if (!batch) return <div className="card"><div className="empty-state"><p>Batch not found</p></div></div>;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="page-header">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="btn-ghost p-2 rounded-xl"><ArrowLeft size={18} /></button>
          <div>
            <h1 className="page-title">{batch.batch_no}</h1>
            <p className="page-subtitle">Batch details, transactions and physical location</p>
          </div>
        </div>
        <span className={`badge ${batch.status === 'available' ? 'badge-success' : 'badge-neutral'}`}>{batch.status}</span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="stat-card">
          <div className="stat-icon bg-primary-100 text-primary-600"><Package size={20} /></div>
          <div><p className="text-xs text-surface-500">Available</p><p className="text-xl font-bold">{batch.available_qty_kg} kg</p></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon bg-blue-100 text-blue-600"><Scale size={20} /></div>
          <div><p className="text-xs text-surface-500">Initial</p><p className="text-xl font-bold">{batch.initial_qty_kg} kg</p></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon bg-yellow-100 text-yellow-600">📦</div>
          <div><p className="text-xs text-surface-500">Reserved</p><p className="text-xl font-bold">{batch.reserved_qty_kg || 0} kg</p></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon bg-red-100 text-red-600">🗑️</div>
          <div><p className="text-xs text-surface-500">Wasted</p><p className="text-xl font-bold">{batch.wasted_qty_kg || 0} kg</p></div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Batch Info */}
        <div className="card lg:col-span-1">
          <div className="card-header"><h3 className="text-sm font-semibold">Batch Info</h3></div>
          <div className="card-body space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-surface-500">Crop</span><span className="font-medium">{batch.crop_categories?.name} {batch.crop_varieties?.name ? `(${batch.crop_varieties.name})` : ''}</span></div>
            <div className="flex justify-between"><span className="text-surface-500">Grade</span><span className="font-medium capitalize">{batch.grade?.replace(/_/g, ' ')}</span></div>
            <div className="flex justify-between"><span className="text-surface-500">Farmer</span><span className="font-medium">{batch.farmers?.full_name} ({batch.farmers?.farmer_code})</span></div>
            <div className="flex justify-between"><span className="text-surface-500">Collection</span><span className="font-medium">{batch.produce_collections?.collection_no ?? '—'}</span></div>
            <div className="flex justify-between"><span className="text-surface-500">Collection date</span><span className="font-medium">{batch.produce_collections?.created_at ? new Date(batch.produce_collections.created_at).toLocaleDateString('en-LK') : '—'}</span></div>
            <div className="flex justify-between"><span className="text-surface-500">Collected weight (net)</span><span className="font-medium">{batch.produce_collections?.net_weight_kg ?? '—'} kg</span></div>
            <div className="flex justify-between"><span className="text-surface-500">Current status</span><span className="font-medium capitalize">{String(batch.status).replace(/_/g, ' ')}</span></div>
            {batch.collection_id && <div className="pt-1"><Link to={`${roleBasePath(user?.role)}/inspection-report/${batch.collection_id}`} className="btn-secondary btn-sm w-full justify-center">View inspection report</Link></div>}
            <div className="flex justify-between"><span className="text-surface-500">Purchase Price</span><span className="font-medium">LKR {batch.purchase_price_lkr?.toLocaleString()}/kg</span></div>
            <div className="flex justify-between"><span className="text-surface-500">Selling Price</span><span className="font-medium">LKR {batch.selling_price_lkr?.toLocaleString()}/kg</span></div>
            <div className="flex justify-between"><span className="text-surface-500">Received</span><span className="font-medium">{batch.received_date ? new Date(batch.received_date).toLocaleDateString('en-LK') : '—'}</span></div>
            <div className="flex justify-between"><span className="text-surface-500">Expiry</span><span className="font-medium">{batch.expected_expiry_date ? new Date(batch.expected_expiry_date).toLocaleDateString('en-LK') : '—'}</span></div>
            <div className="flex justify-between items-start"><span className="text-surface-500">QR Code</span><span className="font-mono text-xs text-right break-all">{batch.qr_code_value}</span></div>
          </div>
        </div>

        {/* Physical Location */}
        <div className="card lg:col-span-1">
          <div className="card-header flex items-center justify-between">
            <h3 className="text-sm font-semibold flex items-center gap-2"><MapPin size={14} className="text-primary-600" />Physical Location</h3>
            <button
              onClick={() => {
                setShowAssignModal(true);
                if (batch.warehouse_id) setSelectedWarehouseId(batch.warehouse_id);
                assignForm.setValue('warehouse_id', batch.warehouse_id || '');
                assignForm.setValue('storage_location_id', batch.storage_location_id || '');
              }}
              className="btn-secondary btn-sm text-xs flex items-center gap-1"
            >
              {batch.warehouse_id ? 'Change' : 'Assign Location'}
            </button>
          </div>
          <div className="card-body">
            {batch.warehouses ? (
              <div className="space-y-3">
                {/* Warehouse */}
                <div className="flex items-start gap-3 p-3 bg-surface-50 rounded-xl">
                  <div className="w-8 h-8 bg-primary-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Warehouse size={14} className="text-primary-600" />
                  </div>
                  <div>
                    <p className="text-xs text-surface-400">Warehouse</p>
                    <p className="font-semibold text-surface-800">{batch.warehouses.name}</p>
                    <p className="text-xs font-mono text-surface-500">{batch.warehouses.code}</p>
                  </div>
                </div>

                {/* Storage Location */}
                {batch.storage_locations ? (
                  <div className="flex items-start gap-3 p-3 bg-emerald-50 rounded-xl">
                    <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Box size={14} className="text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-xs text-emerald-600">Storage Location</p>
                      <p className="font-semibold text-surface-800 font-mono">{batch.storage_locations.code}</p>
                      {batch.storage_locations.description && (
                        <p className="text-xs text-surface-500">{batch.storage_locations.description}</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-amber-50 rounded-xl">
                    <p className="text-xs text-amber-700 flex items-center gap-1.5">
                      <Clock size={12} />
                      Warehouse assigned but no specific storage location selected yet
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="empty-state py-6">
                <MapPin className="w-8 h-8 text-surface-300 mb-2" />
                <p className="text-surface-500 text-sm font-medium">No location assigned</p>
                <p className="text-surface-400 text-xs mt-1">Assign this batch to a warehouse and storage location</p>
              </div>
            )}
          </div>
        </div>

        {/* Stock Adjustment */}
        <div className="card lg:col-span-1">
          <div className="card-header"><h3 className="text-sm font-semibold">Record Wastage</h3></div>
          <div className="card-body">
            <form
              onSubmit={adjustForm.handleSubmit(d => adjustMutation.mutate({
                reason: d.reason,
                quantity_kg: parseFloat(d.quantity_kg),
                notes: d.notes || undefined,
              }))}
              className="space-y-4"
            >
              <select className="form-select" {...adjustForm.register('reason', { required: true })}>
                {[['spoilage', 'Spoilage'], ['damage', 'Physical damage'], ['expiry', 'Expired'], ['pest_disease', 'Pest / disease'], ['handling', 'Handling loss'], ['temperature', 'Temperature'], ['other', 'Other']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <input
                type="number"
                step="0.1"
                min="0.1"
                max={batch.available_qty_kg}
                className="form-input"
                placeholder="Quantity (kg)"
                {...adjustForm.register('quantity_kg', { required: true })}
              />
              <textarea
                className="form-input"
                rows={2}
                placeholder="Notes..."
                {...adjustForm.register('notes')}
              />
              <button
                type="submit"
                disabled={adjustMutation.isPending}
                className="btn-danger w-full btn-sm"
              >
                {adjustMutation.isPending
                  ? <><Loader2 size={14} className="animate-spin" /> Processing...</>
                  : 'Record wastage'
                }
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Transaction History */}
      {batch.inventory_transactions?.length > 0 && (
        <div className="card">
          <div className="card-header"><h3 className="text-sm font-semibold">Transaction History</h3></div>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr><th>Type</th><th>Qty</th><th>Balance</th><th>Notes</th><th>By</th><th>Date</th></tr>
              </thead>
              <tbody>
                {batch.inventory_transactions.map((t: any) => (
                  <tr key={t.id}>
                    <td className="capitalize">{t.transaction_type}</td>
                    <td className={t.quantity_kg < 0 ? 'text-red-600' : 'text-primary-600'}>{t.quantity_kg} kg</td>
                    <td>{t.balance_kg} kg</td>
                    <td className="text-xs text-surface-500">{t.notes || '—'}</td>
                    <td className="text-xs">{t.profiles?.full_name || '—'}</td>
                    <td className="text-xs text-surface-400">{new Date(t.created_at).toLocaleString('en-LK')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── Assign Location Modal ──────────────────────────────────────────── */}
      <Modal
        isOpen={showAssignModal}
        onClose={() => { setShowAssignModal(false); assignForm.reset(); setSelectedWarehouseId(''); }}
        title="Assign Physical Location"
        subtitle={`Batch: ${batch.batch_no}`}
        maxWidth="max-w-md"
      >
        <form
          onSubmit={assignForm.handleSubmit(d => assignMutation.mutate({
            warehouse_id: d.warehouse_id,
            storage_location_id: d.storage_location_id || undefined,
            notes: d.notes || undefined,
          }))}
          className="space-y-4"
        >
          <div>
            <label className="block text-sm font-semibold text-surface-700 mb-1.5">
              Warehouse <span className="text-red-500">*</span>
            </label>
            <select
              className="form-select w-full"
              {...assignForm.register('warehouse_id', { required: true })}
              onChange={(e) => {
                setSelectedWarehouseId(e.target.value);
                assignForm.setValue('storage_location_id', '');
              }}
            >
              <option value="">Select warehouse...</option>
              {warehouses.map((w: any) => (
                <option key={w.id} value={w.id}>{w.name} ({w.code})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-surface-700 mb-1.5">
              Storage Location
            </label>
            <select
              className="form-select w-full"
              {...assignForm.register('storage_location_id')}
              disabled={!selectedWarehouseId}
            >
              <option value="">Select location (optional)...</option>
              {activeLocations.map((l: any) => (
                <option key={l.id} value={l.id}>
                  {l.code}{l.description ? ` — ${l.description}` : ''}
                  {l.capacity_kg ? ` (${l.capacity_kg.toLocaleString()} kg)` : ''}
                </option>
              ))}
            </select>
            {selectedWarehouseId && activeLocations.length === 0 && (
              <p className="text-xs text-amber-600 mt-1">No active locations in this warehouse. Add locations first.</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-surface-700 mb-1.5">Notes (optional)</label>
            <textarea
              className="form-input w-full"
              rows={2}
              placeholder="Reason for assignment..."
              {...assignForm.register('notes')}
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-surface-100">
            <button
              type="button"
              onClick={() => { setShowAssignModal(false); assignForm.reset(); setSelectedWarehouseId(''); }}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={assignMutation.isPending}
              className="btn-primary flex items-center gap-2"
            >
              {assignMutation.isPending
                ? <><Loader2 size={14} className="animate-spin" /> Assigning...</>
                : 'Assign Location'
              }
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
