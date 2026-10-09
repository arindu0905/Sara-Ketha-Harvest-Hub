import { Link } from 'react-router-dom';
import { useWonAuctions } from '../../hooks/useAuction';
import { useAuctionCountdown, formatCountdown } from '../../hooks/useAuctionCountdown';
import { formatLKR, formatDateTimeSL, formatDateSL } from '../../utils/lkrFormat';
import { Award, Clock, CheckCircle2, AlertTriangle, FileText, Package } from 'lucide-react';

function PaymentCountdown({ deadline, status }: { deadline: string; status: string }) {
  const cd = useAuctionCountdown(status === 'pending' ? deadline : undefined);
  if (status === 'paid') return <span className="text-emerald-600 font-medium flex items-center gap-1"><CheckCircle2 size={14} />Paid</span>;
  if (status === 'defaulted') return <span className="text-red-600 font-medium flex items-center gap-1"><AlertTriangle size={14} />Defaulted</span>;
  if (cd.expired) return <span className="text-red-700 font-semibold animate-pulse">OVERDUE</span>;
  return (
    <span className={`flex items-center gap-1 font-semibold text-sm ${cd.finalMinutes ? 'text-red-700 animate-pulse' : 'text-amber-700'}`}>
      <Clock size={13} /> {formatCountdown(cd)} remaining
    </span>
  );
}

export function WonAuctionsPage() {
  const { data: winners = [], isLoading } = useWonAuctions();

  const pending   = winners.filter((w) => w.payment_status === 'pending');
  const paid      = winners.filter((w) => w.payment_status === 'paid');
  const defaulted = winners.filter((w) => w.payment_status === 'defaulted');

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Award size={22} className="text-emerald-600" /> Won Auctions
        </h1>
        <p className="text-gray-500 text-sm mt-1">Auction lots you have won. Complete payment to receive your produce.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-amber-50 rounded-2xl p-4 border border-amber-100 text-center">
          <p className="text-3xl font-extrabold text-amber-700">{pending.length}</p>
          <p className="text-xs text-amber-600 mt-1">Awaiting Payment</p>
        </div>
        <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-100 text-center">
          <p className="text-3xl font-extrabold text-emerald-700">{paid.length}</p>
          <p className="text-xs text-emerald-600 mt-1">Paid & Processing</p>
        </div>
        <div className="bg-red-50 rounded-2xl p-4 border border-red-100 text-center">
          <p className="text-3xl font-extrabold text-red-700">{defaulted.length}</p>
          <p className="text-xs text-red-600 mt-1">Payment Defaulted</p>
        </div>
      </div>

      {/* Pending payment – most urgent */}
      {pending.length > 0 && (
        <section>
          <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2 text-base">
            <Clock size={16} className="text-amber-600" /> Payment Required
          </h2>
          <div className="space-y-3">
            {pending.map((w) => (
              <div key={w.id} className="bg-white rounded-2xl border border-amber-200 shadow-sm p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-semibold text-gray-900">{w.auctions?.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Lot #{w.auction_lots?.lot_number} · {w.auction_lots?.quality_grade?.replace('_', ' ').toUpperCase()}
                      &nbsp;· {w.auction_lots?.lot_quantity} {w.auction_lots?.unit}
                    </p>
                  </div>
                  <PaymentCountdown deadline={w.payment_deadline_at} status={w.payment_status} />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-400">Amount Due</p>
                    <p className="text-2xl font-extrabold text-emerald-700">{formatLKR(w.total_award_amount)}</p>
                    <p className="text-xs text-gray-400">Deadline: {formatDateTimeSL(w.payment_deadline_at)}</p>
                  </div>
                  <div className="flex gap-2">
                    <Link
                      to={`/buyer/auction/${w.auction_id}`}
                      className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-xl text-xs font-medium text-gray-600 hover:border-emerald-400 hover:text-emerald-700 transition-all"
                    >
                      <FileText size={13} /> View Auction
                    </Link>
                    <Link
                      to={`/buyer/auction/${w.auction_id}/pay?winner=${w.id}`}
                      className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-emerald-600 to-green-600 text-white rounded-xl text-xs font-bold hover:from-emerald-700 hover:to-green-700 transition-all shadow-sm"
                    >
                      Pay Now →
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Paid */}
      {paid.length > 0 && (
        <section>
          <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2 text-base">
            <CheckCircle2 size={16} className="text-emerald-600" /> Paid – Awaiting Dispatch
          </h2>
          <div className="space-y-3">
            {paid.map((w) => (
              <div key={w.id} className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900 text-sm">{w.auctions?.title}</p>
                  <p className="text-xs text-gray-500">Lot #{w.auction_lots?.lot_number} · Paid on {formatDateSL(w.payment_confirmed_at)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-bold text-gray-900">{formatLKR(w.total_award_amount)}</span>
                  <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium bg-emerald-50 px-2.5 py-1 rounded-full">
                    <CheckCircle2 size={11} /> Paid
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {isLoading && (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <div key={i} className="bg-white h-28 rounded-2xl animate-pulse border border-gray-100" />)}
        </div>
      )}
      {!isLoading && winners.length === 0 && (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
          <Package size={32} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500">You haven't won any auctions yet.</p>
          <Link to="/buyer/auction" className="mt-3 inline-block text-sm text-emerald-600 font-medium hover:underline">
            Browse live auctions →
          </Link>
        </div>
      )}
    </div>
  );
}
