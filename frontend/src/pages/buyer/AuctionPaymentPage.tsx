import { Link, useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useConfirmPayment, useWonAuctions } from '../../hooks/useAuction';
import { useAuctionCountdown, formatCountdown } from '../../hooks/useAuctionCountdown';
import { formatLKR, formatDateTimeSL, PAYMENT_METHOD_LABELS } from '../../utils/lkrFormat';
import { CreditCard, CheckCircle2, Clock, AlertTriangle, ArrowLeft } from 'lucide-react';

const PaySchema = z.object({
  winner_id:      z.string().uuid(),
  payment_method: z.enum(['bank_transfer', 'lanka_qr', 'card', 'cash', 'buyer_credit']),
  payment_ref:    z.string().min(3, 'Enter payment reference'),
  amount_lkr:     z.number().positive(),
});

type PayForm = z.infer<typeof PaySchema>;

export function AuctionPaymentPage() {
  const { id: auctionId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: winners = [] } = useWonAuctions();
  const winner = winners.find((w) => w.auction_id === auctionId && w.payment_status === 'pending');

  const { mutate: confirm, isPending, isSuccess } = useConfirmPayment(auctionId!);
  const cd = useAuctionCountdown(winner?.payment_deadline_at);

  const { register, handleSubmit, watch, formState: { errors } } = useForm<PayForm>({
    resolver:     zodResolver(PaySchema),
    defaultValues: {
      winner_id:  winner?.id ?? '',
      amount_lkr: winner?.total_award_amount ?? 0,
    },
  });

  const method = watch('payment_method');

  if (!winner) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <CheckCircle2 size={48} className="text-emerald-500 mx-auto mb-3" />
          <h2 className="text-xl font-bold text-gray-800">No pending payment found</h2>
          <Link to="/buyer/auction/won" className="mt-4 text-emerald-600 hover:underline text-sm">Back to Won Auctions</Link>
        </div>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-emerald-50 flex items-center justify-center">
        <div className="bg-white rounded-3xl shadow-xl p-10 text-center max-w-md">
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <CheckCircle2 size={40} className="text-emerald-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Payment Submitted!</h2>
          <p className="text-gray-500 mb-6">Your payment reference has been recorded. Our team will verify and confirm your payment shortly.</p>
          <Link
            to="/buyer/auction/won"
            className="inline-block bg-emerald-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-emerald-700 transition-colors"
          >
            Back to Won Auctions
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-green-50/20 p-6">
      <div className="max-w-xl mx-auto">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 mb-6 transition-colors">
          <ArrowLeft size={16} /> Back
        </button>

        {/* Deadline alert */}
        {!cd.expired && (
          <div className={`mb-5 rounded-2xl p-4 flex items-center gap-3 ${
            cd.finalMinutes ? 'bg-red-50 border border-red-200' : 'bg-amber-50 border border-amber-200'
          }`}>
            <Clock size={18} className={cd.finalMinutes ? 'text-red-600' : 'text-amber-600'} />
            <div>
              <p className={`font-semibold text-sm ${cd.finalMinutes ? 'text-red-700' : 'text-amber-700'}`}>
                Payment Deadline: {formatCountdown(cd)} remaining
              </p>
              <p className="text-xs text-gray-500">Deadline: {formatDateTimeSL(winner.payment_deadline_at)}</p>
            </div>
          </div>
        )}
        {cd.expired && (
          <div className="mb-5 rounded-2xl p-4 flex items-center gap-3 bg-red-50 border border-red-200">
            <AlertTriangle size={18} className="text-red-600" />
            <p className="text-red-700 font-semibold text-sm">Payment deadline has passed. Please contact support immediately.</p>
          </div>
        )}

        {/* Award summary */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-5">
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <CreditCard size={18} className="text-emerald-600" /> Complete Payment
          </h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>Auction</span>
              <span className="font-medium text-gray-900">{winner.auctions?.title}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Lot</span>
              <span className="font-medium text-gray-900">#{winner.auction_lots?.lot_number}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Quantity</span>
              <span className="font-medium text-gray-900">{winner.auction_lots?.lot_quantity} {winner.auction_lots?.unit}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Price per unit</span>
              <span className="font-medium text-gray-900">{formatLKR(winner.winning_price_per_unit)}</span>
            </div>
            <div className="border-t border-gray-100 pt-2 mt-2 flex justify-between">
              <span className="font-bold text-gray-900">Total Due</span>
              <span className="font-extrabold text-2xl text-emerald-700">{formatLKR(winner.total_award_amount)}</span>
            </div>
          </div>
        </div>

        {/* Payment form */}
        <form
          onSubmit={handleSubmit((data) => confirm(data))}
          className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5"
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method</label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(PAYMENT_METHOD_LABELS) as string[]).map((m) => (
                <label key={m} className={`flex items-center gap-2 p-3 border rounded-xl cursor-pointer transition-all text-sm ${
                  method === m ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 hover:border-gray-300'
                }`}>
                  <input type="radio" value={m} {...register('payment_method')} className="text-emerald-600" />
                  {PAYMENT_METHOD_LABELS[m]}
                </label>
              ))}
            </div>
            {errors.payment_method && <p className="text-xs text-red-600 mt-1">{errors.payment_method.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Payment Reference / Transaction ID</label>
            <input
              {...register('payment_ref')}
              placeholder="Enter bank transfer reference, QR transaction ID, etc."
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
            {errors.payment_ref && <p className="text-xs text-red-600 mt-1">{errors.payment_ref.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Amount Paid (LKR)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">Rs.</span>
              <input
                type="number"
                step="0.01"
                {...register('amount_lkr', { valueAsNumber: true })}
                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            {errors.amount_lkr && <p className="text-xs text-red-600 mt-1">{errors.amount_lkr.message}</p>}
          </div>

          {/* Bank details */}
          {method === 'bank_transfer' && (
            <div className="bg-blue-50 rounded-xl p-4 text-xs text-blue-800 space-y-1">
              <p className="font-semibold text-sm mb-2">Bank Transfer Details</p>
              <p>Bank: Bank of Ceylon / People's Bank</p>
              <p>Account Name: HarvestHub Agricultural Fund</p>
              <p>Account Number: Contact your collection centre officer for details</p>
              <p>Reference: Use your Auction Number as the transfer reference</p>
            </div>
          )}

          <input type="hidden" value={winner.id} {...register('winner_id')} />
          <input type="hidden" value={winner.total_award_amount} {...register('amount_lkr', { valueAsNumber: true })} />

          <button
            type="submit"
            disabled={isPending}
            className="w-full py-4 bg-gradient-to-r from-emerald-600 to-green-600 text-white font-bold rounded-xl hover:from-emerald-700 hover:to-green-700 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? 'Submitting...' : 'Submit Payment Reference'}
          </button>

          <p className="text-xs text-gray-400 text-center">
            Your payment will be verified by our finance team. You will receive a confirmation notification.
          </p>
        </form>
      </div>
    </div>
  );
}
