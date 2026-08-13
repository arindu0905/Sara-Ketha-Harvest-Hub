import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { ordersApi, cropsApi, adminApi, buyersApi } from '../../services/api';
import { AlertCircle, Loader2, ArrowLeft, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatCategoryName } from '../../utils/categoryUtils';

interface OrderItem { category_id: string; variety_id?: string; grade?: string; requested_qty_kg: string; unit_price_lkr?: string; }

export const CreateOrder: React.FC = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState<OrderItem[]>([{ category_id: '', requested_qty_kg: '' }]);
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [requestedDate, setRequestedDate] = useState('');
  const [notes, setNotes] = useState('');

  const { data: catRes } = useQuery({ queryKey: ['crop-categories'], queryFn: () => cropsApi.getCategories() });
  const { data: centresRes } = useQuery({ queryKey: ['centres'], queryFn: () => adminApi.getCentres() });
  const { data: buyerRes } = useQuery({ queryKey: ['buyer-me'], queryFn: () => buyersApi.getAll({ limit: '1' }) });

  const categories = catRes?.data?.data || [];
  const centres = centresRes?.data?.data || [];
  const buyerRecord = buyerRes?.data?.data?.[0];
  const [centreId, setCentreId] = useState('');

  const addItem = () => setItems([...items, { category_id: '', requested_qty_kg: '' }]);
  const removeItem = (idx: number) => setItems(items.filter((_,i) => i !== idx));
  const updateItem = (idx: number, field: string, val: string) => setItems(items.map((item, i) => i === idx ? { ...item, [field]: val } : item));

  const mutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => ordersApi.create(data),
    onSuccess: () => { toast.success('Order submitted!'); navigate('/buyer/orders'); },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!buyerRecord) { toast.error('Buyer record not found'); return; }
    if (items.some(i => !i.category_id || !i.requested_qty_kg)) { toast.error('Complete all item fields'); return; }
    mutation.mutate({
      buyer_id: buyerRecord.id,
      centre_id: centreId || null,
      requested_date: requestedDate || null,
      delivery_address: deliveryAddress || null,
      notes: notes || null,
      items: items.map(i => ({
        category_id: i.category_id,
        variety_id: i.variety_id || null,
        grade: i.grade || null,
        requested_qty_kg: parseFloat(i.requested_qty_kg),
        unit_price_lkr: i.unit_price_lkr ? parseFloat(i.unit_price_lkr) : null,
      })),
    });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="btn-ghost p-2 rounded-xl"><ArrowLeft size={18} /></button>
          <div><h1 className="page-title">Create Order</h1><p className="page-subtitle">Submit a new purchase order</p></div>
        </div>
      </div>

      <div className="card max-w-3xl"><div className="card-body">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className="form-label">Centre</label><select className="form-select" value={centreId} onChange={e => setCentreId(e.target.value)}>
              <option value="">Select centre</option>{centres.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select></div>
            <div><label className="form-label">Requested Date</label><input type="date" className="form-input" value={requestedDate} onChange={e => setRequestedDate(e.target.value)} /></div>
          </div>
          <div><label className="form-label">Delivery Address</label><textarea className="form-input" rows={2} value={deliveryAddress} onChange={e => setDeliveryAddress(e.target.value)} /></div>

          <div>
            <div className="flex justify-between items-center mb-3"><h3 className="text-sm font-semibold text-surface-800">Order Items</h3>
              <button type="button" onClick={addItem} className="btn-secondary btn-sm"><Plus size={14} /> Add Item</button></div>
            <div className="space-y-3">
              {items.map((item, idx) => (
                <div key={idx} className="bg-surface-50 rounded-xl p-4 space-y-3">
                  <div className="flex justify-between items-center"><span className="text-xs font-medium text-surface-500">Item {idx+1}</span>
                    {items.length > 1 && <button type="button" onClick={() => removeItem(idx)} className="btn-ghost p-1 text-red-500"><Trash2 size={14} /></button>}</div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <select className="form-select" value={item.category_id} onChange={e => updateItem(idx, 'category_id', e.target.value)}>
                      <option value="">Select crop *</option>{categories.map((c: any) => <option key={c.id} value={c.id}>{formatCategoryName(c)}</option>)}
                    </select>
                    <select className="form-select" value={item.grade || ''} onChange={e => updateItem(idx, 'grade', e.target.value)}>
                      <option value="">Any grade</option><option value="grade_a">Grade A</option><option value="grade_b">Grade B</option><option value="grade_c">Grade C</option>
                    </select>
                    <input type="number" step="0.1" min="0.1" className="form-input" placeholder="Quantity (kg) *" value={item.requested_qty_kg} onChange={e => updateItem(idx, 'requested_qty_kg', e.target.value)} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div><label className="form-label">Notes</label><textarea className="form-input" rows={2} value={notes} onChange={e => setNotes(e.target.value)} /></div>

          <div className="flex justify-end gap-3 pt-4 border-t border-surface-100">
            <button type="button" onClick={() => navigate(-1)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={mutation.isPending} className="btn-primary">
              {mutation.isPending ? <><Loader2 size={16} className="animate-spin" /> Submitting...</> : '🛒 Submit Order'}
            </button>
          </div>
        </form>
      </div></div>
    </div>
  );
};
