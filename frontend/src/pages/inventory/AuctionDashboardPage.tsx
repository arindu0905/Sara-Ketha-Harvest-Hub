import { Link } from 'react-router-dom';
import { useCentreAuctions, usePauseAuction, useCloseAuction } from '../../hooks/useAuction';
import { formatLKR, formatDateTimeSL, auctionStatusLabel } from '../../utils/lkrFormat';
import { useAuctionCountdown, formatCountdown } from '../../hooks/useAuctionCountdown';
import { Plus, Gavel, TrendingUp, Clock, AlertTriangle, Play, Pause, X } from 'lucide-react';

function LiveAuctionRow({ auction }: { auction: any }) {
  const cd = useAuctionCountdown(auction.status === 'open' ? auction.end_at : undefined);
  const { mutate: closeAuction, isPending: closing } = useCloseAuction(auction.id);
  const { mutate: pauseAuction, isPending: pausing } = usePauseAuction(auction.id);
  const sl = auctionStatusLabel(auction.status);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-md transition-all">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${sl.bg} ${sl.color}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${sl.dot} ${auction.status === 'open' ? 'animate-pulse' : ''}`} />
              {sl.label}
            </span>
            <span className="text-xs text-gray-400 font-mono">{auction.auction_number}</span>
          </div>
          <Link to={`/inventory/auction/${auction.id}`} className="font-semibold text-gray-900 hover:text-emerald-700 transition-colors">
            {auction.title}
          </Link>
        </div>
        <div className="text-right ml-4">
          {auction.status === 'open' && !cd.expired && (
            <span className={`text-sm font-bold flex items-center gap-1 ${cd.finalMinutes ? 'text-red-600 animate-pulse' : 'text-emerald-600'}`}>
              <Clock size={13} /> {formatCountdown(cd)}
            </span>
          )}
          {cd.expired && <span className="text-xs text-red-500 font-medium">Time up</span>}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-4 text-center">
        <div className="bg-gray-50 rounded-xl p-2">
          <p className="text-xs text-gray-400">Lots</p>
          <p className="font-bold text-gray-900">{auction.auction_lots?.length ?? 0}</p>
        </div>
        <div className="bg-gray-50 rounded-xl p-2">
          <p className="text-xs text-gray-400">Open Lots</p>
          <p className="font-bold text-emerald-700">{auction.auction_lots?.filter((l: any) => l.lot_status === 'open').length ?? 0}</p>
        </div>
        <div className="bg-gray-50 rounded-xl p-2">
          <p className="text-xs text-gray-400">Closes</p>
          <p className="font-bold text-gray-700 text-xs">{formatDateTimeSL(auction.end_at)}</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Link
          to={`/inventory/auction/${auction.id}`}
          className="flex-1 py-2 border border-gray-200 rounded-xl text-xs font-medium text-gray-600 hover:border-emerald-400 hover:text-emerald-700 text-center transition-all"
        >
          View Details
        </Link>
        {auction.status === 'open' && (
          <>
            <button
              onClick={() => pauseAuction()}
              disabled={pausing}
              className="px-3 py-2 border border-yellow-200 rounded-xl text-xs font-medium text-yellow-700 hover:bg-yellow-50 transition-all flex items-center gap-1"
            >
              <Pause size={12} /> Pause
            </button>
            <button
              onClick={() => closeAuction()}
              disabled={closing}
              className="px-3 py-2 border border-red-200 rounded-xl text-xs font-medium text-red-700 hover:bg-red-50 transition-all flex items-center gap-1"
            >
              <X size={12} /> Close
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export function AuctionDashboardPage() {
  const { data: allAuctions = [], isLoading } = useCentreAuctions();

  const live      = allAuctions.filter((a) => a.status === 'open');
  const scheduled = allAuctions.filter((a) => a.status === 'scheduled');
  const awaiting  = allAuctions.filter((a) => a.status === 'awaiting_award');
  const totalRevenue = allAuctions
    .filter((a) => ['paid', 'completed'].includes(a.status))
    .reduce((sum, a) => sum + (a.auction_lots?.reduce((s: number, l: any) => s + (l.total_winning_amount ?? 0), 0) ?? 0), 0);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Gavel size={22} className="text-emerald-600" /> Auction Dashboard
          </h1>
          <p className="text-gray-500 text-sm mt-1">Manage produce auctions for your collection centre.</p>
        </div>
        <Link
          to="/inventory/auction/create"
          className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-green-600 text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:from-emerald-700 hover:to-green-700 transition-all shadow-md"
        >
          <Plus size={16} /> New Auction
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Live Now',       value: live.length,      color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', icon: <Play size={16} className="text-emerald-500" /> },
          { label: 'Scheduled',      value: scheduled.length, color: 'text-blue-700',    bg: 'bg-blue-50 border-blue-200',       icon: <Clock size={16} className="text-blue-500" /> },
          { label: 'Awaiting Award', value: awaiting.length,  color: 'text-amber-700',   bg: 'bg-amber-50 border-amber-200',     icon: <AlertTriangle size={16} className="text-amber-500" /> },
          { label: 'Total Revenue',  value: formatLKR(totalRevenue), color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200', icon: <TrendingUp size={16} className="text-purple-500" /> },
        ].map((s) => (
          <div key={s.label} className={`rounded-2xl border p-4 ${s.bg}`}>
            <div className="flex items-center gap-2 mb-2">{s.icon}<p className="text-xs text-gray-500">{s.label}</p></div>
            <p className={`text-2xl font-extrabold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Live auctions */}
      {live.length > 0 && (
        <section>
          <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            Live Auctions ({live.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {live.map((a) => <LiveAuctionRow key={a.id} auction={a} />)}
          </div>
        </section>
      )}

      {/* Awaiting Award */}
      {awaiting.length > 0 && (
        <section>
          <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <AlertTriangle size={15} className="text-amber-600" /> Awaiting Award ({awaiting.length})
          </h2>
          <div className="space-y-3">
            {awaiting.map((a) => (
              <div key={a.id} className="bg-amber-50 rounded-2xl border border-amber-200 p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900 text-sm">{a.title}</p>
                  <p className="text-xs text-gray-500">{a.auction_number} · Closed: {formatDateTimeSL(a.end_at)}</p>
                </div>
                <Link
                  to={`/inventory/auction/${a.id}/award`}
                  className="px-4 py-2 bg-amber-600 text-white text-xs font-bold rounded-xl hover:bg-amber-700 transition-colors"
                >
                  Award Lots →
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Scheduled */}
      {scheduled.length > 0 && (
        <section>
          <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Clock size={15} className="text-blue-600" /> Scheduled ({scheduled.length})
          </h2>
          <div className="space-y-3">
            {scheduled.map((a) => (
              <div key={a.id} className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center justify-between hover:shadow-sm transition-all">
                <div>
                  <p className="font-medium text-gray-900 text-sm">{a.title}</p>
                  <p className="text-xs text-gray-500">{a.auction_number} · Opens: {formatDateTimeSL(a.start_at)}</p>
                </div>
                <Link
                  to={`/inventory/auction/${a.id}`}
                  className="text-xs text-emerald-600 font-medium hover:underline"
                >
                  Manage →
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}

      {isLoading && (
        <div className="grid grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="bg-white h-40 rounded-2xl animate-pulse border border-gray-100" />)}
        </div>
      )}
    </div>
  );
}
