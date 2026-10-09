import React, { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { inventoryApi } from '../../services/api';
import apiClient from '../../services/apiClient';
import { useAuth } from '../../contexts/AuthContext';
import {
  ArrowLeft, Camera, Trash2, Plus, Search, CheckCircle,
  Package, Leaf, AlertCircle, Gavel
} from 'lucide-react';
import toast from 'react-hot-toast';

const GRADE_COLORS: Record<string, string> = {
  grade_a: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  grade_b: 'bg-blue-100 text-blue-800 border-blue-200',
  grade_c: 'bg-amber-100 text-amber-800 border-amber-200',
  rejected: 'bg-red-100 text-red-800 border-red-200',
};

export const CreateLiveAuction: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const preselectedCollectionId = searchParams.get('collection_id') ?? searchParams.get('batch_id');

  // Form state
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  const [batchSearch, setBatchSearch] = useState('');
  const [title, setTitle] = useState('');
  const [startAt, setStartAt] = useState(() => {
    const d = new Date(); d.setMinutes(d.getMinutes() + 5);
    return d.toISOString().slice(0, 16);
  });
  const [endAt, setEndAt] = useState(() => {
    const d = new Date(); d.setHours(d.getHours() + 24);
    return d.toISOString().slice(0, 16);
  });
  const [startingPrice, setStartingPrice] = useState('');
  const [minIncrement, setMinIncrement] = useState('10');
  const [images, setImages] = useState<{ storage_path: string; file_name: string }[]>([]);
  const [imageUrlInput, setImageUrlInput] = useState('');

  // Load available (graded) inventory batches
  const { data: inventoryRes, isLoading: loadingBatches } = useQuery({
    queryKey: ['inventory-available-graded'],
    queryFn: () => inventoryApi.getAll({ status: 'available' }),
  });

  const batches: any[] = inventoryRes?.data?.data ?? [];

  // Filter batches
  const filteredBatches = useMemo(() => {
    const q = batchSearch.toLowerCase();
    return batches.filter(b =>
      !q ||
      b.batch_no?.toLowerCase().includes(q) ||
      b.crop_categories?.name?.toLowerCase().includes(q) ||
      b.grade?.toLowerCase().includes(q)
    );
  }, [batches, batchSearch]);

  // Auto-select if collection_id param provided
  const selectedBatch = useMemo(() => {
    if (selectedBatchId) return batches.find(b => b.id === selectedBatchId);
    if (preselectedCollectionId) return batches.find(b => b.collection_id === preselectedCollectionId || b.id === preselectedCollectionId);
    return null;
  }, [batches, selectedBatchId, preselectedCollectionId]);

  const addImage = () => {
    if (!imageUrlInput.trim()) return;
    setImages([...images, { storage_path: imageUrlInput.trim(), file_name: `Photo ${images.length + 1}` }]);
    setImageUrlInput('');
  };

  const removeImage = (idx: number) => setImages(images.filter((_, i) => i !== idx));

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!selectedBatch) throw new Error('Select an inventory batch');

      // Get centre_id for this batch via collection
      let centreId = selectedBatch.centre_id ?? selectedBatch.collection_centre_id;
      if (!centreId && selectedBatch.collection_id) {
        const collRes = await apiClient.get(`/collections/${selectedBatch.collection_id}`);
        centreId = collRes.data?.data?.centre_id ?? collRes.data?.data?.collection_centre_id;
      }

      if (!centreId) throw new Error('Could not determine collection centre for this batch. Please ensure the batch has a linked collection.');

      // 1. Create Auction (draft)
      const auctionRes = await apiClient.post('/auctions', {
        collection_centre_id: centreId,
        auction_type: 'open_ascending',
        title: title || `Live Auction — ${selectedBatch.crop_categories?.name ?? 'Produce'}`,
        start_at: new Date(startAt).toISOString(),
        end_at: new Date(endAt).toISOString(),
        starting_price: Number(startingPrice),
        minimum_increment: Number(minIncrement) || 10,
        payment_deadline_hours: 24,
        auto_extension_enabled: true,
        extension_minutes: 5,
      });

      const auctionId = auctionRes.data.data.id;

      // 2. Create Lot with images
      await apiClient.post(`/auctions/${auctionId}/lots`, {
        inventory_batch_id: selectedBatch.id,
        crop_category_id: selectedBatch.category_id ?? selectedBatch.crop_category_id,
        crop_variety_id: selectedBatch.variety_id ?? null,
        quality_grade: selectedBatch.grade,
        lot_quantity: selectedBatch.available_qty_kg ?? selectedBatch.net_weight_kg,
        unit: 'kg',
        starting_price_per_unit: Number(startingPrice),
        origin_district: selectedBatch.origin_district ?? null,
        images: images.map((img, idx) => ({ ...img, sort_order: idx })),
      });

      // 3. Publish → Open (triggers farmer notification)
      await apiClient.post(`/auctions/${auctionId}/publish`);
      await apiClient.post(`/auctions/${auctionId}/open`);

      return auctionId;
    },
    onSuccess: (auctionId) => {
      toast.success('Live Auction started! Farmer has been notified.');
      const basePath = user?.role === 'quality_inspector' ? '/inspector' : '/officer';
      navigate(`${basePath}/notifications`);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || err.message || 'Failed to start live auction');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBatch) return toast.error('Please select a graded stock batch');
    if (!startingPrice || Number(startingPrice) <= 0) return toast.error('Enter a valid starting price');
    if (images.length === 0) return toast.error('At least one photo is required for a live auction');
    createMutation.mutate();
  };

  const roleBasePath = user?.role === 'quality_inspector' ? '/inspector' : '/officer';

  return (
    <div className="space-y-6 animate-fade-in pb-16 max-w-4xl mx-auto p-6">
      {/* Back */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="btn-ghost p-2 rounded-xl text-surface-600 hover:text-surface-900">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-surface-900 flex items-center gap-2">
            <Gavel className="text-primary-600" size={22} /> Start Live Auction
          </h1>
          <p className="text-sm text-surface-500">Select a graded stock batch, add photos and launch auction. The farmer will be notified immediately.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* ── Step 1: Select batch ─────────────────────────────────── */}
        <div className="card p-6 space-y-4">
          <h3 className="font-semibold text-surface-900 border-b pb-2 flex items-center gap-2">
            <Package size={16} className="text-primary-600" /> Step 1: Select Graded Stock
          </h3>

          {selectedBatch ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-bold text-emerald-900">{selectedBatch.batch_no}</p>
                  <p className="text-xs text-emerald-700">{selectedBatch.crop_categories?.name}</p>
                </div>
                <button
                  type="button"
                  onClick={() => { setSelectedBatchId(''); }}
                  className="text-xs text-emerald-600 underline"
                >
                  Change
                </button>
              </div>
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div>
                  <span className="block text-xs text-emerald-600/70">Grade</span>
                  <span className={`inline-block mt-0.5 px-2 py-0.5 rounded-lg border text-xs font-bold ${GRADE_COLORS[selectedBatch.grade] ?? 'bg-gray-100 text-gray-700'}`}>
                    {selectedBatch.grade?.replace('_', ' ').toUpperCase()}
                  </span>
                </div>
                <div>
                  <span className="block text-xs text-emerald-600/70">Available Qty</span>
                  <span className="font-bold">{selectedBatch.available_qty_kg ?? selectedBatch.net_weight_kg} kg</span>
                </div>
                <div>
                  <span className="block text-xs text-emerald-600/70">Farmer</span>
                  <span className="font-medium text-sm">{selectedBatch.farmers?.full_name ?? '—'}</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 mt-3 text-xs text-emerald-700">
                <CheckCircle size={13} /> This batch is eligible for auction
              </div>
            </div>
          ) : (
            <>
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
                <input
                  type="text"
                  className="form-input pl-9"
                  placeholder="Search by batch no, crop, or grade..."
                  value={batchSearch}
                  onChange={e => setBatchSearch(e.target.value)}
                />
              </div>

              {loadingBatches ? (
                <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-16 rounded-xl animate-pulse bg-surface-100" />)}</div>
              ) : filteredBatches.length === 0 ? (
                <div className="text-center py-8 text-surface-400">
                  <Package size={32} className="mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No available graded batches found.</p>
                  <p className="text-xs mt-1">Ensure stock has been weighed and graded before creating an auction.</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {filteredBatches.map(b => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => setSelectedBatchId(b.id)}
                      className="w-full text-left p-4 rounded-xl border border-surface-200 hover:border-primary-400 hover:bg-primary-50/40 transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-surface-900 text-sm">{b.batch_no}</p>
                          <p className="text-xs text-surface-500">{b.crop_categories?.name} · {b.farmers?.full_name}</p>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <span className={`px-2 py-0.5 rounded-lg border font-bold ${GRADE_COLORS[b.grade] ?? 'bg-gray-100 text-gray-700'}`}>
                            {b.grade?.replace('_', ' ').toUpperCase()}
                          </span>
                          <span className="text-surface-600 font-medium">{b.available_qty_kg ?? b.net_weight_kg} kg</span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Step 2: Auction details ───────────────────────────────── */}
        {selectedBatch && (
          <div className="card p-6 space-y-4">
            <h3 className="font-semibold text-surface-900 border-b pb-2 flex items-center gap-2">
              <Gavel size={16} className="text-primary-600" /> Step 2: Auction Details
            </h3>

            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1">Auction Title</label>
              <input
                type="text"
                className="form-input"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder={`Live Auction — ${selectedBatch.crop_categories?.name}`}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-surface-700 mb-1">Start Time *</label>
                <input type="datetime-local" className="form-input" value={startAt} onChange={e => setStartAt(e.target.value)} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-surface-700 mb-1">End Time *</label>
                <input type="datetime-local" className="form-input" value={endAt} onChange={e => setEndAt(e.target.value)} required />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-surface-700 mb-1">Starting Price (LKR/kg) *</label>
                <input type="number" step="0.01" min="1" className="form-input" value={startingPrice} onChange={e => setStartingPrice(e.target.value)} placeholder="e.g. 150" required />
                <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                  <AlertCircle size={11} /> Farmer can adjust base price after notification.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-surface-700 mb-1">Min. Bid Increment (LKR)</label>
                <input type="number" step="1" min="1" className="form-input" value={minIncrement} onChange={e => setMinIncrement(e.target.value)} placeholder="10" />
              </div>
            </div>
          </div>
        )}

        {/* ── Step 3: Photos ────────────────────────────────────────── */}
        {selectedBatch && (
          <div className="card p-6 space-y-4">
            <h3 className="font-semibold text-surface-900 border-b pb-2 flex items-center gap-2">
              <Camera size={16} className="text-primary-600" /> Step 3: Add Produce Photos *
            </h3>
            <p className="text-xs text-surface-500">Photos are visible to all buyers. Add clear images of the graded produce.</p>

            <div className="flex gap-2">
              <input
                type="url"
                className="form-input flex-1"
                placeholder="Paste image URL (e.g. https://...)"
                value={imageUrlInput}
                onChange={e => setImageUrlInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addImage())}
              />
              <button type="button" onClick={addImage} className="btn-secondary whitespace-nowrap flex items-center gap-1">
                <Plus size={14} /> Add
              </button>
            </div>

            {images.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {images.map((img, idx) => (
                  <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border border-surface-200 group shadow-sm">
                    <img
                      src={img.storage_path}
                      alt="Produce"
                      className="w-full h-full object-cover"
                      onError={e => (e.currentTarget.src = 'https://placehold.co/200x200?text=Invalid')}
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(idx)}
                      className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity shadow"
                    >
                      <Trash2 size={12} />
                    </button>
                    <span className="absolute bottom-1 left-1 bg-black/50 text-white text-xs px-1.5 py-0.5 rounded-md">#{idx + 1}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 bg-surface-50 border-2 border-dashed border-surface-200 rounded-2xl">
                <Camera size={32} className="mx-auto mb-2 text-surface-300" />
                <p className="text-sm text-surface-500">No photos added yet. Photos are required.</p>
              </div>
            )}
          </div>
        )}

        {/* Submit */}
        {selectedBatch && (
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="btn-primary w-full py-4 text-base font-bold flex items-center justify-center gap-2"
          >
            <Gavel size={18} />
            {createMutation.isPending ? 'Starting Auction & Notifying Farmer...' : 'Start Live Auction & Notify Farmer'}
          </button>
        )}
      </form>
    </div>
  );
};
