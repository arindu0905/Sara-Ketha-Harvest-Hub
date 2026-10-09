import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../../services/apiClient';
import { Package, Edit2, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatLKR, formatDateTimeSL, auctionStatusLabel } from '../../utils/lkrFormat';

export const MyProduceAuctions: React.FC = () => {
  const queryClient = useQueryClient();
  const [editingLotId, setEditingLotId] = useState<string | null>(null);
  const [newBasePrice, setNewBasePrice] = useState<string>('');

  const { data: auctionsRes, isLoading } = useQuery({
    queryKey: ['my-produce-auctions'],
    queryFn: () => apiClient.get('/auctions/my-produce'),
  });

  const auctions = auctionsRes?.data?.data || [];

  const updatePriceMutation = useMutation({
    mutationFn: async ({ lotId, price }: { lotId: string; price: number }) => {
      const res = await apiClient.patch(`/auctions/lots/${lotId}/base-price`, { starting_price_per_unit: price });
      return res.data;
    },
    onSuccess: () => {
      toast.success('Base price updated successfully');
      setEditingLotId(null);
      setNewBasePrice('');
      queryClient.invalidateQueries({ queryKey: ['my-produce-auctions'] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || err.message || 'Failed to update base price');
    }
  });

  const handleUpdatePrice = (lotId: string) => {
    const price = parseFloat(newBasePrice);
    if (isNaN(price) || price <= 0) return toast.error('Enter a valid price');
    updatePriceMutation.mutate({ lotId, price });
  };

  if (isLoading) return <div className="p-6"><div className="skeleton h-64 rounded-xl" /></div>;

  return (
    <div className="space-y-6 animate-fade-in pb-12 max-w-5xl mx-auto p-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Live Auctions</h1>
        <p className="text-sm text-gray-500">Manage the base price of your graded stock currently in auction.</p>
      </div>

      {auctions.length === 0 ? (
        <div className="card p-8 text-center text-gray-500 flex flex-col items-center">
          <Package size={32} className="mb-2 opacity-50" />
          <p>No produce in live auctions right now.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {auctions.map((auction: any) => {
            const sl = auctionStatusLabel(auction.status);
            const lot = auction.auction_lots?.[0]; // Usually one lot per farmer auction in this context
            if (!lot) return null;
            
            return (
              <div key={auction.id} className="card p-5 border-l-4" style={{ borderLeftColor: auction.status === 'open' ? '#10b981' : '#f59e0b' }}>
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-semibold text-lg">{auction.title}</h3>
                    <p className="text-xs text-gray-500">{auction.auction_number}</p>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${sl.bg} ${sl.color}`}>
                    {sl.label}
                  </span>
                </div>
                
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm mb-4">
                  <div><span className="block text-xs text-gray-500">Lot Qty</span><span className="font-medium">{lot.lot_quantity} {lot.unit}</span></div>
                  <div><span className="block text-xs text-gray-500">Grade</span><span className="font-medium uppercase">{lot.quality_grade?.replace('_', ' ')}</span></div>
                  <div><span className="block text-xs text-gray-500">Current Base Price</span><span className="font-bold text-emerald-700">{formatLKR(lot.starting_price_per_unit)}/kg</span></div>
                  <div><span className="block text-xs text-gray-500">Highest Bid</span><span className="font-bold text-blue-700">{lot.current_price_per_unit > lot.starting_price_per_unit ? formatLKR(lot.current_price_per_unit) + '/kg' : 'No bids yet'}</span></div>
                </div>

                {/* Only allow edit if no bids or draft/scheduled */}
                {(auction.status === 'draft' || auction.status === 'scheduled' || (auction.status === 'open' && lot.current_price_per_unit === lot.starting_price_per_unit)) && (
                  <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
                    {editingLotId === lot.id ? (
                      <div className="flex items-center gap-2">
                        <input type="number" className="form-input text-sm py-1.5 w-32" value={newBasePrice} onChange={e => setNewBasePrice(e.target.value)} placeholder="New price..." />
                        <button onClick={() => handleUpdatePrice(lot.id)} disabled={updatePriceMutation.isPending} className="btn-primary py-1.5 px-3 text-xs"><Check size={14} /></button>
                        <button onClick={() => setEditingLotId(null)} className="btn-secondary py-1.5 px-3 text-xs">Cancel</button>
                      </div>
                    ) : (
                      <button onClick={() => { setEditingLotId(lot.id); setNewBasePrice(String(lot.starting_price_per_unit)); }} className="flex items-center gap-1 text-emerald-600 text-sm font-medium hover:underline">
                        <Edit2 size={14} /> Update Base Price
                      </button>
                    )}
                    <span className="text-xs text-gray-400">Ends: {formatDateTimeSL(auction.end_at)}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
