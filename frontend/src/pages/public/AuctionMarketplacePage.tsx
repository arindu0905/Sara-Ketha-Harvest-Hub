import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Filter, Clock, TrendingUp, Package, ChevronRight, Bell, Star } from 'lucide-react';
import { useAuctions } from '../../hooks/useAuction';
import { useAuctionCountdown, formatCountdown } from '../../hooks/useAuctionCountdown';
import {
  formatLKR, formatDateTimeSL, auctionStatusLabel, gradeLabel, formatUnit
} from '../../utils/lkrFormat';
import type { Auction } from '../../types/auction';

// ─── Status filter tabs ───────────────────────────────────────────────────────

const STATUS_TABS = [
  { key: '',           label: 'All Auctions' },
  { key: 'open',       label: '🟢 Live Now'   },
  { key: 'scheduled',  label: '⏰ Upcoming'    },
  { key: 'completed',  label: '✓ Results'      },
];

// ─── Countdown badge ─────────────────────────────────────────────────────────

function CountdownBadge({ endAt, status }: { endAt: string; status: string }) {
  const cd = useAuctionCountdown(status === 'open' ? endAt : undefined);
  if (status !== 'open') return null;
  if (cd.expired) return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
      Ended
    </span>
  );
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
      cd.finalMinutes
        ? 'bg-red-100 text-red-700 animate-pulse'
        : 'bg-emerald-100 text-emerald-700'
    }`}>
      <Clock size={11} />
      {formatCountdown(cd)}
    </span>
  );
}

// ─── Auction card ─────────────────────────────────────────────────────────────

function AuctionCard({ auction }: { auction: Auction }) {
  const sl = auctionStatusLabel(auction.status);
  const firstLot = auction.auction_lots?.[0];

  return (
    <Link
      to={`/auction/${auction.id}`}
      className="group block bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden"
    >
      {/* Status stripe */}
      <div className={`h-1.5 w-full ${
        auction.status === 'open' ? 'bg-gradient-to-r from-emerald-400 to-green-500' :
        auction.status === 'scheduled' ? 'bg-gradient-to-r from-blue-400 to-indigo-500' :
        'bg-gray-200'
      }`} />

      <div className="p-5">
        {/* Header row */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${sl.bg} ${sl.color}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${sl.dot}`} />
              {sl.label}
            </span>
            {auction.status === 'open' && (
              <CountdownBadge endAt={auction.end_at} status={auction.status} />
            )}
          </div>
          <span className="text-xs text-gray-400 font-mono">{auction.auction_number}</span>
        </div>

        {/* Title */}
        <h3 className="font-semibold text-gray-900 text-base leading-snug mb-1 group-hover:text-emerald-700 transition-colors line-clamp-2">
          {auction.title}
        </h3>
        <p className="text-xs text-gray-500 mb-4">{auction.centre_name} · {auction.centre_district}</p>

        {/* Lot summary */}
        {firstLot && (
          <div className="flex items-center gap-3 mb-4">
            <div className={`px-2 py-0.5 rounded-md text-xs font-medium ${gradeLabel(firstLot.quality_grade).bg} ${gradeLabel(firstLot.quality_grade).color}`}>
              {gradeLabel(firstLot.quality_grade).label}
            </div>
            <span className="text-xs text-gray-500">{firstLot.crop_categories?.name}</span>
            <span className="text-xs text-gray-400">{formatUnit(firstLot.lot_quantity, firstLot.unit)}</span>
          </div>
        )}

        {/* Price & stats */}
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs text-gray-400 mb-0.5">
              {auction.status === 'open' ? 'Current Highest Bid' : 'Starting Price'}
            </p>
            <p className="text-xl font-bold text-emerald-700">
              {formatLKR(auction.starting_price)}
              <span className="text-xs font-normal text-gray-400 ml-1">/ kg</span>
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-400">
            {auction.total_bids != null && (
              <span className="flex items-center gap-1">
                <TrendingUp size={12} /> {auction.total_bids} bids
              </span>
            )}
            {auction.total_lots != null && (
              <span className="flex items-center gap-1">
                <Package size={12} /> {auction.total_lots} lots
              </span>
            )}
          </div>
        </div>

        {/* Times */}
        <div className="mt-4 pt-4 border-t border-gray-50 flex items-center justify-between text-xs text-gray-400">
          <span>
            {auction.status === 'scheduled'
              ? `Opens: ${formatDateTimeSL(auction.start_at)}`
              : `Closes: ${formatDateTimeSL(auction.end_at)}`}
          </span>
          <span className="flex items-center gap-1 text-emerald-600 font-medium group-hover:gap-2 transition-all">
            View <ChevronRight size={12} />
          </span>
        </div>
      </div>
    </Link>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function AuctionMarketplacePage() {
  const [activeTab, setActiveTab]   = useState('open');
  const [search, setSearch]         = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [grade, setGrade]           = useState('');

  const { data: auctions = [], isLoading } = useAuctions(
    activeTab ? { status: activeTab, limit: 50 } : { limit: 50 }
  );

  const filtered = auctions.filter((a) => {
    if (search && !a.title.toLowerCase().includes(search.toLowerCase()) &&
        !a.centre_name?.toLowerCase().includes(search.toLowerCase())) return false;
    if (grade && a.auction_lots?.some((l) => l.quality_grade === grade) === false) return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-green-50/30 to-emerald-50/20">
      {/* Hero */}
      <div className="bg-gradient-to-r from-emerald-800 to-green-700 text-white py-16 px-4">
        <div className="max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-white/15 rounded-full px-4 py-1.5 text-sm mb-5 backdrop-blur-sm">
            <Star size={14} className="text-yellow-300" />
            Sri Lankan Agricultural Produce Auction
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold mb-4 leading-tight">
            Buyer Bidding<br />Marketplace
          </h1>
          <p className="text-emerald-100 text-lg max-w-xl mx-auto">
            Bid competitively on verified, quality-graded Sri Lankan agricultural produce
            directly from certified collection centres.
          </p>

          {/* Search bar */}
          <div className="mt-8 max-w-xl mx-auto flex items-center bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 overflow-hidden">
            <Search size={18} className="ml-4 text-white/60 flex-shrink-0" />
            <input
              type="text"
              placeholder="Search auctions by crop, centre..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent px-4 py-3.5 text-white placeholder-white/50 outline-none text-sm"
            />
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="px-4 py-3.5 border-l border-white/20 text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            >
              <Filter size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Filter row */}
      {showFilters && (
        <div className="bg-white border-b border-gray-100 px-4 py-3">
          <div className="max-w-5xl mx-auto flex flex-wrap gap-3 items-center">
            <span className="text-sm font-medium text-gray-600">Filter by grade:</span>
            {['', 'grade_a', 'grade_b', 'grade_c'].map((g) => (
              <button
                key={g}
                onClick={() => setGrade(g)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all border ${
                  grade === g
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'border-gray-200 text-gray-600 hover:border-emerald-400'
                }`}
              >
                {g === '' ? 'All Grades' : gradeLabel(g).label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-30 shadow-sm">
        <div className="max-w-5xl mx-auto px-4">
          <div className="flex overflow-x-auto scrollbar-none">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-shrink-0 px-5 py-4 text-sm font-medium border-b-2 transition-all ${
                  activeTab === tab.key
                    ? 'border-emerald-600 text-emerald-700'
                    : 'border-transparent text-gray-500 hover:text-gray-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 py-8">
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl h-64 animate-pulse border border-gray-100" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-20 h-20 mx-auto bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
              <Package size={32} className="text-gray-400" />
            </div>
            <p className="text-gray-500 text-lg font-medium">No auctions found</p>
            <p className="text-gray-400 text-sm mt-1">Try adjusting your filters or check back soon.</p>
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-400 mb-5">
              {filtered.length} auction{filtered.length !== 1 ? 's' : ''} found
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {filtered.map((a) => <AuctionCard key={a.id} auction={a} />)}
            </div>
          </>
        )}
      </div>

      {/* CTA for unauthenticated users */}
      <div className="max-w-5xl mx-auto px-4 pb-12">
        <div className="bg-gradient-to-r from-emerald-700 to-green-600 rounded-3xl p-8 text-white text-center">
          <Bell size={32} className="mx-auto mb-3 text-emerald-200" />
          <h2 className="text-2xl font-bold mb-2">Ready to bid on fresh Sri Lankan produce?</h2>
          <p className="text-emerald-100 mb-6 max-w-md mx-auto">
            Register as a verified buyer to participate in competitive agricultural produce auctions.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link
              to="/register"
              className="bg-white text-emerald-700 font-semibold px-6 py-2.5 rounded-xl hover:bg-emerald-50 transition-colors"
            >
              Register as Buyer
            </Link>
            <Link
              to="/login"
              className="border border-white/40 text-white font-medium px-6 py-2.5 rounded-xl hover:bg-white/10 transition-colors"
            >
              Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
