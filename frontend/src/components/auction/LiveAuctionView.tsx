import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { auctionApi } from '../../services/auctionApi';
import { formatLKR, formatDateTimeSL, auctionStatusLabel } from '../../utils/lkrFormat';
import { useAuctionCountdown, formatCountdown } from '../../hooks/useAuctionCountdown';
import { Gavel, Clock, Eye, TrendingUp, Search, Wifi } from 'lucide-react';

const POLL_MS = 15_000;

// v_auction_summary view fields used here:
//   id, auction_number, title, status, start_at, end_at,
//   centre_name, centre_district, total_lots, open_lots, total_bids,
//   starting_price, minimum_increment

function AuctionCountdown({ endAt, status }: { endAt: string; status: string }) {
  const cd = useAuctionCountdown(status === 'open' ? endAt : undefined);
  if (status !== 'open') return null;
  return (
    <span className={`flex items-center gap-1 text-sm font-bold ${cd.finalMinutes ? 'text-red-600 animate-pulse' : 'text-emerald-700'}`}>
      <Clock size={13} /> {cd.expired ? 'Ending...' : formatCountdown(cd)}
    </span>
  );
}

interface LiveAuctionViewProps {
  role: 'farmer' | 'buyer';
  basePath: string; // e.g. '/farmer' or '/buyer'
}

export const LiveAuctionView: React.FC<LiveAuctionViewProps> = ({ role, basePath }) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'open' | 'scheduled' | 'all'>('open');
  const effectiveFilter = role === 'farmer' ? 'open' : statusFilter; // farmers only ever see live auctions

  const { data: res, isLoading } = useQuery({
    queryKey: ['live-auctions', effectiveFilter],
    queryFn: () => auctionApi.list(
      effectiveFilter === 'all'
        ? { limit: 100 } as any
        : { status: effectiveFilter, limit: 100 } as any
    ),
    refetchInterval: POLL_MS,
  });

  const allAuctions: any[] = res?.data?.data ?? [];

  const auctions = allAuctions.filter((a: any) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return a.title?.toLowerCase().includes(q) || a.auction_number?.toLowerCase().includes(q);
  });

  const liveCount = allAuctions.filter((a: any) => a.status === 'open').length;

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl mx-auto p-6 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 flex items-center gap-2">
            <Gavel className="text-primary-600" size={24} /> Live Auctions
          </h1>
          <p className="text-sm text-surface-500 mt-1">
            {role === 'farmer'
              ? 'Auctions that are live right now. You can watch the bidding; only buyers can bid.'
              : 'Browse and bid on live produce auctions. Refreshes every 15 seconds.'}
          </p>
        </div>
        {liveCount > 0 && (
          <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 px-4 py-2 rounded-full text-sm font-semibold">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            <Wifi size={14} /> {liveCount} Live Now
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
          <input
            type="text"
            className="form-input pl-9 text-sm"
            placeholder="Search auctions by title or number..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        {role !== 'farmer' && <div className="flex gap-1 bg-surface-100 rounded-xl p-1">
          {[
            { key: 'open',      label: 'Live' },
            { key: 'scheduled', label: 'Upcoming' },
            { key: 'all',       label: 'All' },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setStatusFilter(t.key as any)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${statusFilter === t.key ? 'bg-white shadow-sm text-primary-700' : 'text-surface-500 hover:text-surface-700'}`}
            >
              {t.label}
            </button>
          ))}
        </div>}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-4">{[...Array(4)].map((_, i) => <div key={i} className="card h-32 animate-pulse" />)}</div>
      ) : auctions.length === 0 ? (
        <div className="card p-12 text-center">
          <Gavel size={40} className="mx-auto mb-3 text-surface-300" />
          <h3 className="font-semibold text-surface-700">No auctions found</h3>
          <p className="text-sm text-surface-400 mt-1">
            {effectiveFilter === 'open' ? 'No live auctions at the moment. Check back soon!' : 'No upcoming auctions scheduled.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {auctions.map((auction: any) => {
            const sl = auctionStatusLabel(auction.status);
            return (
              <div
                key={auction.id}
                className={`card p-5 border-l-4 hover:shadow-md transition-all ${auction.status === 'open' ? 'border-l-emerald-500' : 'border-l-blue-400'}`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${sl.bg} ${sl.color}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${sl.dot} ${auction.status === 'open' ? 'animate-pulse' : ''}`} />
                            {sl.label}
                          </span>
                          <span className="text-xs text-surface-400 font-mono">{auction.auction_number}</span>
                        </div>
                        <h3 className="font-bold text-surface-900 text-base">{auction.title}</h3>
                        <p className="text-xs text-surface-500 mt-0.5">
                          {auction.centre_name}{auction.centre_district ? ` · ${auction.centre_district}` : ''}
                        </p>
                      </div>
                      <AuctionCountdown endAt={auction.end_at} status={auction.status} />
                    </div>

                    {/* Lot & bid summary */}
                    <div className="flex flex-wrap gap-3 text-sm mb-3">
                      <div className="flex items-center gap-1.5 bg-surface-50 rounded-lg px-3 py-1.5">
                        <Gavel size={12} className="text-surface-400" />
                        <span className="text-surface-700 font-medium">{auction.total_lots ?? 0} lots</span>
                        {(auction.open_lots ?? 0) > 0 && (
                          <>
                            <span className="text-surface-400">·</span>
                            <span className="text-xs font-bold text-emerald-700">{auction.open_lots} open</span>
                          </>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 bg-surface-50 rounded-lg px-3 py-1.5">
                        <TrendingUp size={12} className="text-surface-400" />
                        <span className="text-surface-700 font-medium">{auction.total_bids ?? 0} bids</span>
                      </div>
                      <div className="flex items-center gap-1.5 bg-surface-50 rounded-lg px-3 py-1.5">
                        <span className="text-xs font-bold text-emerald-700">
                          Starting: {formatLKR(auction.starting_price)}/kg
                        </span>
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-surface-400">
                        {auction.status === 'open'
                          ? `Ends: ${formatDateTimeSL(auction.end_at)}`
                          : `Opens: ${formatDateTimeSL(auction.start_at)}`}
                      </p>
                      <Link
                        to={`${basePath}/auction/${auction.id}`}
                        className="btn-primary text-xs py-2 px-4 flex items-center gap-1"
                      >
                        <Eye size={12} />
                        {role === 'buyer' && auction.status === 'open' ? 'Bid Now' : role === 'farmer' ? 'Watch live' : 'View Auction'}
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
