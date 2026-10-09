import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { ArrowLeft, CheckCircle2, XCircle, Trophy } from 'lucide-react';
import { auctionApi } from '../../services/auctionApi';
import { Modal } from '../../components/ui/Modal';
import { formatLKR, formatDateTimeSL } from '../../utils/lkrFormat';
import { apiErrorMessage } from '../../utils/apiError';

const BID_BADGE: Record<string, string> = {
  pending: 'badge-info', winning: 'badge-success', accepted: 'badge-success',
  outbid: 'badge-neutral', rejected: 'badge-danger', withdrawn_system: 'badge-neutral',
};

/** E3-US12 / US13 – inventory manager reviews all bids per lot, then accepts (awards) or rejects the winning bid. */
export const AuctionAwardPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const key = ['auction-award-board', id];
  const [rejecting, setRejecting] = useState<any>(null);
  const [reason, setReason] = useState('');

  const { data, isLoading } = useQuery({ queryKey: key, queryFn: () => auctionApi.getAwardBoard(id!).then(r => r.data.data) });
  const board = data as any;

  const refresh = () => { qc.invalidateQueries({ queryKey: key }); qc.invalidateQueries({ queryKey: ['auctions'] }); };

  const award = useMutation({
    mutationFn: (lotId: string) => auctionApi.awardLot(id!, lotId),
    onSuccess: () => { toast.success('Bid accepted – order and invoice created'); refresh(); },
    onError: (e: any) => toast.error(apiErrorMessage(e, 'Could not award this lot')),
  });

  const reject = useMutation({
    mutationFn: ({ lotId, reason }: { lotId: string; reason: string }) => auctionApi.offerToNextBidder(id!, lotId, reason),
    onSuccess: (res: any) => { toast.success(res?.data?.message || 'Bid rejected'); setRejecting(null); setReason(''); refresh(); },
    onError: (e: any) => toast.error(apiErrorMessage(e, 'Could not reject this bid')),
  });

  if (isLoading) return <div className="skeleton h-64 rounded-2xl" />;
  if (!board?.auction) return <div className="card p-8 text-center text-surface-500">Auction not found.</div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <Link to="/inventory/auction/dashboard" className="text-xs text-primary-600 flex items-center gap-1 mb-2"><ArrowLeft size={14} /> Auction dashboard</Link>
        <h1 className="page-title">Review bids &amp; award</h1>
        <p className="page-subtitle">{board.auction.auction_number} · {board.auction.title} · status: {board.auction.status.replace(/_/g, ' ')}</p>
      </div>

      {board.lots.length === 0 && <div className="card p-8 text-center text-surface-500">This auction has no lots.</div>}

      {board.lots.map((lot: any) => {
        const w = lot.current_winner;
        const awarded = !!w?.purchase_order_id;
        const paid = w?.payment_status === 'paid';
        return (
          <div key={lot.id} className="card overflow-hidden">
            <div className="card-header p-4 border-b border-surface-100 flex flex-wrap gap-3 justify-between items-center">
              <div>
                <h3 className="text-sm font-bold text-surface-900">Lot {lot.lot_number} · {lot.crop_categories?.name} · {lot.quality_grade?.replace(/_/g, ' ')}</h3>
                <p className="text-xs text-surface-500">
                  {lot.lot_quantity} {lot.unit} · start {formatLKR(lot.starting_price_per_unit)}
                  {lot.reserve_price_per_unit ? ` · reserve ${formatLKR(lot.reserve_price_per_unit)}` : ''} · lot status: {lot.lot_status}
                </p>
              </div>
              {w && !paid && (
                <div className="flex gap-2">
                  {!awarded && (
                    <button className="btn-primary btn-sm flex items-center gap-1" disabled={award.isPending} onClick={() => award.mutate(lot.id)}>
                      <CheckCircle2 size={14} /> Accept &amp; award
                    </button>
                  )}
                  <button className="btn-secondary btn-sm flex items-center gap-1 text-red-700" onClick={() => setRejecting(lot)}>
                    <XCircle size={14} /> Reject winning bid
                  </button>
                </div>
              )}
              {awarded && <span className="badge-success text-xs px-2 py-0.5 flex items-center gap-1"><Trophy size={12} /> {paid ? 'Awarded & paid' : 'Awarded – awaiting payment'}</span>}
            </div>
            {lot.bids.length === 0 ? (
              <div className="p-5 text-sm text-surface-500">No bids were placed on this lot.</div>
            ) : (
              <div className="table-container">
                <table className="table">
                  <thead><tr><th>Buyer</th><th>Price / unit</th><th>Quantity</th><th>Total</th><th>Placed</th><th>Status</th></tr></thead>
                  <tbody>
                    {lot.bids.map((b: any) => {
                      const buyer = Array.isArray(b.buyers) ? b.buyers[0] : b.buyers;
                      const isWinning = w?.winning_bid_id === b.id;
                      return (
                        <tr key={b.id} className={isWinning ? 'bg-emerald-50' : ''}>
                          <td className="font-semibold">{buyer?.company_name || buyer?.contact_person || 'Buyer'}{isWinning && <span className="ml-2 text-2xs text-emerald-700">★ current winner</span>}</td>
                          <td>{formatLKR(b.bid_amount_per_unit)}</td>
                          <td>{b.bid_quantity}</td>
                          <td>{formatLKR(b.total_bid_amount)}</td>
                          <td className="text-xs">{formatDateTimeSL(b.bid_time)}</td>
                          <td>
                            <span className={`${BID_BADGE[b.status] || 'badge-neutral'} text-xs px-2 py-0.5`}>{b.status.replace(/_/g, ' ')}</span>
                            {b.rejection_reason && <div className="text-2xs text-red-600 mt-0.5">{b.rejection_reason}</div>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}

      <Modal isOpen={!!rejecting} onClose={() => setRejecting(null)} title={`Reject winning bid – Lot ${rejecting?.lot_number ?? ''}`}>
        <div className="space-y-3">
          <p className="text-sm text-surface-600">The bidder is notified. The lot is offered to the next highest bidder, or cancelled if there is none.</p>
          <textarea className="form-input w-full text-sm" rows={3} placeholder="Reason (at least 10 characters)" value={reason} onChange={e => setReason(e.target.value)} />
          <div className="flex justify-end gap-2">
            <button className="btn-secondary btn-sm" onClick={() => setRejecting(null)}>Cancel</button>
            <button className="btn-primary btn-sm" disabled={reason.trim().length < 10 || reject.isPending}
              onClick={() => reject.mutate({ lotId: rejecting.id, reason: reason.trim() })}>
              {reject.isPending ? 'Rejecting…' : 'Reject bid'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
