import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMyBids } from '../../hooks/useAuction';
import { formatLKR, formatRelative } from '../../utils/lkrFormat';
import { Gavel, TrendingUp, CheckCircle2, XCircle, Clock } from 'lucide-react';

const BID_STATUS_STYLES: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  winning:        { label: 'Winning',  color: 'text-emerald-700', bg: 'bg-emerald-50',  icon: <TrendingUp  size={14} /> },
  outbid:         { label: 'Outbid',   color: 'text-amber-700',   bg: 'bg-amber-50',    icon: <XCircle     size={14} /> },
  accepted:       { label: 'Accepted', color: 'text-blue-700',    bg: 'bg-blue-50',     icon: <CheckCircle2 size={14} /> },
  rejected:       { label: 'Rejected', color: 'text-red-700',     bg: 'bg-red-50',      icon: <XCircle     size={14} /> },
  pending:        { label: 'Pending',  color: 'text-gray-600',    bg: 'bg-gray-50',     icon: <Clock       size={14} /> },
  withdrawn_system:{ label: 'Withdrawn',color: 'text-gray-500',   bg: 'bg-gray-50',     icon: <XCircle     size={14} /> },
};

export function MyBidsPage() {
  const { data: bids = [], isLoading } = useMyBids();
  const [filter, setFilter] = useState('all');

  const filtered = filter === 'all' ? bids : bids.filter((b) => b.status === filter);
  const stats = {
    total:   bids.length,
    winning: bids.filter((b) => b.status === 'winning').length,
    outbid:  bids.filter((b) => b.status === 'outbid').length,
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Gavel size={22} className="text-emerald-600" /> My Bids
        </h1>
        <p className="text-gray-500 text-sm mt-1">Track all your auction bids and their current status.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Bids',    value: stats.total,   color: 'text-gray-900',    bg: 'bg-white' },
          { label: 'Currently Winning', value: stats.winning, color: 'text-emerald-700', bg: 'bg-emerald-50' },
          { label: 'Outbid',        value: stats.outbid,  color: 'text-amber-700',   bg: 'bg-amber-50' },
        ].map((s) => (
          <div key={s.label} className={`${s.bg} rounded-2xl border border-gray-100 p-4 text-center`}>
            <p className={`text-3xl font-extrabold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        {['all', 'winning', 'outbid', 'accepted', 'rejected'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
              filter === f
                ? 'bg-emerald-600 text-white border-emerald-600'
                : 'border-gray-200 text-gray-600 hover:border-emerald-400'
            }`}
          >
            {f === 'all' ? 'All' : BID_STATUS_STYLES[f]?.label ?? f}
          </button>
        ))}
      </div>

      {/* Bids list */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <div key={i} className="bg-white h-20 rounded-2xl animate-pulse border border-gray-100" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
          <Gavel size={32} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500">No bids found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((bid) => {
            const st = BID_STATUS_STYLES[bid.status] ?? BID_STATUS_STYLES.pending;
            return (
              <div key={bid.id} className="bg-white rounded-2xl border border-gray-100 p-4 hover:shadow-md transition-all">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${st.bg} ${st.color}`}>
                        {st.icon} {st.label}
                      </span>
                      <span className="text-xs text-gray-400 font-mono">
                        #{bid.auctions?.auction_number}
                      </span>
                    </div>
                    <Link
                      to={`/buyer/auction/${bid.auction_id}`}
                      className="font-semibold text-gray-900 hover:text-emerald-700 transition-colors text-sm"
                    >
                      {bid.auctions?.title ?? 'Auction'}
                    </Link>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Lot #{bid.auction_lots?.lot_number} · {bid.auction_lots?.quality_grade?.replace('_', ' ').toUpperCase()}
                      &nbsp;· {formatRelative(bid.bid_time)}
                    </p>
                  </div>
                  <div className="text-right ml-4">
                    <p className="text-xl font-extrabold text-gray-900">{formatLKR(bid.bid_amount_per_unit)}</p>
                    <p className="text-xs text-gray-400">per unit · Seq #{bid.bid_sequence}</p>
                    <p className="text-xs text-gray-500 mt-1">Total: {formatLKR(bid.total_bid_amount)}</p>
                  </div>
                </div>
                {bid.status === 'outbid' && (
                  <Link
                    to={`/buyer/auction/${bid.auction_id}`}
                    className="mt-3 inline-flex items-center gap-1 text-xs text-emerald-600 font-medium hover:underline"
                  >
                    <TrendingUp size={11} /> Bid again →
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
