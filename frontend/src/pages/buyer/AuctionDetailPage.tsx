import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Clock, TrendingUp, ChevronDown, ChevronUp,
  MapPin, Calendar, Leaf, Award, Star, Info, Gavel
} from 'lucide-react';
import { useAuction, useAuctionBids, usePlaceBid, useToggleWatchlist, useWatchlist } from '../../hooks/useAuction';
import { useAuctionCountdown, formatCountdown } from '../../hooks/useAuctionCountdown';
import { useAuth } from '../../contexts/AuthContext';
import {
  formatLKR, formatDateTimeSL, auctionStatusLabel, gradeLabel,
  formatUnit, formatRelative
} from '../../utils/lkrFormat';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

// ─── Bid form schema ──────────────────────────────────────────────────────────

const BidSchema = z.object({
  bid_amount_per_unit: z.number({ invalid_type_error: 'Enter a bid amount' }).positive('Must be positive'),
  bid_quantity:        z.number({ invalid_type_error: 'Enter quantity' }).positive('Must be positive'),
});

type BidForm = z.infer<typeof BidSchema>;

// ─── Lot bid panel ────────────────────────────────────────────────────────────

function LotBidPanel({ lot, auctionId, minIncrement, isOpen, paymentDeadlineHours }: {
  lot: any; auctionId: string; minIncrement: number; isOpen: boolean; paymentDeadlineHours: number;
}) {
  const { user } = useAuth();
  const { mutate: placeBid, isPending } = usePlaceBid(auctionId, lot.id);
  const minBid = lot.current_price_per_unit + minIncrement;

  const { register, handleSubmit, watch, formState: { errors } } = useForm<BidForm>({
    resolver:     zodResolver(BidSchema),
    defaultValues: { bid_amount_per_unit: minBid, bid_quantity: lot.lot_quantity },
  });

  const bidAmt = watch('bid_amount_per_unit');
  const bidQty = watch('bid_quantity');

  const onSubmit = (data: BidForm) => {
    placeBid(data);
  };

  if (!user || user.role !== 'buyer') {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
        <p className="text-sm text-amber-800 font-medium">Login as a verified buyer to place bids</p>
        <Link to="/login" className="mt-2 inline-block text-sm text-emerald-700 font-semibold hover:underline">
          Sign In →
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Bid Amount (LKR per {lot.unit ?? 'kg'})
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-medium">Rs.</span>
          <input
            type="number"
            step="0.01"
            {...register('bid_amount_per_unit', { valueAsNumber: true })}
            className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-gray-900 font-semibold focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
          />
        </div>
        {errors.bid_amount_per_unit && (
          <p className="text-xs text-red-600 mt-1">{errors.bid_amount_per_unit.message}</p>
        )}
        <p className="text-xs text-gray-400 mt-1">Minimum: {formatLKR(minBid)} per {lot.unit ?? 'kg'}</p>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Quantity ({lot.unit ?? 'kg'})
        </label>
        <input
          type="number"
          step="0.001"
          {...register('bid_quantity', { valueAsNumber: true })}
          className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
        />
        <p className="text-xs text-gray-400 mt-1">Available: {formatUnit(lot.lot_quantity, lot.unit)}</p>
      </div>

      {/* Total preview */}
      <div className="bg-emerald-50 rounded-xl p-3">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Total Bid Value</span>
          <span className="font-bold text-emerald-700">
            {formatLKR((bidAmt || 0) * (bidQty || 0))}
          </span>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          Payment required within {paymentDeadlineHours}h of winning
        </p>
      </div>

      <button
        type="submit"
        disabled={!isOpen || isPending}
        className={`w-full py-3.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${
          isOpen && !isPending
            ? 'bg-gradient-to-r from-emerald-600 to-green-600 text-white hover:from-emerald-700 hover:to-green-700 shadow-lg shadow-emerald-200 hover:shadow-xl hover:shadow-emerald-300 active:scale-95'
            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
        }`}
      >
        <Gavel size={16} />
        {isPending ? 'Placing Bid...' : isOpen ? 'Place Bid' : 'Bidding Closed'}
      </button>

      <p className="text-xs text-gray-400 text-center">
        Bids are binding commitments. By placing a bid you agree to pay if you win.
      </p>
    </form>
  );
}

// ─── Main auction detail page ─────────────────────────────────────────────────

