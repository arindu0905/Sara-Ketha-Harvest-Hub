import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ordersApi, cropsApi, pricesApi, buyersApi, centresApi, inventoryApi } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import {
  Loader2, ArrowLeft, Plus, Trash2, ShoppingCart, DollarSign,
  Calendar, Building2, MapPin, CheckCircle2, Package, AlertCircle, ChevronDown, Tag,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { formatCategoryName } from '../../utils/categoryUtils';

interface OrderItem {
  category_id: string;
  variety_id?: string;
  grade?: string;
  requested_qty_kg: string;
  unit_price_lkr?: string;
}

// ─── Fetches varieties for a specific category (called per item row) ──────────
const VarietySelector: React.FC<{
  categoryId: string;
  value: string;
  onChange: (varId: string) => void;
  inventoryData?: any;
}> = ({ categoryId, value, onChange, inventoryData }) => {
  const { data, isLoading } = useQuery({
    queryKey: ['category-varieties', categoryId],
    queryFn: () => cropsApi.getVarietiesByCategory(categoryId),
    enabled: !!categoryId,
    staleTime: 5 * 60 * 1000,
  });

  const varieties: any[] = data?.data?.data?.crop_varieties || [];

  if (!categoryId) return null;

  return (
    <div>
      <label className="form-label text-xs font-semibold flex items-center gap-1">
        <Tag size={11} className="text-primary-500" /> Product / Variety
      </label>
      {isLoading ? (
        <div className="form-input text-sm flex items-center gap-2 text-surface-400">
          <Loader2 size={14} className="animate-spin" /> Loading products...
        </div>
      ) : varieties.length === 0 ? (
        <div className="form-input text-sm text-surface-400 italic">No specific products listed</div>
      ) : (
        <select
          className="form-select text-sm"
          value={value || ''}
          onChange={e => onChange(e.target.value)}
        >
          <option value="">All varieties (any)</option>
          {varieties
            .filter((v: any) => v.is_active !== false)
            .map((v: any) => {
              const stock = inventoryData?.by_variety?.[v.id] || 0;
              return (
                <option key={v.id} value={v.id}>
                  {v.name}
                  {stock > 0 ? ` (${stock.toLocaleString()} kg)` : ' (unavailable)'}
                  {v.description ? ` — ${v.description.slice(0, 40)}` : ''}
                </option>
              );
            })}
        </select>
      )}
      {varieties.length > 0 && (
        <p className="mt-1 text-2xs text-surface-400">
          {varieties.filter((v: any) => v.is_active !== false).length} product{varieties.length > 1 ? 's' : ''} available in this category
        </p>
      )}
    </div>
  );
};

export const CreateOrder: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const initialCatId = searchParams.get('category_id') || '';
  const initialVarietyId = searchParams.get('variety_id') || '';
  const initialGrade = searchParams.get('grade') || 'grade_a';

  const [items, setItems] = useState<OrderItem[]>([
    { category_id: initialCatId, variety_id: initialVarietyId, grade: initialGrade, requested_qty_kg: '' }
  ]);
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [requestedDate, setRequestedDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return d.toISOString().split('T')[0];
  });
  const [notes, setNotes] = useState('');
  const [centreId, setCentreId] = useState('');

  const { data: catRes, isLoading: catLoading } = useQuery({
    queryKey: ['crop-categories'],
    queryFn: () => cropsApi.getCategories(),
  });
  const { data: centresRes } = useQuery({
    queryKey: ['centres'],
    queryFn: () => centresApi.getAll(),
  });
  const { data: pricesRes } = useQuery({
    queryKey: ['active-prices'],
    queryFn: () => pricesApi.getCurrent(),
  });
  const { data: buyerRes } = useQuery({
    queryKey: ['buyer-me'],
    queryFn: () => buyersApi.getAll({ limit: '1' }),
  });
  const { data: inventoryRes } = useQuery({
    queryKey: ['inventory-summary'],
    queryFn: () => inventoryApi.getSummary(),
  });

  const categories = catRes?.data?.data || [];
  const centres = centresRes?.data?.data || [];
  const activePrices = pricesRes?.data?.data || [];
  const buyerRecord = buyerRes?.data?.data?.[0];
  const inventorySummary: any[] = inventoryRes?.data?.data || [];

  const getAvailableStock = (categoryId: string, grade?: string): number => {
    if (!categoryId) return 0;
    const entry = inventorySummary.find((s: any) => s.category_id === categoryId);
    if (!entry) return 0;
    if (grade && entry.by_grade) return Number(entry.by_grade[grade] || 0);
    return Number(entry.total_available || 0);
  };

  const getSuggestedPrice = (categoryId: string, grade?: string) => {
    if (!categoryId) return 0;
    const match = activePrices.find(
      (p: any) => p.category_id === categoryId && (!grade || p.grade === grade || !p.grade)
    );
    if (match?.selling_price) return parseFloat(match.selling_price);
    const cat = categories.find((c: any) => c.id === categoryId);
    if (cat?.base_price_per_kg) return parseFloat(cat.base_price_per_kg);
    return 0;
  };

  const addItem = () => setItems([...items, { category_id: '', variety_id: '', grade: 'grade_a', requested_qty_kg: '' }]);
  const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx));

  const updateItem = (idx: number, field: string, val: string) => {
    setItems(prev =>
      prev.map((item, i) => {
        if (i !== idx) return item;
        const updated = { ...item, [field]: val };
        // When category changes, reset variety and auto-fill price
        if (field === 'category_id') {
          updated.variety_id = '';
          const suggested = getSuggestedPrice(val, item.grade);
          updated.unit_price_lkr = suggested > 0 ? String(suggested) : '';
        }
        if (field === 'grade') {
          const suggested = getSuggestedPrice(item.category_id, val);
          if (suggested > 0) updated.unit_price_lkr = String(suggested);
        }
        return updated;
      })
    );
  };

  const calculateItemTotal = (item: OrderItem) => {
    const qty = parseFloat(item.requested_qty_kg) || 0;
    const price = getSuggestedPrice(item.category_id, item.grade) || 0;
    return qty * price;
  };

  const grandTotal = items.reduce((acc, item) => acc + calculateItemTotal(item), 0);

  const mutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => ordersApi.create(data),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['buyer-orders'] });
      queryClient.invalidateQueries({ queryKey: ['buyer-orders-dash'] });
      queryClient.invalidateQueries({ queryKey: ['marketplace-summary'] });
      toast.success(res?.data?.message || 'Order placed successfully!');
      navigate('/buyer/orders');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to place order. Please check required fields.');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (items.some(i => !i.category_id || !i.requested_qty_kg || parseFloat(i.requested_qty_kg) <= 0)) {
      toast.error('Please specify a valid crop category and quantity for all items.');
      return;
    }
    if (!centreId) { toast.error('Please select a Preferred Collection Centre.'); return; }
    if (!deliveryAddress.trim()) { toast.error('Please enter a Delivery Address.'); return; }

    mutation.mutate({
      buyer_id: buyerRecord?.id || undefined,
      centre_id: centreId,
      requested_date: requestedDate || null,
      delivery_address: deliveryAddress.trim(),
      notes: notes || null,
      items: items.map(i => ({
        category_id: i.category_id,
        variety_id: i.variety_id || null,
        grade: i.grade || null,
        requested_qty_kg: parseFloat(i.requested_qty_kg),
      })),
    });
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12 max-w-5xl mx-auto">
      <div className="page-header">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="btn-ghost p-2 rounded-xl text-surface-600 hover:text-surface-900">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="page-title flex items-center gap-2">
              <ShoppingCart className="text-primary-600 w-6 h-6" /> Place Purchase Order
            </h1>
            <p className="page-subtitle">Select a crop category to view available products, then set quantity and grade</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Form Items */}
        <div className="lg:col-span-2 space-y-6">

          {/* Section: Order Items */}
          <div className="card p-6 space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-surface-100">
              <div>
                <h2 className="text-base font-bold text-surface-900">Order Items</h2>
                <p className="text-xs text-surface-500">Select a crop category — products in that category will appear automatically</p>
              </div>
              <button type="button" onClick={addItem} className="btn-secondary btn-sm flex items-center gap-1.5">
                <Plus size={14} /> Add Item
              </button>
            </div>

            {catLoading ? (
              <div className="flex items-center justify-center py-8 gap-2 text-surface-400">
                <Loader2 size={18} className="animate-spin" /> Loading categories...
              </div>
            ) : (
              <div className="space-y-5">
                {items.map((item, idx) => {
                  const suggestedPrice = getSuggestedPrice(item.category_id, item.grade);
                  const lineTotal = calculateItemTotal(item);
                  const availableStock = getAvailableStock(item.category_id, item.grade);
                  const gradeStocks = item.category_id ? {
                    grade_a: getAvailableStock(item.category_id, 'grade_a'),
                    grade_b: getAvailableStock(item.category_id, 'grade_b'),
                    grade_c: getAvailableStock(item.category_id, 'grade_c'),
                  } : null;
                  const requestedQty = parseFloat(item.requested_qty_kg) || 0;
                  const exceedsStock = availableStock > 0 && requestedQty > availableStock;
                  const selectedCat = categories.find((c: any) => c.id === item.category_id);

                  return (
                    <div
                      key={idx}
                      className="bg-gradient-to-br from-surface-50 to-white border border-surface-200/80 rounded-2xl p-4 space-y-4 transition-all hover:border-primary-200 hover:shadow-sm"
                    >
                      {/* Item Header */}
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold uppercase tracking-wider text-primary-700 bg-primary-50 px-2.5 py-0.5 rounded-full border border-primary-100">
                          Item #{idx + 1}
                        </span>
                        {items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeItem(idx)}
                            className="btn-ghost p-1 text-red-500 hover:bg-red-50 rounded-lg text-xs flex items-center gap-1"
                          >
                            <Trash2 size={13} /> Remove
                          </button>
                        )}
                      </div>

                      {/* Row 1: Category + Grade */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {/* Category Select */}
                        <div>
                          <label className="form-label text-xs font-semibold">
                            Crop Category <span className="text-red-500">*</span>
                          </label>
                          <select
                            className="form-select text-sm font-medium"
                            value={item.category_id}
                            onChange={e => updateItem(idx, 'category_id', e.target.value)}
                            required
                          >
                            <option value="">— Select category —</option>
                            {categories.map((c: any) => {
                              const stock = getAvailableStock(c.id);
                              return (
                                <option key={c.id} value={c.id}>
                                  {formatCategoryName(c)}
                                  {stock > 0 ? ` (${stock.toLocaleString()} kg)` : ' (unavailable)'}
                                </option>
                              );
                            })}
                          </select>
                          {/* Grade-wise stock badges */}
                          {item.category_id && gradeStocks && (
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              {(['grade_a', 'grade_b', 'grade_c'] as const).map(g => (
                                <span
                                  key={g}
                                  className={`inline-flex items-center gap-1 text-2xs px-2 py-0.5 rounded-full font-semibold border ${
                                    g === (item.grade || 'grade_a')
                                      ? 'bg-primary-100 text-primary-700 border-primary-200'
                                      : 'bg-surface-100 text-surface-500 border-surface-200'
                                  }`}
                                >
                                  <Package size={9} />
                                  {g === 'grade_a' ? 'A' : g === 'grade_b' ? 'B' : 'C'}: {gradeStocks[g].toLocaleString()} kg
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Grade Select */}
                        <div>
                          <label className="form-label text-xs font-semibold">Quality Grade</label>
                          <select
                            className="form-select text-sm"
                            value={item.grade || 'grade_a'}
                            onChange={e => updateItem(idx, 'grade', e.target.value)}
                          >
                            <option value="grade_a">⭐ Grade A — Premium Quality</option>
                            <option value="grade_b">✅ Grade B — Standard Quality</option>
                            <option value="grade_c">🔧 Grade C — Processing Grade</option>
                          </select>
                        </div>
                      </div>

                      {/* Row 2: Product/Variety (dynamic — only shown when category selected) */}
                      {item.category_id && (
                        <div className="border border-emerald-100 bg-emerald-50/50 rounded-xl p-3">
                          <VarietySelector
                            categoryId={item.category_id}
                            value={item.variety_id || ''}
                            onChange={varId => updateItem(idx, 'variety_id', varId)}
                            inventoryData={inventorySummary.find((s: any) => s.category_id === item.category_id)}
                          />
                          {selectedCat && (
                            <p className="text-2xs text-emerald-700 mt-2 flex items-center gap-1">
                              <CheckCircle2 size={10} />
                              Viewing products under: <strong>{formatCategoryName(selectedCat)}</strong>
                            </p>
                          )}
                        </div>
                      )}

                      {/* Row 3: Quantity */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="form-label text-xs font-semibold">
                            Quantity (kg) <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="number"
                            step="1"
                            min="1"
                            className={`form-input text-sm font-semibold ${exceedsStock ? 'border-red-400 bg-red-50' : ''}`}
                            placeholder="e.g. 100"
                            value={item.requested_qty_kg}
                            onChange={e => updateItem(idx, 'requested_qty_kg', e.target.value)}
                            required
                          />
                          {exceedsStock && (
                            <p className="text-2xs text-red-600 mt-1 flex items-center gap-1">
                              <AlertCircle size={11} />
                              Exceeds available stock ({availableStock.toLocaleString()} kg for {item.grade?.replace('_', ' ') || 'Grade A'})
                            </p>
                          )}
                          {availableStock > 0 && !exceedsStock && item.requested_qty_kg && (
                            <p className="text-2xs text-emerald-600 mt-1">
                              {(availableStock - requestedQty).toLocaleString()} kg remaining after this order
                            </p>
                          )}
                        </div>

                        <div>
                          <label className="form-label text-xs font-semibold">Unit Price (LKR/kg)</label>
                          <div className="form-input text-sm bg-surface-50 text-surface-700 flex items-center justify-between">
                            <span className="font-semibold">{suggestedPrice > 0 ? `LKR ${suggestedPrice.toLocaleString()}` : 'Set at approval'}</span>
                            <span className="text-2xs text-surface-400">fixed by the centre</span>
                          </div>
                        </div>
                      </div>

                      {/* Line Total */}
                      <div className="flex items-center justify-between pt-2 border-t border-surface-200/60 text-xs">
                        <span className="text-surface-500">
                          Unit Price: <strong className="text-surface-800">LKR {suggestedPrice || '—'}/kg</strong>
                          {suggestedPrice > 0 && (
                            <span className="ml-1.5 text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded text-2xs">Market Rate</span>
                          )}
                        </span>
                        <span className="font-bold text-surface-900 text-sm">
                          Subtotal: {lineTotal > 0 ? `LKR ${lineTotal.toLocaleString()}` : '—'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section: Delivery & Centre */}
          <div className="card p-6 space-y-4">
            <h2 className="text-base font-bold text-surface-900 pb-2 border-b border-surface-100 flex items-center gap-2">
              <MapPin size={18} className="text-primary-600" /> Delivery & Destination
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="form-label text-xs flex items-center gap-1 font-semibold">
                  <Building2 size={13} className="text-primary-600" /> Collection Centre <span className="text-red-500">*</span>
                </label>
                <select
                  className={`form-select text-sm ${!centreId ? 'border-amber-300 bg-amber-50/20' : ''}`}
                  value={centreId}
                  onChange={e => setCentreId(e.target.value)}
                  required
                >
                  <option value="">Select Collection Centre *</option>
                  {centres.map((c: any) => (
                    <option key={c.id} value={c.id}>{c.name} ({c.district})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="form-label text-xs flex items-center gap-1">
                  <Calendar size={13} /> Requested Date
                </label>
                <input
                  type="date"
                  className="form-input text-sm"
                  value={requestedDate}
                  onChange={e => setRequestedDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
            </div>

            <div>
              <label className="form-label text-xs font-semibold">
                Delivery Address <span className="text-red-500">*</span>
              </label>
              <textarea
                className={`form-input text-sm ${!deliveryAddress.trim() ? 'border-amber-300 bg-amber-50/20' : ''}`}
                rows={2}
                placeholder="Enter warehouse or delivery location address *"
                value={deliveryAddress}
                onChange={e => setDeliveryAddress(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="form-label text-xs">Special Instructions & Notes</label>
              <textarea
                className="form-input text-sm"
                rows={2}
                placeholder="Any special packing, packaging, or handling instructions..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Right 1 Col: Summary */}
        <div className="space-y-6">
          <div className="card p-6 space-y-5 sticky top-24 bg-gradient-to-b from-white to-surface-50">
            <h3 className="text-base font-bold text-surface-900 border-b border-surface-100 pb-3 flex items-center gap-2">
              <DollarSign size={18} className="text-primary-600" /> Order Summary
            </h3>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between text-surface-600">
                <span>Total Items:</span>
                <span className="font-semibold text-surface-800">{items.length} line items</span>
              </div>
              <div className="flex justify-between text-surface-600">
                <span>Total Quantity:</span>
                <span className="font-semibold text-surface-800">
                  {items.reduce((acc, i) => acc + (parseFloat(i.requested_qty_kg) || 0), 0).toLocaleString()} kg
                </span>
              </div>
              <div className="flex justify-between text-surface-600">
                <span>Buyer:</span>
                <span className="font-semibold text-surface-800 truncate max-w-[140px]">
                  {user?.full_name || buyerRecord?.company_name || 'Verified Buyer'}
                </span>
              </div>

              {/* Per-item breakdown */}
              {items.filter(i => i.category_id).map((item, idx) => {
                const cat = categories.find((c: any) => c.id === item.category_id);
                const total = calculateItemTotal(item);
                return total > 0 ? (
                  <div key={idx} className="flex justify-between text-xs text-surface-500 pl-2 border-l-2 border-primary-100">
                    <span className="truncate max-w-[130px]">
                      {cat ? formatCategoryName(cat) : '—'} ({item.grade?.replace('_', ' ')})
                    </span>
                    <span className="font-medium">LKR {total.toLocaleString()}</span>
                  </div>
                ) : null;
              })}

              <div className="pt-3 border-t border-surface-200 flex justify-between items-baseline">
                <span className="text-sm font-semibold text-surface-900">Estimated Total:</span>
                <span className="text-xl font-extrabold text-primary-700 font-display">
                  {grandTotal > 0 ? `LKR ${grandTotal.toLocaleString()}` : '—'}
                </span>
              </div>
            </div>

            <div className="bg-primary-50 rounded-xl p-3.5 border border-primary-100 space-y-1.5 text-xs text-primary-900">
              <p className="font-semibold flex items-center gap-1 text-primary-800">
                <CheckCircle2 size={14} className="text-primary-600" /> Instant Database Sync
              </p>
              <p className="text-surface-600 leading-relaxed">
                Your order is registered immediately and synced to warehouse & inventory management.
              </p>
            </div>

            <div className="space-y-2 pt-2">
              <button
                type="submit"
                disabled={mutation.isPending}
                className="btn-primary w-full py-3 text-base flex items-center justify-center gap-2 shadow-lg shadow-primary-600/20"
              >
                {mutation.isPending ? (
                  <><Loader2 size={18} className="animate-spin" /> Placing Order...</>
                ) : (
                  <><ShoppingCart size={18} /> Confirm & Submit Order</>
                )}
              </button>
              <button
                type="button"
                onClick={() => navigate('/buyer/orders')}
                className="btn-secondary w-full text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};
