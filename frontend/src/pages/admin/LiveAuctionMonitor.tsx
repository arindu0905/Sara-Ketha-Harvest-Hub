import React, { useState } from 'react';
import { currentRoleBase } from '../../utils/roleBase';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '../../services/apiClient';
import { auctionApi } from '../../services/auctionApi';
import { formatLKR, formatDateTimeSL, auctionStatusLabel } from '../../utils/lkrFormat';
import { useAuctionCountdown, formatCountdown } from '../../hooks/useAuctionCountdown';
import {
  Gavel, RefreshCw, Eye, Clock, TrendingUp, DollarSign,
  Play, Pause, AlertTriangle, CheckCircle, XCircle, Wifi, WifiOff
} from 'lucide-react';

// Auto-refreshes every 15s for live monitoring
const POLL_MS = 15_000;

function StatusBadge({ status }: { status: string }) {
  const sl = auctionStatusLabel(status);
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${sl.bg} ${sl.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${sl.dot} ${status === 'open' ? 'animate-pulse' : ''}`} />
      {sl.label}
    </span>
  );
}

// v_auction_summary returns flat fields: centre_name, total_lots, open_lots, total_bids
function LiveAuctionCard({ auction, onRefresh }: { auction: any; onRefresh: () => void }) {
  const cd = useAuctionCountdown(auction.status === 'open' ? auction.end_at : undefined);
  const [pausing, setPausing] = useState(false);
  const [closing, setClosing] = useState(false);

  const totalLots = auction.total_lots ?? 0;
  const openLots  = auction.open_lots  ?? 0;
  const totalBids = auction.total_bids ?? 0;

  const pause = async () => {
    setPausing(true);
    try { await auctionApi.pause(auction.id); onRefresh(); } catch { } finally { setPausing(false); }
  };
  const close = async () => {
    if (!window.confirm('Close this auction now?')) return;
    setClosing(true);
    try { await auctionApi.close(auction.id); onRefresh(); } catch { } finally { setClosing(false); }
  };

  return (
    <div className={`card border-l-4 p-5 ${auction.status === 'open' ? 'border-l-emerald-500 ring-1 ring-emerald-100' : auction.status === 'draft' ? 'border-l-gray-300' : 'border-l-amber-400'}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <StatusBadge status={auction.status} />
            <span className="text-xs text-surface-400 font-mono">{auction.auction_number}</span>
          </div>
          <h3 className="font-bold text-surface-900 text-sm leading-snug truncate">{auction.title}</h3>
          <p className="text-xs text-surface-500 mt-0.5">
            {auction.collection_centres?.name ?? auction.centre_name}
            {(auction.collection_centres?.district ?? auction.centre_district) ? ` · ${auction.collection_centres?.district ?? auction.centre_district}` : ''}
          </p>
        </div>
        {auction.status === 'open' && !cd.expired && (
          <div className={`text-right shrink-0 ${cd.finalMinutes ? 'text-red-600' : 'text-emerald-700'}`}>
            <div className="flex items-center gap-1 text-sm font-bold">
              <Clock size={13} />
              {formatCountdown(cd)}
            </div>
            <p className="text-xs text-surface-400">remaining</p>
          </div>
        )}
        {cd.expired && auction.status === 'open' && <span className="text-xs text-red-500 font-bold shrink-0">TIME UP</span>}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        {[
          { label: 'Lots',   value: totalLots, icon: <Gavel size={12} />,     color: 'text-surface-600' },
          { label: 'Open',   value: openLots,  icon: <Play size={12} />,      color: 'text-emerald-600' },
          { label: 'Bids',   value: totalBids, icon: <TrendingUp size={12} />, color: 'text-blue-600' },
          { label: 'Starts', value: auction.status === 'draft' || auction.status === 'scheduled'
              ? formatDateTimeSL(auction.start_at).split(',')[0]
              : formatDateTimeSL(auction.end_at).split(',')[0],
            icon: <Clock size={12} />, color: 'text-purple-600' },
        ].map(kpi => (
          <div key={kpi.label} className="bg-surface-50 rounded-xl p-2 text-center">
            <div className={`flex justify-center mb-0.5 ${kpi.color}`}>{kpi.icon}</div>
            <p className="text-xs text-surface-400">{kpi.label}</p>
            <p className={`text-xs font-bold ${kpi.color}`}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Timing row */}
      <div className="flex items-center justify-between text-xs text-surface-500 mb-4">
        <span>Start: {formatDateTimeSL(auction.start_at)}</span>
        <span>End: {formatDateTimeSL(auction.end_at)}</span>
      </div>

      {/* Actions */}
      <div className="flex gap-2 border-t border-surface-100 pt-3">
        <Link
          to={`${currentRoleBase()}/auction/${auction.id}`}
          className="flex-1 btn-secondary text-xs py-1.5 flex items-center justify-center gap-1"
        >
          <Eye size={12} /> View Details
        </Link>
        {auction.status === 'open' && (
          <>
            <button
              onClick={pause}
              disabled={pausing}
              className="px-3 py-1.5 text-xs rounded-xl border border-amber-200 text-amber-700 hover:bg-amber-50 transition-all flex items-center gap-1"
            >
              <Pause size={12} /> {pausing ? '...' : 'Pause'}
            </button>
            <button
              onClick={close}
              disabled={closing}
              className="px-3 py-1.5 text-xs rounded-xl border border-red-200 text-red-700 hover:bg-red-50 transition-all flex items-center gap-1"
            >
              <XCircle size={12} /> {closing ? '...' : 'Close'}
            </button>
          </>
        )}
        {auction.status === 'awaiting_award' && (
          <Link
            to={`${currentRoleBase()}/auction/${auction.id}`}
            className="px-3 py-1.5 text-xs rounded-xl bg-amber-500 text-white hover:bg-amber-600 transition-all flex items-center gap-1"
          >
            <CheckCircle size={12} /> Award Lots
          </Link>
        )}
        {auction.status === 'draft' && (
          <Link
            to={`${currentRoleBase()}/auction/${auction.id}`}
            className="px-3 py-1.5 text-xs rounded-xl bg-blue-500 text-white hover:bg-blue-600 transition-all flex items-center gap-1"
          >
            <CheckCircle size={12} /> Approve
          </Link>
        )}
      </div>
    </div>
  );
}

export const LiveAuctionMonitor: React.FC = () => {
  const [filter, setFilter] = useState<'all' | 'open' | 'scheduled' | 'awaiting_award' | 'draft'>('all');
  const queryClient = useQueryClient();

  // Use the dedicated admin/all endpoint which queries auctions table directly
  // (avoids v_auction_summary INNER JOIN issue that could filter out auctions)
  const { data: res, isLoading, dataUpdatedAt } = useQuery({
    queryKey: ['admin-live-auctions'],
    queryFn: () => apiClient.get('/auctions/admin/all'),
    refetchInterval: POLL_MS,
  });

  const allAuctions: any[] = res?.data?.data ?? [];

  const draft     = allAuctions.filter(a => a.status === 'draft');
  const live      = allAuctions.filter(a => a.status === 'open');
  const scheduled = allAuctions.filter(a => a.status === 'scheduled');
  const awaiting  = allAuctions.filter(a => a.status === 'awaiting_award');
  const paused    = allAuctions.filter(a => a.status === 'paused');
  const finished  = allAuctions.filter(a => ['completed', 'paid', 'awarded', 'cancelled'].includes(a.status));

  const activeStatuses = ['draft', 'scheduled', 'open', 'paused', 'awaiting_award'];
  const filteredAuctions = filter === 'all'
    ? allAuctions.filter(a => activeStatuses.includes(a.status))
    : allAuctions.filter(a => a.status === filter);

  const totalRevenue = allAuctions
    .filter(a => ['paid', 'completed'].includes(a.status))
    .reduce((s, a) => s + (a.total_winning_amount ?? 0), 0);

  const handleRefresh = () => queryClient.invalidateQueries({ queryKey: ['admin-live-auctions'] });

  const lastUpdated = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString('en-LK', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '—';

  const tabs = [
    { key: 'all',            label: `All Active (${allAuctions.filter(a => activeStatuses.includes(a.status)).length})` },
    { key: 'open',           label: `Live (${live.length})` },
    { key: 'draft',          label: `Draft (${draft.length})` },
    { key: 'scheduled',      label: `Scheduled (${scheduled.length})` },
    { key: 'awaiting_award', label: `Awaiting Award (${awaiting.length})` },
  ];

  return (
    <div className="space-y-6 animate-fade-in p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <span className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse" />
            Live Auction Monitor
          </h1>
          <p className="page-subtitle">All auctions across the system. Auto-refreshes every 15 seconds.</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full ${live.length > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-surface-100 text-surface-500'}`}>
            {live.length > 0 ? <Wifi size={12} /> : <WifiOff size={12} />}
            {live.length > 0 ? `${live.length} Live` : 'No live auctions'}
          </div>
          <span className="text-xs text-surface-400">Updated: {lastUpdated}</span>
          <button onClick={handleRefresh} className="btn-secondary flex items-center gap-2 text-sm">
            <RefreshCw size={14} /> Refresh
          </button>
          <Link to={`${currentRoleBase()}/auction/create`} className="btn-primary flex items-center gap-2 text-sm">
            <Gavel size={14} /> New Auction
          </Link>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Draft',          value: draft.length,           color: 'text-gray-700',    bg: 'bg-gray-50 border-gray-100',       icon: <Gavel size={16} className="text-gray-400" /> },
          { label: 'Live Now',       value: live.length,            color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-100', icon: <Play size={16} className="text-emerald-500" /> },
          { label: 'Scheduled',      value: scheduled.length,       color: 'text-blue-700',    bg: 'bg-blue-50 border-blue-100',       icon: <Clock size={16} className="text-blue-500" /> },
          { label: 'Awaiting Award', value: awaiting.length,        color: 'text-amber-700',   bg: 'bg-amber-50 border-amber-100',     icon: <AlertTriangle size={16} className="text-amber-500" /> },
          { label: 'Total Revenue',  value: formatLKR(totalRevenue), color: 'text-purple-700', bg: 'bg-purple-50 border-purple-100',   icon: <DollarSign size={16} className="text-purple-500" /> },
        ].map(kpi => (
          <div key={kpi.label} className={`card border ${kpi.bg} p-4`}>
            <div className="flex items-center gap-2 mb-1">{kpi.icon}<p className="text-xs text-surface-500">{kpi.label}</p></div>
            <p className={`text-2xl font-extrabold ${kpi.color}`}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-1 bg-surface-100 rounded-2xl p-1 overflow-x-auto w-fit">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key as any)}
            className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${filter === tab.key ? 'bg-white text-primary-700 shadow-sm' : 'text-surface-500 hover:text-surface-700'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Auction Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <div key={i} className="card h-48 animate-pulse" />)}
        </div>
      ) : filteredAuctions.length === 0 ? (
        <div className="card p-12 text-center">
          <Gavel size={40} className="mx-auto mb-3 text-surface-300" />
          <h3 className="font-semibold text-surface-600">No auctions found</h3>
          <p className="text-sm text-surface-400 mt-1">
            {filter === 'open' ? 'No live auctions running right now.' : `No auctions with status "${filter}".`}
          </p>
          <Link to={`${currentRoleBase()}/auction/create`} className="btn-primary mt-4 inline-flex items-center gap-2">
            <Gavel size={14} /> Create Auction
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredAuctions.map(auction => (
            <LiveAuctionCard key={auction.id} auction={auction} onRefresh={handleRefresh} />
          ))}
        </div>
      )}

      {/* Completed summary */}
      {finished.length > 0 && (
        <details className="card p-4">
          <summary className="text-sm font-semibold text-surface-600 flex items-center gap-2 cursor-pointer">
            <CheckCircle size={14} className="text-emerald-500" />
            Completed / Cancelled ({finished.length})
          </summary>
          <div className="mt-3 space-y-2">
            {finished.map(a => (
              <div key={a.id} className="flex items-center justify-between text-sm p-2 rounded-xl hover:bg-surface-50">
                <div>
                  <span className="font-medium text-surface-800">{a.title}</span>
                  <span className="text-xs text-surface-400 ml-2">{a.auction_number}</span>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={a.status} />
                  <Link to={`${currentRoleBase()}/auction/${a.id}`} className="text-xs text-primary-600 hover:underline">View</Link>
                </div>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
};