export function AuctionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate  = useNavigate();

  const { data: auction, isLoading } = useAuction(id!);
  const { data: bids = [] }          = useAuctionBids(id!);
  const { data: watchlist = [] }     = useWatchlist();
  const { add: addWatch, remove: removeWatch } = useToggleWatchlist(id!);

  const cd = useAuctionCountdown(auction?.status === 'open' ? auction?.end_at : undefined);

  const isOpen    = auction?.status === 'open';
  const isWatched = watchlist.some((w) => w.auction_id === id);
  const [expandedLot, setExpandedLot] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!auction) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-bold text-gray-700">Auction not found</h2>
          <button onClick={() => navigate(-1)} className="mt-4 text-emerald-600 hover:underline">Go back</button>
        </div>
      </div>
    );
  }

  const sl = auctionStatusLabel(auction.status);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-green-50/20">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-30 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <ArrowLeft size={18} className="text-gray-600" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-400 font-mono">{auction.auction_number}</p>
            <h1 className="font-semibold text-gray-900 text-sm truncate">{auction.title}</h1>
          </div>
          <span className={`hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${sl.bg} ${sl.color}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${sl.dot} ${isOpen ? 'animate-pulse' : ''}`} />
            {sl.label}
          </span>
          {user?.role === 'buyer' && (
            <button
              onClick={() => isWatched ? removeWatch.mutate() : addWatch.mutate()}
              className={`p-2 rounded-lg transition-all ${isWatched ? 'bg-yellow-50 text-yellow-600' : 'hover:bg-gray-100 text-gray-500'}`}
              title={isWatched ? 'Remove from watchlist' : 'Add to watchlist'}
            >
              {isWatched ? <Star size={18} className="fill-yellow-400" /> : <Star size={18} />}
            </button>
          )}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Hero panel */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {/* Live countdown bar */}
          {isOpen && (
            <div className={`px-6 py-3 flex items-center justify-between ${
              cd.finalMinutes
                ? 'bg-red-50 border-b border-red-100'
                : 'bg-emerald-50 border-b border-emerald-100'
            }`}>
              <div className="flex items-center gap-2">
                <Clock size={16} className={cd.finalMinutes ? 'text-red-600 animate-pulse' : 'text-emerald-600'} />
                <span className={`text-sm font-semibold ${cd.finalMinutes ? 'text-red-700' : 'text-emerald-700'}`}>
                  {cd.expired ? 'Bidding Closed' : `Closes in: ${formatCountdown(cd)}`}
                </span>
              </div>
              {!cd.expired && (
                <span className="text-xs text-gray-500">{formatDateTimeSL(auction.end_at)}</span>
              )}
            </div>
          )}

          <div className="p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">{auction.title}</h2>
            {auction.description && (
              <p className="text-gray-500 text-sm mb-4">{auction.description}</p>
            )}

            {/* Meta grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-400 mb-1 flex items-center gap-1"><MapPin size={11} />Centre</p>
                <p className="text-sm font-medium text-gray-900">{auction.collection_centres?.name}</p>
                <p className="text-xs text-gray-500">{auction.collection_centres?.district}</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-400 mb-1 flex items-center gap-1"><TrendingUp size={11} />Min Increment</p>
                <p className="text-sm font-bold text-gray-900">{formatLKR(auction.minimum_increment)}</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-400 mb-1 flex items-center gap-1"><Calendar size={11} />Opens</p>
                <p className="text-sm font-medium text-gray-900">{formatDateTimeSL(auction.start_at)}</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-400 mb-1 flex items-center gap-1"><Clock size={11} />Payment by</p>
                <p className="text-sm font-medium text-gray-900">Within {auction.payment_deadline_hours}h of win</p>
              </div>
            </div>

            {/* Auto-extension notice */}
            {auction.auto_extension_enabled && (
              <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-xl p-3 mb-4">
                <Info size={14} className="text-blue-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-blue-700">
                  <strong>Anti-snipe enabled:</strong> A bid in the final {auction.extension_minutes} minutes will
                  extend the auction by {auction.extension_minutes} minutes.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Lots */}
        <div className="space-y-4">
          <h3 className="font-semibold text-gray-900 text-lg">Auction Lots ({auction.auction_lots?.length ?? 0})</h3>
          {(auction.auction_lots ?? []).map((lot) => {
            const grade = gradeLabel(lot.quality_grade);
            const isExpanded = expandedLot === lot.id;
            return (
              <div key={lot.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                {/* Lot header */}
                <button
                  className="w-full px-6 py-4 flex items-start justify-between hover:bg-gray-50 transition-colors text-left"
                  onClick={() => setExpandedLot(isExpanded ? null : lot.id)}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                        Lot #{lot.lot_number}
                      </span>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${grade.bg} ${grade.color}`}>
                        {grade.label}
                      </span>
                      {lot.lot_status === 'awarded' && (
                        <span className="flex items-center gap-1 text-xs text-emerald-700 font-medium">
                          <Award size={12} /> Awarded
                        </span>
                      )}
                    </div>
                    <p className="font-semibold text-gray-900">
                      {lot.crop_categories?.name}
                      {lot.crop_varieties && <span className="text-gray-500 font-normal"> – {lot.crop_varieties.name}</span>}
                    </p>
                    <p className="text-sm text-gray-500">{formatUnit(lot.lot_quantity, lot.unit)}</p>
                  </div>
                  <div className="text-right ml-4">
                    <p className="text-xs text-gray-400 mb-0.5">Current Price</p>
                    <p className="text-2xl font-extrabold text-emerald-700">{formatLKR(lot.current_price_per_unit)}</p>
                    <p className="text-xs text-gray-400">per {lot.unit ?? 'kg'}</p>
                    {lot.bid_count != null && (
                      <p className="text-xs text-gray-400 mt-1 flex items-center justify-end gap-1">
                        <TrendingUp size={10} /> {lot.bid_count} bids
                      </p>
                    )}
                    {isExpanded ? <ChevronUp size={16} className="text-gray-400 mt-2 ml-auto" /> :
                                  <ChevronDown size={16} className="text-gray-400 mt-2 ml-auto" />}
                  </div>
                </button>

                {/* Expanded: bid form + traceability */}
                {isExpanded && (
                  <div className="border-t border-gray-50 px-6 pb-6 pt-4 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <h4 className="text-sm font-semibold text-gray-700">Traceability</h4>
                      {lot.origin_district && (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <MapPin size={14} className="text-gray-400" />
                          {lot.origin_district}
                        </div>
                      )}
                      {lot.harvest_season && (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Leaf size={14} className="text-gray-400" />
                          {lot.harvest_season}
                        </div>
                      )}
                      {lot.expiry_date && (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Calendar size={14} className="text-gray-400" />
                          Expires: {lot.expiry_date}
                        </div>
                      )}
                      {lot.warehouses && (
                        <div className="text-sm text-gray-500">
                          Stored at: <span className="font-medium">{lot.warehouses.name}</span>
                        </div>
                      )}
                      {/* Lot images */}
                      {lot.auction_lot_images && lot.auction_lot_images.length > 0 && (
                        <div className="flex gap-2 mt-2">
                          {lot.auction_lot_images.slice(0, 4).map((img: any) => (
                            <div key={img.id} className="w-16 h-16 rounded-lg bg-gray-100 overflow-hidden">
                              <img
                                src={`${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/${img.storage_path}`}
                                alt={img.file_name}
                                className="w-full h-full object-cover"
                                onError={(e) => (e.currentTarget.style.display = 'none')}
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 mb-3">
                        {isOpen ? 'Place Your Bid' : 'Bidding Closed'}
                      </h4>
                      <LotBidPanel
                        lot={lot}
                        auctionId={auction.id}
                        minIncrement={auction.minimum_increment}
                        isOpen={isOpen}
                        paymentDeadlineHours={auction.payment_deadline_hours}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Recent bids (public, anonymised) */}
        {bids.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <TrendingUp size={16} className="text-emerald-600" />
              Recent Bids
            </h3>
            <div className="space-y-2">
              {bids.slice(0, 10).map((bid, i) => (
                <div key={bid.id}
                  className={`flex items-center justify-between py-2 px-3 rounded-xl text-sm ${
                    i === 0 ? 'bg-emerald-50' : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {i === 0 && <span className="text-xs bg-emerald-100 text-emerald-700 font-medium px-2 py-0.5 rounded-full">Highest</span>}
                    <span className="text-gray-500 text-xs">Bid #{bid.bid_sequence}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className={`font-bold ${i === 0 ? 'text-emerald-700 text-base' : 'text-gray-700'}`}>
                      {formatLKR(bid.bid_amount_per_unit)}
                    </span>
                    <span className="text-gray-400 text-xs">{formatRelative(bid.bid_time)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
